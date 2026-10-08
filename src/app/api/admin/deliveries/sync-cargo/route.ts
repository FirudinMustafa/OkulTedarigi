import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/auth'
import { logAction } from '@/lib/logger'
import { getTrackingInfo } from '@/lib/yurtici-kargo'
import { autoInvoiceOrderOnComplete } from '@/lib/auto-invoice'
import { OrderStatus } from '@prisma/client'
import { getApiLocale } from '@/lib/api-locale'
import { getTranslations } from 'next-intl/server'

interface SyncResult {
  orderId: string
  orderNumber: string
  trackingNo: string
  previousStatus: string
  newStatus: OrderStatus | null
  cargoStatus: string
  updated: boolean
  error?: string
}

export async function POST(request: Request) {
  const t = await getTranslations({ locale: await getApiLocale(), namespace: 'apiErrors' })
  try {
    const session = await getAdminSession()
    if (!session) {
      return NextResponse.json({ error: t('orders.unauthorized') }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const { orderIds } = body // Opsiyonel - belirtilmezse tum kargodakiler sorgulanir

    // SHIPPED durumundaki siparisleri getir
    const whereClause: Record<string, unknown> = {
      status: 'SHIPPED',
      trackingNo: { not: null }
    }

    if (orderIds && Array.isArray(orderIds) && orderIds.length > 0) {
      whereClause.id = { in: orderIds }
    }

    const orders = await prisma.order.findMany({
      where: whereClause,
      select: {
        id: true,
        orderNumber: true,
        trackingNo: true,
        status: true,
        invoiceNo: true
      }
    })

    if (orders.length === 0) {
      return NextResponse.json({
        success: true,
        message: t('orders.noCargoToQuery'),
        results: [],
        summary: { total: 0, updated: 0, noChange: 0, errors: 0 }
      })
    }

    const results: SyncResult[] = []

    for (const order of orders) {
      if (!order.trackingNo) continue

      try {
        // Kargo durumunu sorgula
        const trackingInfo = await getTrackingInfo(order.trackingNo)

        let newStatus: OrderStatus | null = null

        // Kargo durumuna gore siparis durumunu belirle
        // Yurtici Kargo status kodlari (yurtici-kargo.ts uretir):
        // - TESLIM_EDILDI: Teslim edildi (deliveryDate dolu veya "Teslim Edildi")
        // - IN_TRANSIT: Dagitimda / yolda
        // Teslim edilen kargo dogrudan COMPLETED olur: "Tamamlandi" butonuyla ayni sonuc
        // (DELIVERED hicbir sekmede/aksiyonda yer almadigi icin siparis takilip kaliyor ve
        // otomatik e-fatura hic kesilmiyordu).
        if (['TESLIM_EDILDI', 'DELIVERED'].includes(trackingInfo.statusCode)) {
          newStatus = OrderStatus.COMPLETED
        }

        if (newStatus && newStatus !== order.status) {
          // Atomic: yalnizca hala SHIPPED ise guncelle (bu arada degisen siparise dokunma)
          const upd = await prisma.order.updateMany({
            where: { id: order.id, status: 'SHIPPED' },
            data: {
              status: newStatus,
              deliveredAt: new Date()
            }
          })
          if (upd.count === 0) {
            results.push({
              orderId: order.id,
              orderNumber: order.orderNumber,
              trackingNo: order.trackingNo,
              previousStatus: order.status,
              newStatus: null,
              cargoStatus: trackingInfo.status,
              updated: false,
              error: t('orders.statusChanged')
            })
            continue
          }

          results.push({
            orderId: order.id,
            orderNumber: order.orderNumber,
            trackingNo: order.trackingNo,
            previousStatus: order.status,
            newStatus,
            cargoStatus: trackingInfo.status,
            updated: true
          })

          await logAction({
            userId: session.id,
            userType: 'ADMIN',
            action: 'CARGO_STATUS_SYNC',
            entity: 'ORDER',
            entityId: order.id,
            details: {
              orderNumber: order.orderNumber,
              trackingNo: order.trackingNo,
              previousStatus: order.status,
              newStatus,
              cargoStatus: trackingInfo.status,
              autoUpdated: true
            }
          })

          // COMPLETED: otomatik e-fatura (idempotent, best-effort) — tekli/toplu "Tamamlandi" ile ayni.
          // Veliye teslim maili GONDERILMEZ ("veliye tek mail" kurali; tekli/toplu tamamlama da gondermiyor).
          if (!order.invoiceNo) {
            await autoInvoiceOrderOnComplete(order.id, session.id)
          }
        } else {
          results.push({
            orderId: order.id,
            orderNumber: order.orderNumber,
            trackingNo: order.trackingNo,
            previousStatus: order.status,
            newStatus: null,
            cargoStatus: trackingInfo.status,
            updated: false
          })
        }

      } catch (error) {
        results.push({
          orderId: order.id,
          orderNumber: order.orderNumber,
          trackingNo: order.trackingNo || '',
          previousStatus: order.status,
          newStatus: null,
          cargoStatus: 'SORGULAMA_HATASI',
          updated: false,
          error: error instanceof Error ? error.message : t('orders.cargoQueryFailed')
        })
      }
    }

    const updatedCount = results.filter(r => r.updated).length
    const noChangeCount = results.filter(r => !r.updated && !r.error).length
    const errorCount = results.filter(r => r.error).length

    // Toplu senkronizasyon logu
    await logAction({
      userId: session.id,
      userType: 'ADMIN',
      action: 'BATCH_CARGO_SYNC',
      entity: 'ORDER',
      details: {
        totalQueried: orders.length,
        updated: updatedCount,
        noChange: noChangeCount,
        errors: errorCount
      }
    })

    return NextResponse.json({
      success: true,
      message: t('orders.cargoSyncResult', { queried: orders.length, updated: updatedCount }),
      results,
      summary: {
        total: orders.length,
        updated: updatedCount,
        noChange: noChangeCount,
        errors: errorCount
      }
    })

  } catch (error) {
    console.error('Kargo senkronizasyon hatasi:', error)
    return NextResponse.json(
      { error: t('orders.cargoSyncFailed') },
      { status: 500 }
    )
  }
}
