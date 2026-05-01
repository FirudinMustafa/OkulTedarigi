import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkRateLimit, recordFailedAttempt, resetRateLimit } from '@/lib/rate-limit'
import { getClientIp } from '@/lib/security'
import { veliVerifyPasswordBodySchema, formatZodError } from '@/lib/validators'

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)
    const parsed = veliVerifyPasswordBodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: formatZodError(parsed.error) },
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
        { error: `Cok fazla deneme. ${waitMinutes} dakika sonra tekrar deneyin.` },
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
                description: true,
                note: true,
                price: true,
                items: {
                  select: {
                    id: true,
                    name: true,
                    quantity: true
                    // Fiyat veliye gosterilmez
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
        { error: 'Gecersiz sifre. Lutfen okulunuzdan aldiginiz sifrenizi kontrol edin.' },
        { status: 401 }
      )
    }

    // Aktif siniflar ve paketleri kontrol et
    const classesWithPackages = school.classes.filter(c => c.package !== null)

    if (classesWithPackages.length === 0) {
      return NextResponse.json(
        { error: 'Bu okul icin henuz aktif bir sinif ve paket tanimlanmamis.' },
        { status: 404 }
      )
    }

    // Basarili giris - sadece kisa-vade limiti sifirla; uzun-vade saldırı tespiti devam etsin
    await resetRateLimit(rlShort)

    return NextResponse.json({
      success: true,
      schoolId: school.id,
      schoolName: school.name,
      deliveryType: school.deliveryType,
      classes: classesWithPackages.map(c => ({
        id: c.id,
        name: c.name,
        package: c.package ? {
          id: c.package.id,
          name: c.package.name,
          description: c.package.description,
          note: c.package.note,
          price: c.package.price,
          items: c.package.items
        } : null
      }))
    })

  } catch (error) {
    console.error('Sifre dogrulama hatasi:', error)
    return NextResponse.json(
      { error: 'Bir hata olustu. Lutfen tekrar deneyin.' },
      { status: 500 }
    )
  }
}
