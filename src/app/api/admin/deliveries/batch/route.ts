import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/auth'
import { logAction } from '@/lib/logger'
import { autoInvoiceOrderOnComplete } from '@/lib/auto-invoice'
import { getApiLocale } from '@/lib/api-locale'
import { getTranslations } from 'next-intl/server'

interface BatchResult {
  orderId: string
  orderNumber: string
  success: boolean
  error?: string
}

// Toplu durum gecisleri (yeni 4-asamali model). Veliye mail GONDERILMEZ.
//   SCHOOL_DISPATCH : Okula Teslim Et   — SCHOOL_DELIVERY, CONFIRMED -> SHIPPED (Dagitimda)
//   COMPLETED       : Tamamlandi        — SHIPPED -> COMPLETED
//   UNDELIVERED     : Teslim Edilemeyen — SHIPPED -> UNDELIVERED
//   REDISPATCH      : Tekrar Dagitima   — UNDELIVERED -> SHIPPED
export async function POST(request: Request) {
  const t = await getTranslations({ locale: await getApiLocale(), namespace: 'apiErrors' })
  try {
    const session = await getAdminSession()
    if (!session) {
      return NextResponse.json({ error: t('orders.unauthorized') }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: t('orders.invalidRequest') }, { status: 400 })
    }
    const { orderIds, action } = body

    if (!Array.isArray(orderIds) || orderIds.length === 0 || orderIds.length > 500) {
      return NextResponse.json({ error: t('orders.idListRequired500') }, { status: 400 })
    }
    if (!orderIds.every(id => typeof id === 'string' && id.length > 0 && id.length <= 40)) {
      return NextResponse.json({ error: t('orders.invalidOrderId') }, { status: 400 })
    }

    const validActions = ['CONFIRM', 'SCHOOL_DISPATCH', 'COMPLETED', 'UNDELIVERED', 'REDISPATCH']
    if (!validActions.includes(action)) {
      return NextResponse.json({ error: t('orders.invalidAction') }, { status: 400 })
    }

    const orders = await prisma.order.findMany({
      where: { id: { in: orderIds } },
      include: { class: { include: { school: true } } }
    })

    const results: BatchResult[] = []

    for (const order of orders) {
      try {
        const deliveryType = order.class.school.deliveryType
        let canUpdate = false
        const fromStatus = order.status
        const updateData: Record<string, unknown> = {}

        if (action === 'CONFIRM') {
          canUpdate = order.status === 'PAID'
          updateData.status = 'CONFIRMED'
          updateData.confirmedAt = new Date()
        } else if (action === 'SCHOOL_DISPATCH') {
          canUpdate = deliveryType === 'SCHOOL_DELIVERY' && order.status === 'CONFIRMED'
          updateData.status = 'SHIPPED'
          updateData.shippedAt = new Date()
        } else if (action === 'COMPLETED') {
          canUpdate = order.status === 'SHIPPED'
          updateData.status = 'COMPLETED'
          updateData.deliveredAt = new Date()
        } else if (action === 'UNDELIVERED') {
          canUpdate = order.status === 'SHIPPED'
          updateData.status = 'UNDELIVERED'
        } else if (action === 'REDISPATCH') {
          canUpdate = order.status === 'UNDELIVERED'
          updateData.status = 'SHIPPED'
          updateData.shippedAt = new Date()
        }

        if (!canUpdate) {
          results.push({
            orderId: order.id,
            orderNumber: order.orderNumber,
            success: false,
            error: t('orders.notEligibleForAction', { action, status: order.status })
          })
          continue
        }

        // Atomic: yalnizca durumu hala beklenen degerdeyken guncelle
        const upd = await prisma.order.updateMany({
          where: { id: order.id, status: fromStatus },
          data: updateData
        })
        if (upd.count === 0) {
          results.push({
            orderId: order.id,
            orderNumber: order.orderNumber,
            success: false,
            error: t('orders.statusChanged')
          })
          continue
        }

        results.push({ orderId: order.id, orderNumber: order.orderNumber, success: true })

        await logAction({
          userId: session.id,
          userType: 'ADMIN',
          action: 'BATCH_DELIVERY_UPDATE',
          entity: 'ORDER',
          entityId: order.id,
          details: { orderNumber: order.orderNumber, action, newStatus: updateData.status, batchOperation: true }
        })

        // COMPLETED gecisinde otomatik fatura (idempotent, best-effort — bkz. src/lib/auto-invoice.ts;
        // tekli PUT route'uyla ayni davranis, toplu teslimat da fatura tetiklemeli).
        if (action === 'COMPLETED' && !order.invoiceNo) {
          await autoInvoiceOrderOnComplete(order.id, session.id)
        }
      } catch (error) {
        results.push({
          orderId: order.id,
          orderNumber: order.orderNumber,
          success: false,
          error: error instanceof Error ? error.message : t('orders.unknownError')
        })
      }
    }

    const successCount = results.filter(r => r.success).length
    const failCount = results.filter(r => !r.success).length

    await logAction({
      userId: session.id,
      userType: 'ADMIN',
      action: 'BATCH_DELIVERY_COMPLETED',
      entity: 'ORDER',
      details: {
        action,
        totalOrders: orders.length,
        successCount,
        failCount,
        orderIds: results.filter(r => r.success).map(r => r.orderId)
      }
    })

    const actionLabel = t(`orders.actionLabels.${action}` as 'orders.actionLabels.CONFIRM')

    return NextResponse.json({
      success: true,
      message: t('orders.batchDeliveryResult', { success: successCount, action: actionLabel, failed: failCount }),
      results,
      summary: { total: orders.length, success: successCount, failed: failCount }
    })

  } catch (error) {
    console.error('Toplu teslimat guncelleme hatasi:', error)
    return NextResponse.json({ error: t('orders.batchDeliveryFailed') }, { status: 500 })
  }
}
