import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkRateLimit, recordFailedAttempt, resetRateLimit } from '@/lib/rate-limit'
import { getClientIp } from '@/lib/security'
import { veliVerifyPasswordBodySchema, formatZodError } from '@/lib/validators'
import { getApiLocale } from '@/lib/api-locale'
import { getTranslations } from 'next-intl/server'

export async function POST(request: Request) {
  const t = await getTranslations({ locale: await getApiLocale(), namespace: 'apiErrors' })
  try {
    const body = await request.json().catch(() => null)
    const parsed = veliVerifyPasswordBodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: formatZodError(parsed.error, await getApiLocale()) },
        { status: 400 }
      )
    }
    const { password } = parsed.data

    const ip = getClientIp(request)

    // İki katmanlı rate limit:
    //   IP bazli kisa: 10 deneme / 3 dk (UI sik sik dogru sifreyle gelirse rezetlenir)
    //   IP bazli uzun: 50 deneme / saat (school password enumeration koruması — F-01)
    const rlShort = `veli-pwd:${ip}`
    const rlLong = `veli-pwd-h:${ip}`

    const [shortLimit, longLimit] = await Promise.all([
      checkRateLimit(rlShort, 10, 3),
      checkRateLimit(rlLong, 50, 60),
    ])

    if (!shortLimit.allowed || !longLimit.allowed) {
      const blockedUntil = !longLimit.allowed ? longLimit.blockedUntil : shortLimit.blockedUntil
      const waitMinutes = blockedUntil
        ? Math.ceil((blockedUntil.getTime() - Date.now()) / 60000)
        : 5
      return NextResponse.json(
        { error: t('veli.tooManyAttempts', { minutes: waitMinutes }) },
        { status: 429 }
      )
    }

    // Okul sifresini kontrol et (okul bazli giris)
    const school = await prisma.school.findFirst({
      where: {
        password: password.toUpperCase().trim(),
        isActive: true
      },
      include: {
        classes: {
          where: { isActive: true },
          orderBy: { name: 'asc' },
          include: {
            package: {
              select: {
                id: true,
                name: true,
                name_en: true,
                name_de: true,
                name_ar: true,
                description: true,
                description_en: true,
                description_de: true,
                description_ar: true,
                note: true,
                note_en: true,
                note_de: true,
                note_ar: true,
                price: true,
                isCustomizable: true,
                items: {
                  select: {
                    id: true,
                    name: true,
                    name_en: true,
                    name_de: true,
                    name_ar: true,
                    quantity: true,
                    // Fiyat yalnizca ozellestirilebilir pakette veliye gonderilir (asagidaki map'te filtrelenir)
                    price: true
                  },
                  orderBy: { name: 'asc' }
                }
              }
            }
          }
        }
      }
    })

    if (!school) {
      await Promise.all([
        recordFailedAttempt(rlShort),
        recordFailedAttempt(rlLong),
      ])
      return NextResponse.json(
        { error: t('veli.invalidPassword') },
        { status: 401 }
      )
    }

    // Aktif siniflar ve paketleri kontrol et
    const classesWithPackages = school.classes.filter(c => c.package !== null)

    if (classesWithPackages.length === 0) {
      return NextResponse.json(
        { error: t('veli.noActiveClassPackage') },
        { status: 404 }
      )
    }

    // Basarili giris - sadece kisa-vade limiti sifirla; uzun-vade saldırı tespiti devam etsin
    await resetRateLimit(rlShort)

    return NextResponse.json({
      success: true,
      schoolId: school.id,
      schoolName: school.name,
      schoolName_en: school.name_en,
      schoolName_de: school.name_de,
      schoolName_ar: school.name_ar,
      deliveryType: school.deliveryType,
      classes: classesWithPackages.map(c => ({
        id: c.id,
        name: c.name,
        name_en: c.name_en,
        name_de: c.name_de,
        name_ar: c.name_ar,
        package: c.package ? {
          id: c.package.id,
          name: c.package.name,
          name_en: c.package.name_en,
          name_de: c.package.name_de,
          name_ar: c.package.name_ar,
          description: c.package.description,
          description_en: c.package.description_en,
          description_de: c.package.description_de,
          description_ar: c.package.description_ar,
          note: c.package.note,
          note_en: c.package.note_en,
          note_de: c.package.note_de,
          note_ar: c.package.note_ar,
          price: c.package.price,
          isCustomizable: c.package.isCustomizable,
          items: c.package.items.map(it => ({
            id: it.id,
            name: it.name,
            name_en: it.name_en,
            name_de: it.name_de,
            name_ar: it.name_ar,
            quantity: it.quantity,
            // Kalem fiyati sadece ozellestirilebilir pakette veliye gonderilir.
            ...(c.package!.isCustomizable ? { price: it.price } : {})
          }))
        } : null
      }))
    })

  } catch (error) {
    console.error('Sifre dogrulama hatasi:', error)
    return NextResponse.json(
      { error: t('veli.genericErrorRetry') },
      { status: 500 }
    )
  }
}
