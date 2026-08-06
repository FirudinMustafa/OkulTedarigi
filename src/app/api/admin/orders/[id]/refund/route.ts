import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/auth'
import { logAction } from '@/lib/logger'
import { refundOrderPayment } from '@/lib/paynkolay'
import { getApiLocale } from '@/lib/api-locale'
import { getTranslations } from 'next-intl/server'

/**
 * CANCELLED bir siparisi REFUNDED'a gecirir. Gercek bir odeme varsa (paidAt+paymentId)
 * PayNKolay'e GERCEK iade cagrisi yapar — bu, admin panelindeki "Iade Et" butonunun
 * tek dogru cagiri noktasi olmali. Onceden bu buton dogrudan PUT {status:'REFUNDED'}
 * yapiyordu ve gercek parayi hic iade etmiyordu (sahte basari mesaji gosteriyordu).
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
    const order = await prisma.order.findUnique({ where: { id } })
    if (!order) {
      return NextResponse.json({ error: t('orders.orderNotFound') }, { status: 404 })
    }
    if (order.status !== 'CANCELLED') {
      return NextResponse.json(
        { error: t('orders.transitionInvalid', { from: order.status, to: 'REFUNDED' }) },
        { status: 400 }
      )
    }

    let refundId: string | undefined
    // Gercekten tahsil edilmemis (paidAt yok) bir sipariste iade edilecek para yoktur —
    // dogrudan REFUNDED'a gecirilir. Odenmisse GERCEK PayNKolay iadesi zorunludur.
    if (order.paidAt) {
      const refundResult = await refundOrderPayment(order)
      if (!refundResult.success) {
        await logAction({
          userId: session.id,
          userType: 'ADMIN',
          action: 'REFUND_FAILED',
          entity: 'ORDER',
          entityId: order.id,
          details: { orderNumber: order.orderNumber, message: refundResult.message }
        })
        return NextResponse.json(
          { error: refundResult.message || t('orders.refundFailed') },
          { status: 502 }
        )
      }
      refundId = refundResult.refundId
    }

    const now = new Date()
    const lockResult = await prisma.order.updateMany({
      where: { id, status: 'CANCELLED' },
      data: { status: 'REFUNDED', refundedAt: now }
    })
    if (lockResult.count === 0) {
      // Refund PayNKolay'de basariyla yapildi ama siparis bu arada baska yerden degisti —
      // parayi geri almiyoruz (zaten iade edildi), sadece durum guncellemesini atlıyoruz.
      return NextResponse.json({ error: t('orders.statusChangedByAnother') }, { status: 409 })
    }

    await logAction({
      userId: session.id,
      userType: 'ADMIN',
      action: 'REFUND',
      entity: 'ORDER',
      entityId: order.id,
      details: { orderNumber: order.orderNumber, amount: Number(order.totalAmount), refundId: refundId || null }
    })

    return NextResponse.json({ success: true, refundId: refundId || null })
  } catch (error) {
    console.error('Siparis iade edilemedi:', error)
    return NextResponse.json({ error: t('orders.refundFailed') }, { status: 500 })
  }
}
