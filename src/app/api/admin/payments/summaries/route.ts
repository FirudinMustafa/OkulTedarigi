import { NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth'
import { getPayoutSummaries } from '@/lib/commission'
import { getApiLocale } from '@/lib/api-locale'
import { getTranslations } from 'next-intl/server'

export async function GET() {
  const t = await getTranslations({ locale: await getApiLocale(), namespace: 'apiErrors' })
  try {
    const session = await getAdminSession()
    if (!session) {
      return NextResponse.json({ error: t('adminMisc.unauthorized') }, { status: 401 })
    }

    // Aktif okullar + hakedisi/odemesi olan pasif okullar (pasife alinan okulun
    // odenmemis veya fazla odenmis hakedisi listeden kaybolmasin).
    const all = await getPayoutSummaries()
    const summaries = all
      .filter(s => s.isActive || s.commission > 0 || s.paid > 0 || s.pendingPayments > 0)
      .map(s => ({
        id: s.id,
        name: s.name,
        isActive: s.isActive,
        commissionRate: s.commissionRate,
        totalOrders: s.totalOrders,
        totalStudents: s.totalStudents,
        totalRevenue: s.totalRevenue,
        commission: s.commission,
        paid: s.paid,
        pendingPayments: s.pendingPayments,
        pending: s.remaining,
        overpaid: s.overpaid,
      }))

    return NextResponse.json({ summaries })
  } catch (error) {
    console.error('Ozet hesaplanamadi:', error)
    return NextResponse.json(
      { error: t('adminMisc.summaryLoadFailed') },
      { status: 500 }
    )
  }
}
