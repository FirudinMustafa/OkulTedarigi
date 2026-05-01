import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkRateLimit, recordFailedAttempt, resetRateLimit } from '@/lib/rate-limit'
import { getClientIp } from '@/lib/security'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!id || typeof id !== 'string' || id.length > 40) {
      return NextResponse.json({ error: 'Gecersiz sinif kimligi' }, { status: 400 })
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
        { error: `Cok fazla istek. ${waitMinutes} dakika sonra tekrar deneyin.` },
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
        { error: 'Sinif bulunamadi' },
        { status: 404 }
      )
    }

    if (!classData.isActive) {
      return NextResponse.json(
        { error: 'Bu sinif aktif degil' },
        { status: 403 }
      )
    }

    if (!classData.school.isActive) {
      return NextResponse.json(
        { error: 'Bu okul aktif degil' },
        { status: 403 }
      )
    }

    if (!classData.package) {
      return NextResponse.json(
        { error: 'Bu sinif icin paket tanimlanmamis' },
        { status: 404 }
      )
    }

    // Basarili sorgu — meşru kullanıcı cezalandırılmasın
    await resetRateLimit(rlIdentifier)

    return NextResponse.json({
      id: classData.id,
      name: classData.name,
      school: {
        id: classData.school.id,
        name: classData.school.name,
        deliveryType: classData.school.deliveryType
      },
      package: {
        id: classData.package.id,
        name: classData.package.name,
        description: classData.package.description,
        note: classData.package.note,
        price: classData.package.price,
        items: classData.package.items
      }
    })

  } catch (error) {
    console.error('Sinif bilgisi hatasi:', error)
    return NextResponse.json(
      { error: 'Bir hata olustu' },
      { status: 500 }
    )
  }
}
