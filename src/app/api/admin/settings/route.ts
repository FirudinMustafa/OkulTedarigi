import { NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth'
import { getPaymentCommissionRate, setSetting, SETTING_KEYS } from '@/lib/settings'
import { logAction } from '@/lib/logger'
import { getApiLocale } from '@/lib/api-locale'
import { getTranslations } from 'next-intl/server'
import { z } from 'zod'

const settingsUpdateSchema = z.object({
  paymentCommissionRate: z.coerce.number().min(0).max(100),
})

export async function GET() {
  const t = await getTranslations({ locale: await getApiLocale(), namespace: 'apiErrors' })
  try {
    const session = await getAdminSession()
    if (!session) {
      return NextResponse.json({ error: t('adminMisc.unauthorized') }, { status: 401 })
    }
    const paymentCommissionRate = await getPaymentCommissionRate()
    return NextResponse.json(
      { paymentCommissionRate },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    console.error('Ayarlar okunamadi:', error)
    return NextResponse.json({ error: t('adminMisc.reportLoadFailed') }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  const t = await getTranslations({ locale: await getApiLocale(), namespace: 'apiErrors' })
  try {
    const session = await getAdminSession()
    if (!session) {
      return NextResponse.json({ error: t('adminMisc.unauthorized') }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    const parsed = settingsUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: t('catalog.invalidRequest') }, { status: 400 })
    }

    const rate = parsed.data.paymentCommissionRate
    await setSetting(SETTING_KEYS.PAYMENT_COMMISSION_RATE, String(rate))

    await logAction({
      userId: session.id,
      userType: 'ADMIN',
      action: 'UPDATE',
      entity: 'SETTING',
      entityId: SETTING_KEYS.PAYMENT_COMMISSION_RATE,
      details: { paymentCommissionRate: rate },
    })

    return NextResponse.json(
      { paymentCommissionRate: rate },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    console.error('Ayar guncellenemedi:', error)
    return NextResponse.json({ error: t('adminMisc.reportLoadFailed') }, { status: 500 })
  }
}
