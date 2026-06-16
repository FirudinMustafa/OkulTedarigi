import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { CANCELLABLE_STATUSES } from '@/lib/constants'
import { checkRateLimit, recordFailedAttempt, resetRateLimit } from '@/lib/rate-limit'
import { getClientIp, verifyOrderAccessToken } from '@/lib/security'
import { veliCancelRequestBodySchema, formatZodError } from '@/lib/validators'
import { sendAdminNewCancelRequest } from '@/lib/email'
import { getApiLocale } from '@/lib/api-locale'
import { getTranslations } from 'next-intl/server'

export async function POST(request: Request) {
  const t = await getTranslations({ locale: await getApiLocale(), namespace: 'apiErrors' })
  try {
    const body = await request.json().catch(() => null)
    const parsed = veliCancelRequestBodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: formatZodError(parsed.error, await getApiLocale()) },
        { status: 400 }
      )
    }
    const { orderId, accessToken, phoneLast4, reason } = parsed.data

    // IP başına 10 iptal talebi / 10 dk (spam koruması)
    const ip = getClientIp(request)
    const rlIdentifier = `veli-cancel:${ip}`
    const rateLimitResult = await checkRateLimit(rlIdentifier, 10, 10)
    if (!rateLimitResult.allowed) {
      const waitMinutes = rateLimitResult.blockedUntil
        ? Math.ceil((rateLimitResult.blockedUntil.getTime() - Date.now()) / 60000)
        : 10
      return NextResponse.json(
        { error: t('veli.tooManyRequests', { minutes: waitMinutes }) },
        { status: 429 }
      )
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { class: { include: { school: { select: { name: true } } } } }
    })

    if (!order) {
      await recordFailedAttempt(rlIdentifier)
      return NextResponse.json(
        { error: t('veli.orderNotFound') },
        { status: 404 }
      )
    }

    // Kimlik dogrulama: accessToken (POST yaratandan) VEYA phoneLast4 (takip sayfasindan)
    let authorized = false
    if (accessToken && verifyOrderAccessToken(order.id, accessToken)) {
      authorized = true
    } else if (phoneLast4) {
      const phoneDigits = String(order.phone || '').replace(/\D/g, '')
      const orderLast4 = phoneDigits.slice(-4)
      if (orderLast4.length === 4 && orderLast4 === phoneLast4) {
        authorized = true
      }
    }
    if (!authorized) {
      await recordFailedAttempt(rlIdentifier)
      return NextResponse.json(
        { error: t('veli.authFailed') },
        { status: 403 }
      )
    }

    if (!CANCELLABLE_STATUSES.includes(order.status)) {
      return NextResponse.json(
        { error: t('veli.orderNotCancellable') },
        { status: 400 }
      )
    }

    const existingRequest = await prisma.cancelRequest.findUnique({
      where: { orderId }
    })

    if (existingRequest) {
      if (existingRequest.status === 'REJECTED') {
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
        if (existingRequest.processedAt && existingRequest.processedAt > since) {
          const hoursLeft = Math.ceil(
            (existingRequest.processedAt.getTime() + 24 * 60 * 60 * 1000 - Date.now()) / (60 * 60 * 1000)
          )
          return NextResponse.json(
            { error: t('veli.cancelRejectedWait', { hours: hoursLeft }) },
            { status: 429 }
          )
        }
        await prisma.cancelRequest.delete({
          where: { id: existingRequest.id }
        })
      } else {
        return NextResponse.json(
          { error: t('veli.cancelRequestExists') },
          { status: 400 }
        )
      }
    }

    const cancelRequest = await prisma.cancelRequest.create({
      data: {
        orderId,
        reason,
        status: 'PENDING'
      }
    })

    // Başarılı talep — sayaç sıfırlansın
    await resetRateLimit(rlIdentifier)

    // Admine bilgi maili (best-effort, transaction'i bozmaz)
    const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL
    if (adminEmail) {
      sendAdminNewCancelRequest({
        adminEmail,
        orderNumber: order.orderNumber,
        parentName: order.parentName,
        schoolName: order.class.school.name,
        totalAmount: Number(order.totalAmount),
        reason: reason || 'Belirtilmedi'
      }).catch(err => console.error('[email] sendAdminNewCancelRequest hatasi:', err))
    }

    return NextResponse.json({
      success: true,
      cancelRequest
    })

  } catch (error) {
    console.error('Iptal talebi hatasi:', error)
    return NextResponse.json(
      { error: t('veli.cancelRequestFailed') },
      { status: 500 }
    )
  }
}

export async function GET(request: Request) {
  const t = await getTranslations({ locale: await getApiLocale(), namespace: 'apiErrors' })
  try {
    const { searchParams } = new URL(request.url)
    const orderId = searchParams.get('orderId')

    if (!orderId || orderId.length > 40) {
      return NextResponse.json(
        { error: t('veli.orderIdRequired') },
        { status: 400 }
      )
    }

    // IP başına 60 sorgu / 5 dk
    const ip = getClientIp(request)
    const rlIdentifier = `veli-cancel-get:${ip}`
    const rateLimitResult = await checkRateLimit(rlIdentifier, 60, 5)
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: t('veli.tooManyRequestsWait') },
        { status: 429 }
      )
    }

    const cancelRequest = await prisma.cancelRequest.findUnique({
      where: { orderId }
    })

    return NextResponse.json({ cancelRequest })

  } catch (error) {
    console.error('Iptal talebi sorgulama hatasi:', error)
    return NextResponse.json(
      { error: t('veli.cancelRequestQueryFailed') },
      { status: 500 }
    )
  }
}
