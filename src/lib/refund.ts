/**
 * CANCELLED bir siparisin parasini iade edip REFUNDED'a gecirir — TEK NOKTA.
 * Iptal talebi onayi (cancel-requests/[id]/process) ve "Iade Et" butonu (orders/[id]/refund)
 * bunu kullanir.
 *
 * Neden transaction + FOR UPDATE: iki admin/iki sekme ayni anda iade ederse ikincisi
 * birincinin bitmesini bekler, siparisi REFUNDED gorur ve PayNKolay'e ikinci iade
 * istegi GITMEZ (cift iade engellenir).
 *
 * Siparis, PayNKolay iadesi BASARILI olmadan REFUNDED yapilmaz; basarisizsa CANCELLED kalir
 * ve "Iade Et" ile tekrar denenebilir.
 */
import { prisma } from '@/lib/prisma'
import { refundOrderPayment } from '@/lib/paynkolay'
import { logAction } from '@/lib/logger'
import { sendCancellationConfirmation } from '@/lib/email'

export type RefundOutcome =
  | { ok: true; refundId: string | null; amount: number }
  | { ok: false; reason: 'notFound' }
  | { ok: false; reason: 'invalidState'; status: string }
  | { ok: false; reason: 'gatewayFailed'; message: string }

export async function refundCancelledOrder(orderId: string, adminId?: string): Promise<RefundOutcome> {
  const outcome = await prisma.$transaction(async (tx): Promise<RefundOutcome & { notify?: { email: string; orderNumber: string; parentName: string; locale: string | null } }> => {
    await tx.$queryRaw`SELECT id FROM orders WHERE id = ${orderId} FOR UPDATE`
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { cancelRequest: true }
    })
    if (!order) return { ok: false, reason: 'notFound' }
    if (order.status !== 'CANCELLED') return { ok: false, reason: 'invalidState', status: order.status }

    const amount = Number(order.totalAmount)
    let refundId: string | null = null
    // Tahsil edilmemis (paidAt yok) sipariste iade edilecek para yoktur
    if (order.paidAt) {
      const result = await refundOrderPayment(order)
      if (!result.success) {
        return { ok: false, reason: 'gatewayFailed', message: result.message || 'Iade basarisiz' }
      }
      refundId = result.refundId ?? null
      // Para iade edildi: DB commit'i basarisiz olsa bile iz kalsin
      await logAction({
        userId: adminId, userType: adminId ? 'ADMIN' : 'SYSTEM',
        action: 'REFUND_GATEWAY_OK', entity: 'ORDER', entityId: order.id,
        details: { orderNumber: order.orderNumber, amount, refundId }
      }).catch(() => {})
    }

    const now = new Date()
    await tx.order.update({
      where: { id: order.id },
      data: { status: 'REFUNDED', refundedAt: now }
    })

    let notify: { email: string; orderNumber: string; parentName: string; locale: string | null } | undefined
    if (order.cancelRequest && order.cancelRequest.status === 'APPROVED' && !order.cancelRequest.refundId) {
      await tx.cancelRequest.update({
        where: { id: order.cancelRequest.id },
        data: { refundId: refundId ?? `NOPAY_${order.orderNumber}`, refundAmount: order.paidAt ? amount : 0, refundedAt: now }
      })
      // Iptal talebiyle gelen sipariste veliye "iptal onaylandi + iade" maili ancak
      // iade gercekten yapildiktan sonra gonderilir.
      if (order.email) {
        notify = { email: order.email, orderNumber: order.orderNumber, parentName: order.parentName, locale: order.locale }
      }
    }

    return { ok: true, refundId, amount: order.paidAt ? amount : 0, notify }
  }, { timeout: 60_000, maxWait: 15_000 })

  if (outcome.ok && 'notify' in outcome && outcome.notify) {
    const n = outcome.notify
    sendCancellationConfirmation({
      email: n.email,
      orderNumber: n.orderNumber,
      parentName: n.parentName,
      refundAmount: outcome.amount > 0 ? outcome.amount : undefined,
      locale: (n.locale ?? undefined) as ('tr' | 'en' | 'de' | 'ar' | undefined)
    }).catch(err => console.error('[email] sendCancellationConfirmation hatasi:', err))
  }

  if (!outcome.ok) return outcome
  return { ok: true, refundId: outcome.refundId, amount: outcome.amount }
}
