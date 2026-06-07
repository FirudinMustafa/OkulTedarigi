import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/auth'
import { logAction } from '@/lib/logger'
import { createShipment } from '@/lib/aras-kargo'

interface BatchResult {
  orderId: string
  orderNumber: string
  success: boolean
  trackingNo?: string
  error?: string
}

// Toplu Kargola: CARGO teslimat tipindeki Hazirlaniyor (CONFIRMED) siparisleri
// Dagitimda (SHIPPED) durumuna alir + kargo (trackingNo) olusturur.
// NOT: Fatura/KolayBi artik odeme aninda (checkout) gonderilir; burada fatura YOK.
// Veliye mail GONDERILMEZ.
export async function POST(request: Request) {
  try {
    const session = await getAdminSession()
    if (!session) {
      return NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Gecersiz istek' }, { status: 400 })
    }
    const { orderIds } = body

    if (!Array.isArray(orderIds) || orderIds.length === 0 || orderIds.length > 500) {
      return NextResponse.json({ error: 'Siparis ID listesi gerekli (max 500)' }, { status: 400 })
    }
    if (!orderIds.every(id => typeof id === 'string' && id.length > 0 && id.length <= 40)) {
      return NextResponse.json({ error: 'Gecersiz siparis ID' }, { status: 400 })
    }

    // Kargolanabilir siparisler: CONFIRMED (Hazirlaniyor)
    const orders = await prisma.order.findMany({
      where: { id: { in: orderIds }, status: 'CONFIRMED' },
      include: { class: { include: { school: true } } }
    })

    // Sadece CARGO teslimat tipindekiler
    const cargoOrders = orders.filter(o => o.class.school.deliveryType === 'CARGO')

    if (cargoOrders.length === 0) {
      return NextResponse.json({ error: 'Kargolanabilir siparis bulunamadi' }, { status: 400 })
    }

    const sessionId = session.id

    async function processOne(order: typeof cargoOrders[number]): Promise<BatchResult> {
      try {
        const shipmentResult = await createShipment({
          orderNumber: order.orderNumber,
          receiverName: order.parentName,
          receiverPhone: order.phone,
          receiverAddress: order.deliveryAddress || order.address || '',
          packageCount: 1,
          packageWeight: 2,
          packageContent: 'Okul Malzemeleri'
        })

        if (!shipmentResult.success) {
          return {
            orderId: order.id,
            orderNumber: order.orderNumber,
            success: false,
            error: shipmentResult.errorMessage || 'Kargo olusturulamadi'
          }
        }

        // Atomic: trackingNo bos + status hala CONFIRMED olanlari guncelle
        const shipUpdate = await prisma.order.updateMany({
          where: { id: order.id, status: 'CONFIRMED', trackingNo: null },
          data: {
            status: 'SHIPPED',
            trackingNo: shipmentResult.trackingNo,
            shippedAt: new Date()
          }
        })
        if (shipUpdate.count === 0) {
          return {
            orderId: order.id,
            orderNumber: order.orderNumber,
            success: false,
            error: 'Bu siparis icin daha onceden kargo olusturulmus'
          }
        }

        logAction({
          userId: sessionId,
          userType: 'ADMIN',
          action: 'BATCH_SHIPMENT_CREATED',
          entity: 'ORDER',
          entityId: order.id,
          details: {
            orderNumber: order.orderNumber,
            trackingNo: shipmentResult.trackingNo,
            batchOperation: true
          }
        }).catch(err => console.error('Batch shipment log error:', err))

        return {
          orderId: order.id,
          orderNumber: order.orderNumber,
          success: true,
          trackingNo: shipmentResult.trackingNo,
        }
      } catch (error) {
        return {
          orderId: order.id,
          orderNumber: order.orderNumber,
          success: false,
          error: error instanceof Error ? error.message : 'Bilinmeyen hata'
        }
      }
    }

    // 10'arli paralel (3rd-party rate-limit korunur)
    const CONCURRENCY = 10
    const results: BatchResult[] = []
    for (let i = 0; i < cargoOrders.length; i += CONCURRENCY) {
      const chunk = cargoOrders.slice(i, i + CONCURRENCY)
      const chunkResults = await Promise.all(chunk.map(processOne))
      results.push(...chunkResults)
    }

    const successCount = results.filter(r => r.success).length
    const failCount = results.filter(r => !r.success).length

    await logAction({
      userId: session.id,
      userType: 'ADMIN',
      action: 'BATCH_SHIPMENT_COMPLETED',
      entity: 'ORDER',
      details: {
        totalOrders: cargoOrders.length,
        successCount,
        failCount,
        orderIds: results.filter(r => r.success).map(r => r.orderId)
      }
    })

    return NextResponse.json({
      success: true,
      message: `${successCount} kargo olusturuldu${failCount > 0 ? `, ${failCount} hata` : ''}`,
      results,
      summary: { total: cargoOrders.length, success: successCount, failed: failCount }
    })

  } catch (error) {
    console.error('Toplu kargo olusturulamadi:', error)
    return NextResponse.json({ error: 'Toplu kargo olusturulamadi' }, { status: 500 })
  }
}
