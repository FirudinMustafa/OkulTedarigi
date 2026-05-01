import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/auth'
import { logAction } from '@/lib/logger'
import { getTrackingInfo } from '@/lib/aras-kargo'
import { OrderStatus } from '@prisma/client'

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
  try {
    const session = await getAdminSession()
    if (!session) {
      return NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 401 })
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
        status: true
      }
    })

    if (orders.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Sorgulanacak kargo bulunamadi',
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
        // Aras Kargo status kodlari (ornek):
        // - TESLIM_EDILDI, DELIVERED: Teslim edildi
        // - DAGITIMDA, IN_TRANSIT: Dagitimda
        // - TESLIM_EDILEMEDI: Teslim edilemedi
        if (['TESLIM_EDILDI', 'DELIVERED'].includes(trackingInfo.statusCode)) {
          newStatus = OrderStatus.DELIVERED
        }

        if (newStatus && newStatus !== order.status) {
          // Durumu guncelle
          await prisma.order.update({
            where: { id: order.id },
            data: {
              status: newStatus,
              deliveredAt: new Date()
            }
          })

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
          error: error instanceof Error ? error.message : 'Kargo sorgulanamadi'
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
      message: `${orders.length} kargo sorgulandı, ${updatedCount} sipariş güncellendi`,
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
      { error: 'Kargo durumu sorgulanamadi' },
      { status: 500 }
    )
  }
}
