import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/auth'
import { logAction } from '@/lib/logger'
import { adminDiscountBodySchema, formatZodError } from '@/lib/validators'
import { buildTranslationData } from '@/lib/i18n-content'
import { getApiLocale } from '@/lib/api-locale'
import { getTranslations } from 'next-intl/server'

export async function GET() {
  const t = await getTranslations({ locale: await getApiLocale(), namespace: 'apiErrors' })
  try {
    const session = await getAdminSession()
    if (!session) {
      return NextResponse.json({ error: t('adminMisc.unauthorized') }, { status: 401 })
    }

    const discounts = await prisma.discount.findMany({
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({ discounts })
  } catch (error) {
    console.error('Indirimler listelenemedi:', error)
    return NextResponse.json(
      { error: t('adminMisc.discountsLoadFailed') },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const t = await getTranslations({ locale: await getApiLocale(), namespace: 'apiErrors' })
  try {
    const session = await getAdminSession()
    if (!session) {
      return NextResponse.json({ error: t('adminMisc.unauthorized') }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    const parsed = adminDiscountBodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: formatZodError(parsed.error, await getApiLocale()) },
        { status: 400 }
      )
    }
    const { code, description, type, value, minAmount, maxDiscount, validFrom, validUntil, usageLimit } = parsed.data
    // Cevrilebilir aciklama alanlari (validator strict olmadigi icin raw body'den okunur)
    const rawBody = (body ?? {}) as Record<string, unknown>
    const descriptionTranslations = buildTranslationData('description', {
      en: typeof rawBody.description_en === 'string' ? rawBody.description_en : null,
      de: typeof rawBody.description_de === 'string' ? rawBody.description_de : null,
      ar: typeof rawBody.description_ar === 'string' ? rawBody.description_ar : null,
    })

    const existing = await prisma.discount.findUnique({
      where: { code }
    })

    if (existing) {
      return NextResponse.json(
        { error: t('adminMisc.discountExists') },
        { status: 409 }
      )
    }

    const discount = await prisma.discount.create({
      data: {
        code,
        description: description || null,
        ...descriptionTranslations,
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
      { error: t('adminMisc.discountCreateFailed') },
      { status: 500 }
    )
  }
}
