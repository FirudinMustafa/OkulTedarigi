import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession, hashPassword, verifyPassword } from '@/lib/auth'
import { logAction } from '@/lib/logger'
import { generateSchoolPassword } from '@/lib/password-generator'
import { adminSchoolCreateSchema, formatZodError } from '@/lib/validators'
import { buildTranslationData } from '@/lib/i18n-content'
import { sendDirectorWelcome } from '@/lib/email'
import { getApiLocale } from '@/lib/api-locale'
import { getTranslations } from 'next-intl/server'

export async function GET() {
  const t = await getTranslations({ locale: await getApiLocale(), namespace: 'apiErrors' })
  try {
    const session = await getAdminSession()
    if (!session) {
      return NextResponse.json({ error: t('catalog.unauthorized') }, { status: 401 })
    }

    const schools = await prisma.school.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        name_en: true,
        name_de: true,
        name_ar: true,
        address: true,
        phone: true,
        email: true,
        deliveryType: true,
        showSchoolDeliveryNote: true,
        password: true,
        directorName: true,
        directorEmail: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { classes: true }
        }
      }
    })

    return NextResponse.json({ schools })
  } catch (error) {
    console.error('Okullar listelenemedi:', error)
    return NextResponse.json(
      { error: t('catalog.schoolsLoadFailed') },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const t = await getTranslations({ locale: await getApiLocale(), namespace: 'apiErrors' })
  try {
    const session = await getAdminSession()
    if (!session) {
      return NextResponse.json({ error: t('catalog.unauthorized') }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    const parsed = adminSchoolCreateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: formatZodError(parsed.error, await getApiLocale()) },
        { status: 400 }
      )
    }
    const {
      name,
      address,
      phone,
      email,
      deliveryType,
      showSchoolDeliveryNote,
      directorName,
      directorEmail,
      directorPassword,
      password, // Veli giris sifresi (opsiyonel - verilmezse otomatik olusturulur)
      name_en,
      name_de,
      name_ar
    } = parsed.data

    const dirEmail = directorEmail.toLowerCase().trim()

    // Ayni mudur e-postasini paylasan okullarda AYNI sifre kullanilamaz:
    // mudur girisi sifreye gore okula yonlendigi icin cakisma girisi belirsizlestirir.
    // (bcrypt hash'leri dogrudan karsilastirilamaz; plaintext eldeyken compare ediyoruz.)
    const sameEmailSchools = await prisma.school.findMany({
      where: { directorEmail: dirEmail },
      select: { directorPassword: true }
    })
    for (const s of sameEmailSchools) {
      if (await verifyPassword(directorPassword, s.directorPassword)) {
        return NextResponse.json(
          { error: t('catalog.directorPasswordInUse') },
          { status: 409 }
        )
      }
    }

    // Mudur sifresini hashle
    const hashedPassword = await hashPassword(directorPassword)

    // Veli giris sifresi - verilmediyse otomatik olustur
    let schoolPassword: string = password?.toUpperCase()?.trim() || ''
    if (schoolPassword) {
      // Manuel girilen sifre — minimum uzunluk siniri yok (bos olamaz, benzersiz olmali)
      const conflict = await prisma.school.findFirst({
        where: { password: schoolPassword }
      })
      if (conflict) {
        return NextResponse.json(
          { error: t('catalog.passwordInUseChoose') },
          { status: 409 }
        )
      }
    } else {
      // Benzersiz sifre olustur (12 karakter random — collision olasiligi 10^-18)
      let isUnique = false
      let attempt = 0
      while (!isUnique && attempt < 5) {
        schoolPassword = generateSchoolPassword()
        const existing = await prisma.school.findFirst({
          where: { password: schoolPassword }
        })
        if (!existing) isUnique = true
        attempt++
      }
      if (!isUnique) {
        return NextResponse.json(
          { error: t('catalog.passwordGenFailed') },
          { status: 500 }
        )
      }
    }

    const school = await prisma.school.create({
      data: {
        name,
        ...buildTranslationData('name', { en: name_en, de: name_de, ar: name_ar }),
        address: address || null,
        phone: phone || null,
        email: email || null,
        deliveryType: deliveryType || 'SCHOOL_DELIVERY',
        showSchoolDeliveryNote: showSchoolDeliveryNote ?? true,
        password: schoolPassword,
        directorName: directorName || null,
        directorEmail: dirEmail,
        directorPassword: hashedPassword
      }
    })

    await logAction({
      userId: session.id,
      userType: 'ADMIN',
      action: 'CREATE',
      entity: 'SCHOOL',
      entityId: school.id,
      details: { name: school.name }
    })

    // Mudure hos geldin maili (best-effort — login bilgileri + veli sifresi)
    sendDirectorWelcome({
      directorEmail: school.directorEmail,
      directorName: school.directorName,
      schoolName: school.name,
      loginPassword: directorPassword,
      veliPassword: schoolPassword
    }).catch(err => console.error('[email] sendDirectorWelcome hatasi:', err))

    // Cleartext sifreler response'ta tek seferlik gosterilir; cache/proxy'lere yazilmasin.
    return NextResponse.json(
      {
        school: {
          id: school.id,
          name: school.name,
          address: school.address,
          phone: school.phone,
          email: school.email,
          deliveryType: school.deliveryType,
          showSchoolDeliveryNote: school.showSchoolDeliveryNote,
          password: school.password,
          directorName: school.directorName,
          directorEmail: school.directorEmail,
          directorPassword: directorPassword, // Mudur sifresi (ilk olusturmada goster)
          isActive: school.isActive
        }
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    // directorEmail artik unique degil; kalan unique alan veli giris sifresi (nadiren yarista cakisir)
    if (error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === 'P2002') {
      return NextResponse.json(
        { error: t('catalog.passwordInUseChoose') },
        { status: 409 }
      )
    }
    console.error('Okul olusturulamadi:', error)
    return NextResponse.json(
      { error: t('catalog.schoolCreateFailed') },
      { status: 500 }
    )
  }
}
