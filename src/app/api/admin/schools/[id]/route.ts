import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession, hashPassword } from '@/lib/auth'
import { logAction } from '@/lib/logger'
import { adminSchoolUpdateSchema, formatZodError } from '@/lib/validators'
import { sendDirectorPasswordReset, sendSchoolPasswordRegenerated } from '@/lib/email'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession()
    if (!session) {
      return NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 401 })
    }

    const { id } = await params

    const school = await prisma.school.findUnique({
      where: { id },
      include: {
        classes: {
          include: {
            package: true,
            _count: { select: { orders: true } }
          }
        }
      }
    })

    if (!school) {
      return NextResponse.json({ error: 'Okul bulunamadi' }, { status: 404 })
    }

    // Hassas alanlari response'dan cikar
    const { directorPassword: _dp, ...safeSchool } = school as Record<string, unknown>
    return NextResponse.json({ school: safeSchool })
  } catch (error) {
    console.error('Okul getirilemedi:', error)
    return NextResponse.json(
      { error: 'Okul yuklenemedi' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession()
    if (!session) {
      return NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json().catch(() => null)
    const parsed = adminSchoolUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: formatZodError(parsed.error) },
        { status: 400 }
      )
    }

    // Izin verilen alanlari filtrele
    const allowedFields = ['name', 'address', 'phone', 'email', 'deliveryType', 'password', 'directorName', 'directorEmail', 'directorPassword', 'isActive']
    const { directorPassword, ...rest } = parsed.data as Record<string, unknown>
    const updateData: Record<string, unknown> = {}

    for (const key of Object.keys(rest)) {
      if (allowedFields.includes(key)) {
        updateData[key] = rest[key]
      }
    }

    // Veli sifresi degisiyorsa: minimum uzunluk siniri yok. Bos birakilirsa "degismedi"
    // anlamina gelir (mevcut sifre korunur). Dolu ise benzersizlik kontrolu yapilir.
    if (typeof updateData.password === 'string') {
      const newPwd = (updateData.password as string).toUpperCase().trim()
      if (!newPwd) {
        // Bos -> sifreyi degistirme
        delete updateData.password
      } else {
        const conflict = await prisma.school.findFirst({
          where: { password: newPwd, NOT: { id } }
        })
        if (conflict) {
          return NextResponse.json(
            { error: 'Bu sifre baska bir okulda kullaniliyor' },
            { status: 409 }
          )
        }
        updateData.password = newPwd
      }
    }

    // directorEmail degisiyorsa lowercase
    if (typeof updateData.directorEmail === 'string') {
      updateData.directorEmail = (updateData.directorEmail as string).toLowerCase().trim()
    }

    // directorPassword varsa hash'le
    if (directorPassword && typeof directorPassword === 'string' && directorPassword.trim()) {
      updateData.directorPassword = await hashPassword(directorPassword.trim())
    }

    // En az bir alan guncellenmelidir
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'Guncellenecek alan bulunamadi' }, { status: 400 })
    }

    // Mail gonderme kararini almak icin update'ten ONCE eski degerleri al
    const previousSchool = await prisma.school.findUnique({
      where: { id },
      select: { password: true, directorEmail: true, directorName: true, name: true }
    })

    const school = await prisma.school.update({
      where: { id },
      data: updateData
    })

    await logAction({
      userId: session.id,
      userType: 'ADMIN',
      action: 'UPDATE',
      entity: 'SCHOOL',
      entityId: school.id,
      details: { name: school.name }
    })

    // Mudur sifresi degistiyse mail gonder (best-effort)
    if (directorPassword && typeof directorPassword === 'string' && directorPassword.trim()) {
      sendDirectorPasswordReset({
        directorEmail: school.directorEmail,
        directorName: school.directorName,
        schoolName: school.name,
        newPassword: directorPassword.trim()
      }).catch(err => console.error('[email] sendDirectorPasswordReset hatasi:', err))
    }

    // Veli sifresi degistiyse mail gonder
    if (typeof updateData.password === 'string' && previousSchool && previousSchool.password !== updateData.password) {
      sendSchoolPasswordRegenerated({
        directorEmail: school.directorEmail,
        directorName: school.directorName,
        schoolName: school.name,
        newPassword: updateData.password as string
      }).catch(err => console.error('[email] sendSchoolPasswordRegenerated hatasi:', err))
    }

    return NextResponse.json({ school })
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === 'P2002') {
      return NextResponse.json(
        { error: 'Bu e-posta adresi ile baska bir okul zaten mevcut.' },
        { status: 409 }
      )
    }
    console.error('Okul guncellenemedi:', error)
    return NextResponse.json(
      { error: 'Okul guncellenemedi' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession()
    if (!session) {
      return NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 401 })
    }

    const { id } = await params

    // Okul bilgisini al
    const school = await prisma.school.findUnique({
      where: { id },
      include: { classes: { select: { id: true } } }
    })

    if (!school) {
      return NextResponse.json({ error: 'Okul bulunamadi' }, { status: 404 })
    }

    const classIds = school.classes.map(c => c.id)

    // Yasal saklama (VUK/TTK 5-10 yil): herhangi bir siparis kaydi varsa hard delete YOK.
    // Tum durumlar (COMPLETED/CANCELLED/REFUNDED dahil) hesap defteri/fatura kaydidir.
    if (classIds.length > 0) {
      const hasOrders = await prisma.order.findFirst({
        where: { classId: { in: classIds } },
        select: { id: true }
      })
      if (hasOrders) {
        return NextResponse.json(
          { error: 'Bu okulun siparis kayitlari mevcut. Silmek yerine okulu pasiflestirebilirsiniz.' },
          { status: 409 }
        )
      }

      // Siparis hic yoksa siniflari guvenle sil
      await prisma.class.deleteMany({
        where: { schoolId: id }
      })
    }

    // Hakedisler: order kaydi yoksa hakedis de uretilmemis olur (commission siparisten geliyor).
    // Buna ragmen manuel girilmis kayit olabilir — onlar da yasal kayit, silmeyelim.
    const hasPayments = await prisma.schoolPayment.findFirst({
      where: { schoolId: id },
      select: { id: true }
    })
    if (hasPayments) {
      return NextResponse.json(
        { error: 'Bu okulun hakedis kayitlari mevcut. Silmek yerine okulu pasiflestirebilirsiniz.' },
        { status: 409 }
      )
    }

    // Hicbir muhasebesel kayit yok — okulu sil
    await prisma.school.delete({
      where: { id }
    })

    await logAction({
      userId: session.id,
      userType: 'ADMIN',
      action: 'DELETE',
      entity: 'SCHOOL',
      entityId: id,
      details: { name: school.name }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Okul silinemedi:', error)
    return NextResponse.json(
      { error: 'Okul silinemedi' },
      { status: 500 }
    )
  }
}
