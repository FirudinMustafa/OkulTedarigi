import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession, hashPassword } from '@/lib/auth'
import { logAction } from '@/lib/logger'

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
    const body = await request.json()

    // Izin verilen alanlari filtrele
    const allowedFields = ['name', 'address', 'phone', 'email', 'deliveryType', 'password', 'directorName', 'directorEmail', 'directorPassword', 'isActive']
    const { directorPassword, ...rest } = body
    const updateData: Record<string, unknown> = {}

    for (const key of Object.keys(rest)) {
      if (allowedFields.includes(key)) {
        updateData[key] = rest[key]
      }
    }

    // Veli sifresi degisiyorsa: minimum guvenlik + collision check
    if (typeof updateData.password === 'string') {
      const newPwd = (updateData.password as string).toUpperCase().trim()
      if (newPwd.length < 8) {
        return NextResponse.json(
          { error: 'Veli sifresi en az 8 karakter olmali' },
          { status: 400 }
        )
      }
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

    return NextResponse.json({ school })
  } catch (error) {
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

    // Aktif siparis kontrolu - tamamlanmamis siparisler varsa silmeyi engelle
    if (classIds.length > 0) {
      const activeOrders = await prisma.order.count({
        where: {
          classId: { in: classIds },
          status: { notIn: ['COMPLETED', 'CANCELLED', 'REFUNDED'] }
        }
      })

      if (activeOrders > 0) {
        return NextResponse.json(
          { error: `Bu okula ait ${activeOrders} aktif siparis bulunuyor. Silmeden once siparislerin tamamlanmasi veya iptal edilmesi gerekiyor.` },
          { status: 400 }
        )
      }

      // 1. Siparis iptal taleplerini sil
      await prisma.cancelRequest.deleteMany({
        where: { order: { classId: { in: classIds } } }
      })

      // 2. Siparisleri sil (sadece tamamlanmis/iptal/iade edilmis)
      await prisma.order.deleteMany({
        where: { classId: { in: classIds } }
      })

      // 3. Siniflari sil
      await prisma.class.deleteMany({
        where: { schoolId: id }
      })
    }

    // 4. Okul hakedislerini sil
    await prisma.schoolPayment.deleteMany({
      where: { schoolId: id }
    })

    // 5. Okulu sil
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
