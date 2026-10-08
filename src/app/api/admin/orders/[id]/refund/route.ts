import { NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth'
import { logAction } from '@/lib/logger'
import { refundCancelledOrder } from '@/lib/refund'
import { getApiLocale } from '@/lib/api-locale'
import { getTranslations } from 'next-intl/server'

/**
 * CANCELLED bir siparisi REFUNDED'a gecirir. Gercek bir odeme varsa (paidAt+paymentId)
 * PayNKolay'e GERCEK iade cagrisi yapar — admin panelindeki "Iade Et" butonunun tek
 * cagri noktasi. Iptal talebi onayinda iade basarisiz olduysa tekrar deneme de buradan
 * yapilir (siparis CANCELLED kalmistir).
 *
 * Iade + durum degisikligi lib/refund icinde siparis satiri kilitlenerek yapilir:
 * ayni anda iki istek gelirse ikincisi PayNKolay'e gitmeden reddedilir (cift iade yok).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const t = await getTranslations({ locale: await getApiLocale(), namespace: 'apiErrors' })
  try {
    const session = await getAdminSession()
    if (!session) {
      return NextResponse.json({ error: t('orders.unauthorized') }, { status: 401 })
    }

    const { id } = await params
    const outcome = await refundCancelledOrder(id, session.id)

    if (!outcome.ok) {
      if (outcome.reason === 'notFound') {
        return NextResponse.json({ error: t('orders.orderNotFound') }, { status: 404 })
      }
      if (outcome.reason === 'invalidState') {
        return NextResponse.json(
          { error: t('orders.transitionInvalid', { from: outcome.status ?? '?', to: 'REFUNDED' }) },
          { status: 400 }
        )
      }
      await logAction({
        userId: session.id,
        userType: 'ADMIN',
        action: 'REFUND_FAILED',
        entity: 'ORDER',
        entityId: id,
        details: { message: outcome.message }
      })
      return NextResponse.json(
        { error: outcome.message || t('orders.refundFailed') },
        { status: 502 }
      )
    }

    await logAction({
      userId: session.id,
      userType: 'ADMIN',
      action: 'REFUND',
      entity: 'ORDER',
      entityId: id,
      details: { amount: outcome.amount, refundId: outcome.refundId }
    })

    return NextResponse.json({ success: true, refundId: outcome.refundId })
  } catch (error) {
    console.error('Siparis iade edilemedi:', error)
    return NextResponse.json({ error: t('orders.refundFailed') }, { status: 500 })
  }
}
