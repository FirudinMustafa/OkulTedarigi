import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkRateLimit, recordFailedAttempt, resetRateLimit } from '@/lib/rate-limit'
import { getClientIp } from '@/lib/security'
import { veliDiscountBodySchema, formatZodError } from '@/lib/validators'

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)
    const parsed = veliDiscountBodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: formatZodError(parsed.error) },
        { status: 400 }
      )
    }
    const { code, totalAmount } = parsed.data

    // Discount code enumeration koruması: IP başına 20 deneme / 5 dk
    const ip = getClientIp(request)
    const rlIdentifier = `veli-discount:${ip}`
    const rateLimitResult = await checkRateLimit(rlIdentifier, 20, 5)
    if (!rateLimitResult.allowed) {
      const waitMinutes = rateLimitResult.blockedUntil
        ? Math.ceil((rateLimitResult.blockedUntil.getTime() - Date.now()) / 60000)
        : 5
      return NextResponse.json(
        { error: `Cok fazla deneme. ${waitMinutes} dakika sonra tekrar deneyin.` },
        { status: 429 }
      )
    }

    const discount = await prisma.discount.findUnique({
      where: { code }
    })

    if (!discount) {
      await recordFailedAttempt(rlIdentifier)
      return NextResponse.json(
        { error: 'Gecersiz indirim kodu' },
        { status: 404 }
      )
    }

    if (!discount.isActive) {
      await recordFailedAttempt(rlIdentifier)
      return NextResponse.json(
        { error: 'Bu indirim kodu artik gecerli degil' },
        { status: 400 }
      )
    }

    const now = new Date()
    if (now < discount.validFrom || now > discount.validUntil) {
      await recordFailedAttempt(rlIdentifier)
      return NextResponse.json(
        { error: 'Bu indirim kodunun gecerlilik suresi dolmus' },
        { status: 400 }
      )
    }

    if (discount.usageLimit && discount.usedCount >= discount.usageLimit) {
      return NextResponse.json(
        { error: 'Bu indirim kodu kullanim limitine ulasmis' },
        { status: 400 }
      )
    }

    const amount = totalAmount ? Number(totalAmount) : 0

    if (discount.minAmount && amount < Number(discount.minAmount)) {
      return NextResponse.json(
        { error: `Bu indirim kodu en az ${Number(discount.minAmount).toFixed(2)} TL siparis tutari gerektirir` },
        { status: 400 }
      )
    }

    let discountAmount = 0
    if (discount.type === 'PERCENTAGE') {
      discountAmount = amount * Number(discount.value) / 100
      if (discount.maxDiscount && discountAmount > Number(discount.maxDiscount)) {
        discountAmount = Number(discount.maxDiscount)
      }
    } else {
      discountAmount = Number(discount.value)
    }

    if (discountAmount > amount) {
      discountAmount = amount
    }

    // Geçerli kod bulundu — meşru kullanıcı cezalandırılmasın
    await resetRateLimit(rlIdentifier)

    return NextResponse.json({
      valid: true,
      discount: {
        code: discount.code,
        description: discount.description,
        type: discount.type,
        value: Number(discount.value),
        discountAmount: Math.round(discountAmount * 100) / 100
      }
    })

  } catch (error) {
    console.error('Indirim kodu dogrulama hatasi:', error)
    return NextResponse.json(
      { error: 'Bir hata olustu' },
      { status: 500 }
    )
  }
}
