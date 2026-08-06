import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkRateLimit, recordFailedAttempt, resetRateLimit } from '@/lib/rate-limit'
import { getClientIp } from '@/lib/security'
import { getApiLocale } from '@/lib/api-locale'
import { getTranslations } from 'next-intl/server'

// Siparis sorgulama (GET)
//
// NOT: Siparis OLUSTURMA artik POST /api/veli/checkout uzerinden yapilir
// (siparis yalnizca odeme basariliysa olusur). Bu route sadece sorgulama icindir.
//
// Guvenlik notu: orderNumber cryptographic random (32^8 ~= 1.1T) + IP rate-limit ile brute-force engellenir.
export async function GET(request: Request) {
  const t = await getTranslations({ locale: await getApiLocale(), namespace: 'apiErrors' })
  try {
    const { searchParams } = new URL(request.url)
    const orderNumber = searchParams.get('orderNumber')
    const orderId = searchParams.get('id')

    if (!orderNumber && !orderId) {
      return NextResponse.json(
        { error: t('veli.orderNumberRequired') },
        { status: 400 }
      )
    }

    // IP başına 30 sorgu / 5 dk — orderNumber brute-force koruması
    const ip = getClientIp(request)
    const rlIdentifier = `veli-order-get:${ip}`
    const rateLimitResult = await checkRateLimit(rlIdentifier, 30, 5)
    if (!rateLimitResult.allowed) {
      const waitMinutes = rateLimitResult.blockedUntil
        ? Math.ceil((rateLimitResult.blockedUntil.getTime() - Date.now()) / 60000)
        : 5
      return NextResponse.json(
        { error: t('veli.tooManyAttempts', { minutes: waitMinutes }) },
        { status: 429 }
      )
    }

    const order = await prisma.order.findUnique({
      where: orderNumber ? { orderNumber } : { id: orderId! },
      include: {
        class: {
          include: {
            school: {
              select: {
                name: true,
                deliveryType: true,
                isActive: true,
                showNameToParent: true
              }
            }
          }
        },
        package: {
          select: {
            name: true,
            price: true
          }
        },
        cancelRequest: {
          select: {
            id: true,
            status: true,
            adminNote: true,
            processedAt: true,
            reason: true
          }
        }
      }
    })

    if (!order) {
      // Yanlış sorgu — sayaç artsın (brute-force tespit)
      await recordFailedAttempt(rlIdentifier)
      return NextResponse.json(
        { error: t('veli.orderNotFound') },
        { status: 404 }
      )
    }

    // Başarılı sorgu — meşru kullanıcı cezalandırılmasın
    await resetRateLimit(rlIdentifier)

    // accessToken GET response'unda DONULMEZ (defense-in-depth):
    // orderNumber'i bilen 3. sahis (forward, screenshot, log) iptal yapamasin.
    // POST /api/veli/checkout response'unda zaten dondurulur — siparisi olusturan veli orada alir.
    return NextResponse.json({
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      parentName: order.parentName,
      studentName: order.studentName,
      totalAmount: order.totalAmount,
      paymentMethod: order.paymentMethod,
      // Okul adi sadece admin bu okul icin acikca izin verdiyse veliye dondurulur.
      schoolName: order.class.school.showNameToParent ? order.class.school.name : null,
      schoolActive: order.class.school.isActive,
      className: order.class.name,
      packageName: order.package?.name || 'N/A',
      deliveryType: order.class.school.deliveryType,
      trackingNo: order.trackingNo,
      invoiceNo: order.invoiceNo,
      invoicedAt: order.invoicedAt,
      discountCode: order.discountCode,
      discountAmount: order.discountAmount ? Number(order.discountAmount) : null,
      createdAt: order.createdAt,
      paidAt: order.paidAt,
      shippedAt: order.shippedAt,
      deliveredAt: order.deliveredAt,
      cancelRequest: order.cancelRequest ? {
        status: order.cancelRequest.status,
        adminNote: order.cancelRequest.adminNote,
        processedAt: order.cancelRequest.processedAt,
        reason: order.cancelRequest.reason
      } : null
    })

  } catch (error) {
    console.error('Siparis sorgulama hatasi:', error)
    return NextResponse.json(
      { error: t('veli.genericError') },
      { status: 500 }
    )
  }
}
