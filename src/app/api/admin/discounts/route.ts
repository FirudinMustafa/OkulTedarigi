import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/auth'
import { logAction } from '@/lib/logger'
import { adminDiscountBodySchema, formatZodError } from '@/lib/validators'

export async function GET() {
  try {
    const session = await getAdminSession()
    if (!session) {
      return NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 401 })
    }

    const discounts = await prisma.discount.findMany({
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({ discounts })
  } catch (error) {
    console.error('Indirimler listelenemedi:', error)
    return NextResponse.json(
      { error: 'Indirimler yuklenemedi' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const session = await getAdminSession()
    if (!session) {
      return NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    const parsed = adminDiscountBodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: formatZodError(parsed.error) },
        { status: 400 }
      )
    }
    const { code, description, type, value, minAmount, maxDiscount, validFrom, validUntil, usageLimit } = parsed.data

    const existing = await prisma.discount.findUnique({
      where: { code }
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Bu indirim kodu zaten mevcut' },
        { status: 409 }
      )
    }

    const discount = await prisma.discount.create({
      data: {
        code,
        description: description || null,
        type,
        value,
        minAmount: minAmount ?? null,
        maxDiscount: maxDiscount ?? null,
        validFrom,
        validUntil,
        usageLimit: usageLimit ?? null
      }
    })

    await logAction({
      userId: session.id,
      userType: 'ADMIN',
      action: 'CREATE',
      entity: 'DISCOUNT',
      entityId: discount.id,
      details: { code: discount.code, type: discount.type }
    })

    return NextResponse.json({ discount })
  } catch (error) {
    console.error('Indirim olusturulamadi:', error)
    return NextResponse.json(
      { error: 'Indirim olusturulamadi' },
      { status: 500 }
    )
  }
}
