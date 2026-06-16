import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/auth'
import { logAction } from '@/lib/logger'
import { z } from 'zod'
import { NO_HTML_REGEX, NO_HTML_MSG } from '@/lib/validators'
import { buildTranslationData } from '@/lib/i18n-content'
import { getApiLocale } from '@/lib/api-locale'
import { getTranslations } from 'next-intl/server'

// validUntil: gun sonuna ayarla (UTC midnight girilirse 23:59:59.999'a yuvarla)
function isMidnightUTC(d: Date): boolean {
  return d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0
}
const validUntilUpdateSchema = z.coerce.date().transform(d => {
  if (isMidnightUTC(d)) {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999))
  }
  return d
})

const adminDiscountUpdateSchema = z.object({
  code: z.string().trim().toUpperCase().min(3).max(40).regex(/^[A-Z0-9_-]+$/).optional(),
  description: z.string().trim().max(500).regex(NO_HTML_REGEX, NO_HTML_MSG).nullable().optional(),
  type: z.enum(['PERCENTAGE', 'FIXED']).optional(),
  value: z.coerce.number().positive().optional(),
  minAmount: z.coerce.number().nonnegative().nullable().optional(),
  maxDiscount: z.coerce.number().positive().nullable().optional(),
  validFrom: z.coerce.date().optional(),
  validUntil: validUntilUpdateSchema.optional(),
  usageLimit: z.coerce.number().int().positive().nullable().optional(),
  isActive: z.boolean().optional(),
}).refine(
  data => !data.validFrom || !data.validUntil || data.validFrom < data.validUntil,
  { message: 'Bitis tarihi baslangic tarihinden sonra olmali', path: ['validUntil'] }
).refine(
  data => data.type !== 'PERCENTAGE' || data.value === undefined || (data.value > 0 && data.value <= 100),
  { message: 'Yuzde indirim 0 ile 100 arasinda olmali', path: ['value'] }
)

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const t = await getTranslations({ locale: await getApiLocale(), namespace: 'apiErrors' })
  try {
    const session = await getAdminSession()
    if (!session) {
      return NextResponse.json({ error: t('adminMisc.unauthorized') }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json().catch(() => null)
    const parsed = adminDiscountUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || t('adminMisc.invalidData') },
        { status: 400 }
      )
    }

    const updateData = parsed.data as Record<string, unknown>

    // Cevrilebilir aciklama alanlari (validator strict olmadigi icin raw body'den okunur).
    // Sadece istekte gonderilen ceviri kolonlari guncellenir (kismi update'lerde uzerine yazilmaz).
    const rawBody = (body ?? {}) as Record<string, unknown>
    const hasTranslation =
      'description_en' in rawBody || 'description_de' in rawBody || 'description_ar' in rawBody
    if (hasTranslation) {
      const descriptionTranslations = buildTranslationData('description', {
        en: typeof rawBody.description_en === 'string' ? rawBody.description_en : null,
        de: typeof rawBody.description_de === 'string' ? rawBody.description_de : null,
        ar: typeof rawBody.description_ar === 'string' ? rawBody.description_ar : null,
      })
      Object.assign(updateData, descriptionTranslations)
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: t('adminMisc.noFieldsToUpdate') }, { status: 400 })
    }

    const discount = await prisma.discount.update({
      where: { id },
      data: updateData
    })

    await logAction({
      userId: session.id,
      userType: 'ADMIN',
      action: 'UPDATE',
      entity: 'DISCOUNT',
      entityId: discount.id,
      details: { code: discount.code }
    })

    return NextResponse.json({ discount })
  } catch (error) {
    console.error('Indirim guncellenemedi:', error)
    return NextResponse.json(
      { error: t('adminMisc.discountUpdateFailed') },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const t = await getTranslations({ locale: await getApiLocale(), namespace: 'apiErrors' })
  try {
    const session = await getAdminSession()
    if (!session) {
      return NextResponse.json({ error: t('adminMisc.unauthorized') }, { status: 401 })
    }

    const { id } = await params

    const discount = await prisma.discount.findUnique({ where: { id } })
    if (!discount) {
      return NextResponse.json({ error: t('adminMisc.discountNotFound') }, { status: 404 })
    }

    await prisma.discount.delete({ where: { id } })

    await logAction({
      userId: session.id,
      userType: 'ADMIN',
      action: 'DELETE',
      entity: 'DISCOUNT',
      entityId: id,
      details: { code: discount.code }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Indirim silinemedi:', error)
    return NextResponse.json(
      { error: t('adminMisc.discountDeleteFailed') },
      { status: 500 }
    )
  }
}
