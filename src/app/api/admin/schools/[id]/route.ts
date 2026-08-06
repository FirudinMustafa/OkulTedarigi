import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession, hashPassword, verifyPassword } from '@/lib/auth'
import { logAction } from '@/lib/logger'
import { adminSchoolUpdateSchema, formatZodError } from '@/lib/validators'
import { buildTranslationData } from '@/lib/i18n-content'
import { sendDirectorPasswordReset, sendSchoolPasswordRegenerated, sendDirectorEmailChanged } from '@/lib/email'
import { getApiLocale } from '@/lib/api-locale'
import { getTranslations } from 'next-intl/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const t = await getTranslations({ locale: await getApiLocale(), namespace: 'apiErrors' })
  try {
    const session = await getAdminSession()
    if (!session) {
      return NextResponse.json({ error: t('catalog.unauthorized') }, { status: 401 })
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
      return NextResponse.json({ error: t('catalog.schoolNotFound') }, { status: 404 })
    }

    // Hassas alanlari response'dan cikar
    const { directorPassword: _dp, ...safeSchool } = school as Record<string, unknown>
    return NextResponse.json({ school: safeSchool })
  } catch (error) {
    console.error('Okul getirilemedi:', error)
    return NextResponse.json(
      { error: t('catalog.schoolLoadFailed') },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const t = await getTranslations({ locale: await getApiLocale(), namespace: 'apiErrors' })
  try {
    const session = await getAdminSession()
    if (!session) {
      return NextResponse.json({ error: t('catalog.unauthorized') }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json().catch(() => null)
    const parsed = adminSchoolUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: formatZodError(parsed.error, await getApiLocale()) },
        { status: 400 }
      )
    }

    // Izin verilen alanlari filtrele
    const allowedFields = ['name', 'address', 'phone', 'email', 'deliveryType', 'showSchoolDeliveryNote', 'showNameToParent', 'password', 'directorName', 'directorEmail', 'directorPassword', 'isActive']
    const { directorPassword, ...rest } = parsed.data as Record<string, unknown>
    const updateData: Record<string, unknown> = {}

    for (const key of Object.keys(rest)) {
      if (allowedFields.includes(key)) {
        updateData[key] = rest[key]
      }
    }

    // Cok dilli okul adi cevirileri (varsa) — bos string -> null
    if ('name_en' in rest || 'name_de' in rest || 'name_ar' in rest) {
      Object.assign(updateData, buildTranslationData('name', {
        en: rest.name_en as string | null | undefined,
        de: rest.name_de as string | null | undefined,
        ar: rest.name_ar as string | null | undefined,
      }))
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
            { error: t('catalog.passwordInUseOther') },
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
      return NextResponse.json({ error: t('catalog.noFieldsToUpdate') }, { status: 400 })
    }

    // Mail gonderme kararini almak icin update'ten ONCE eski degerleri al
    const previousSchool = await prisma.school.findUnique({
      where: { id },
      select: { password: true, directorEmail: true, directorName: true, name: true }
    })

    // Mudur sifresi degisiyorsa: ayni e-postayi paylasan DIGER okullarda ayni sifre olmamali
    // (mudur girisi sifreye gore okula yonlendigi icin cakisma belirsizlik yaratir).
    if (directorPassword && typeof directorPassword === 'string' && directorPassword.trim()) {
      const targetEmail = (typeof updateData.directorEmail === 'string'
        ? updateData.directorEmail
        : previousSchool?.directorEmail) || ''
      const others = await prisma.school.findMany({
        where: { directorEmail: targetEmail, NOT: { id } },
        select: { directorPassword: true }
      })
      for (const s of others) {
        if (await verifyPassword(directorPassword.trim(), s.directorPassword)) {
          return NextResponse.json(
            { error: t('catalog.directorPasswordInUse') },
            { status: 409 }
          )
        }
      }
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

    // Mudur giris e-postasi degistiyse YENI adrese sifresiz bildirim gonder (best-effort).
    // Mudur sifresi hash'li oldugu icin mailde yer almaz; veli sifresi + bilgilendirme gider.
    if (
      typeof updateData.directorEmail === 'string' &&
      previousSchool &&
      previousSchool.directorEmail !== updateData.directorEmail
    ) {
      sendDirectorEmailChanged({
        directorEmail: school.directorEmail, // yeni adres
        directorName: school.directorName,
        schoolName: school.name,
        veliPassword: school.password
      }).catch(err => console.error('[email] sendDirectorEmailChanged hatasi:', err))
    }

    return NextResponse.json({ school })
  } catch (error) {
    // directorEmail artik unique degil; kalan unique alan veli giris sifresi
    if (error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === 'P2002') {
      return NextResponse.json(
        { error: t('catalog.passwordInUseOther') },
        { status: 409 }
      )
    }
    console.error('Okul guncellenemedi:', error)
    return NextResponse.json(
      { error: t('catalog.schoolUpdateFailed') },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const t = await getTranslations({ locale: await getApiLocale(), namespace: 'apiErrors' })
  try {
    const session = await getAdminSession()
    if (!session) {
      return NextResponse.json({ error: t('catalog.unauthorized') }, { status: 401 })
    }

    const { id } = await params

    // Okul bilgisini al
    const school = await prisma.school.findUnique({
      where: { id },
      include: { classes: { select: { id: true } } }
    })

    if (!school) {
      return NextResponse.json({ error: t('catalog.schoolNotFound') }, { status: 404 })
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
          { error: t('catalog.schoolHasOrders') },
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
        { error: t('catalog.schoolHasPayments') },
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
      { error: t('catalog.schoolDeleteFailed') },
      { status: 500 }
    )
  }
}
