import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { processPayment } from '@/lib/iyzico'
import { sendPaymentConfirmation } from '@/lib/email'
import { sendSMS } from '@/lib/sms'
import { logAction } from '@/lib/logger'
import { checkRateLimit, recordFailedAttempt, resetRateLimit } from '@/lib/rate-limit'
import { getClientIp, verifyOrderAccessToken } from '@/lib/security'
import { veliPaymentBodySchema, formatZodError } from '@/lib/validators'

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)
    const parsed = veliPaymentBodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: formatZodError(parsed.error) },
        { status: 400 }
      )
    }
    const { orderId, orderNumber, accessToken, cardNumber, cardHolder, expiry, cvv } = parsed.data

    // IP başına 10 ödeme denemesi / 10 dk
    const ip = getClientIp(request)
    const rlIdentifier = `veli-payment:${ip}`
    const rateLimitResult = await checkRateLimit(rlIdentifier, 10, 10)
    if (!rateLimitResult.allowed) {
      const waitMinutes = rateLimitResult.blockedUntil
        ? Math.ceil((rateLimitResult.blockedUntil.getTime() - Date.now()) / 60000)
        : 10
      return NextResponse.json(
        { error: `Cok fazla odeme denemesi. ${waitMinutes} dakika sonra tekrar deneyin.` },
        { status: 429 }
      )
    }

    const order = await prisma.order.findUnique({
      where: orderId ? { id: orderId } : { orderNumber: orderNumber as string },
      include: {
        class: {
          include: { school: true }
        }
      }
    })

    if (!order) {
      await recordFailedAttempt(rlIdentifier)
      return NextResponse.json(
        { error: 'Siparis bulunamadi' },
        { status: 404 }
      )
    }

    // F-04: Defense-in-depth — accessToken doğrulaması
    if (!verifyOrderAccessToken(order.id, accessToken)) {
      await recordFailedAttempt(rlIdentifier)
      return NextResponse.json(
        { error: 'Bu siparise erisim yetkiniz yok' },
        { status: 403 }
      )
    }

    if (order.status !== 'PAYMENT_PENDING' || order.paymentId) {
      await recordFailedAttempt(rlIdentifier)
      return NextResponse.json(
        { error: 'Bu siparis icin odeme yapilamaz' },
        { status: 400 }
      )
    }

    const paymentResult = await processPayment({
      amount: Number(order.totalAmount),
      currency: 'TRY',
      cardNumber,
      cardHolder,
      expiry,
      cvv,
      orderId: order.id,
      orderNumber: order.orderNumber,
      buyerName: order.parentName,
      buyerEmail: order.email || '',
      buyerPhone: order.phone
    })

    if (!paymentResult.success) {
      await recordFailedAttempt(rlIdentifier)
      return NextResponse.json(
        { error: paymentResult.errorMessage || 'Odeme islemi basarisiz' },
        { status: 400 }
      )
    }

    const paymentId: string = paymentResult.paymentId || `PAY_${Date.now()}`

    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: 'PAID',
        paymentId,
        paymentMethod: 'CREDIT_CARD',
        paidAt: new Date()
      }
    })

    // Başarılı ödeme — sayaç sıfırlansın
    await resetRateLimit(rlIdentifier)

    // Sensitive data (PAN, CVV) ASLA loglanmamali
    await logAction({
      action: 'PAYMENT_PROCESSED',
      entity: 'ORDER',
      entityId: order.id,
      ipAddress: ip,
      details: { orderNumber: order.orderNumber, paymentId, amount: Number(order.totalAmount) }
    })

    try {
      await Promise.all([
        order.email ? sendPaymentConfirmation({
          email: order.email,
          orderNumber: order.orderNumber,
          parentName: order.parentName,
          totalAmount: Number(order.totalAmount)
        }) : Promise.resolve(),
        sendSMS({
          to: order.phone,
          message: `${order.orderNumber} no'lu siparisini aldik. Odeme basarili. Tesekkurler!`
        })
      ])
    } catch (notifError) {
      console.error('Bildirim gonderilemedi:', notifError)
    }

    return NextResponse.json({
      success: true,
      paymentId,
      message: 'Odeme basariyla tamamlandi'
    })

  } catch (error) {
    console.error('Odeme hatasi:', error)
    return NextResponse.json(
      { error: 'Odeme islemi sirasinda bir hata olustu' },
      { status: 500 }
    )
  }
}
