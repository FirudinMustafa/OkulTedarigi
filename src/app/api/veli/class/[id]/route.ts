import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkRateLimit, recordFailedAttempt, resetRateLimit } from '@/lib/rate-limit'
import { getClientIp } from '@/lib/security'
import { getApiLocale } from '@/lib/api-locale'
import { getTranslations } from 'next-intl/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const t = await getTranslations({ locale: await getApiLocale(), namespace: 'apiErrors' })
  try {
    const { id } = await params

    if (!id || typeof id !== 'string' || id.length > 40) {
      return NextResponse.json({ error: t('veli.invalidClassId') }, { status: 400 })
    }

    // Anonim endpoint — IP başına 60 sorgu / 5 dk (CUID enumeration koruması)
    const ip = getClientIp(request)
    const rlIdentifier = `veli-class:${ip}`
    const rateLimitResult = await checkRateLimit(rlIdentifier, 60, 5)
    if (!rateLimitResult.allowed) {
      const waitMinutes = rateLimitResult.blockedUntil
        ? Math.ceil((rateLimitResult.blockedUntil.getTime() - Date.now()) / 60000)
        : 5
      return NextResponse.json(
        { error: t('veli.tooManyRequests', { minutes: waitMinutes }) },
        { status: 429 }
      )
    }

    const classData = await prisma.class.findUnique({
      where: { id },
      include: {
        school: {
          select: {
            id: true,
            name: true,
            name_en: true,
            name_de: true,
            name_ar: true,
            address: true,
            deliveryType: true,
            isActive: true
          }
        },
        package: {
          include: {
            items: {
              select: {
                id: true,
                name: true,
                name_en: true,
                name_de: true,
                name_ar: true,
                quantity: true
                // price kasitli olarak dahil edilmiyor - veliye gosterilmeyecek
              }
            }
          }
        }
      }
    })

    if (!classData) {
      await recordFailedAttempt(rlIdentifier)
      return NextResponse.json(
        { error: t('veli.classNotFound') },
        { status: 404 }
      )
    }

    if (!classData.isActive) {
      return NextResponse.json(
        { error: t('veli.classInactive') },
        { status: 403 }
      )
    }

    if (!classData.school.isActive) {
      return NextResponse.json(
        { error: t('veli.schoolInactive') },
        { status: 403 }
      )
    }

    if (!classData.package) {
      return NextResponse.json(
        { error: t('veli.noClassPackage') },
        { status: 404 }
      )
    }

    // Basarili sorgu — meşru kullanıcı cezalandırılmasın
    await resetRateLimit(rlIdentifier)

    return NextResponse.json({
      id: classData.id,
      name: classData.name,
      name_en: classData.name_en,
      name_de: classData.name_de,
      name_ar: classData.name_ar,
      school: {
        id: classData.school.id,
        name: classData.school.name,
        name_en: classData.school.name_en,
        name_de: classData.school.name_de,
        name_ar: classData.school.name_ar,
        deliveryType: classData.school.deliveryType
      },
      package: {
        id: classData.package.id,
        name: classData.package.name,
        name_en: classData.package.name_en,
        name_de: classData.package.name_de,
        name_ar: classData.package.name_ar,
        description: classData.package.description,
        description_en: classData.package.description_en,
        description_de: classData.package.description_de,
        description_ar: classData.package.description_ar,
        note: classData.package.note,
        note_en: classData.package.note_en,
        note_de: classData.package.note_de,
        note_ar: classData.package.note_ar,
        price: classData.package.price,
        items: classData.package.items
      }
    })

  } catch (error) {
    console.error('Sinif bilgisi hatasi:', error)
    return NextResponse.json(
      { error: t('veli.genericError') },
      { status: 500 }
    )
  }
}
