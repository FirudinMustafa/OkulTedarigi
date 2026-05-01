import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { CANCELLABLE_STATUSES } from '@/lib/constants'
import { checkRateLimit, recordFailedAttempt, resetRateLimit } from '@/lib/rate-limit'
import { getClientIp, verifyOrderAccessToken } from '@/lib/security'
import { veliCancelRequestBodySchema, formatZodError } from '@/lib/validators'

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)
    const parsed = veliCancelRequestBodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: formatZodError(parsed.error) },
        { status: 400 }
      )
    }
    const { orderId, accessToken, reason } = parsed.data

    // IP başına 10 iptal talebi / 10 dk (spam koruması)
    const ip = getClientIp(request)
    const rlIdentifier = `veli-cancel:${ip}`
    const rateLimitResult = await checkRateLimit(rlIdentifier, 10, 10)
    if (!rateLimitResult.allowed) {
      const waitMinutes = rateLimitResult.blockedUntil
        ? Math.ceil((rateLimitResult.blockedUntil.getTime() - Date.now()) / 60000)
        : 10
      return NextResponse.json(
        { error: `Cok fazla istek. ${waitMinutes} dakika sonra tekrar deneyin.` },
        { status: 429 }
      )
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId }
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

    if (!CANCELLABLE_STATUSES.includes(order.status)) {
      return NextResponse.json(
        { error: 'Bu siparis artik iptal edilemez' },
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
            { error: `Reddedilen talepten sonra ${hoursLeft} saat beklemelisiniz.` },
            { status: 429 }
          )
        }
        await prisma.cancelRequest.delete({
          where: { id: existingRequest.id }
        })
      } else {
        return NextResponse.json(
          { error: 'Bu siparis icin zaten bir iptal talebi mevcut' },
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

    return NextResponse.json({
      success: true,
      cancelRequest
    })

  } catch (error) {
    console.error('Iptal talebi hatasi:', error)
    return NextResponse.json(
      { error: 'Iptal talebi olusturulamadi' },
      { status: 500 }
    )
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const orderId = searchParams.get('orderId')

    if (!orderId || orderId.length > 40) {
      return NextResponse.json(
        { error: 'Siparis ID gerekli' },
        { status: 400 }
      )
    }

    // IP başına 60 sorgu / 5 dk
    const ip = getClientIp(request)
    const rlIdentifier = `veli-cancel-get:${ip}`
    const rateLimitResult = await checkRateLimit(rlIdentifier, 60, 5)
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'Cok fazla istek. Lutfen biraz bekleyin.' },
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
      { error: 'Iptal talebi sorgulanamadi' },
      { status: 500 }
    )
  }
}
