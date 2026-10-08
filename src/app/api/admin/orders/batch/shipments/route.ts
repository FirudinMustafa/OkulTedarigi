import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/auth'
import { logAction } from '@/lib/logger'
import { createShipment } from '@/lib/yurtici-kargo'
import { getApiLocale } from '@/lib/api-locale'
import { getTranslations } from 'next-intl/server'

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
    const { orderIds } = body

    if (!Array.isArray(orderIds) || orderIds.length === 0 || orderIds.length > 500) {
      return NextResponse.json({ error: t('orders.idListRequired500') }, { status: 400 })
    }
    if (!orderIds.every(id => typeof id === 'string' && id.length > 0 && id.length <= 40)) {
      return NextResponse.json({ error: t('orders.invalidOrderId') }, { status: 400 })
    }

    // Kargolanabilir siparisler: CONFIRMED (Hazirlaniyor), CARGO teslimatli,
    // bekleyen iptal talebi OLMAYAN. Elenenler sonuc listesinde "basarisiz" olarak doner
    // (admin hangi siparislerin kaldigini gorebilsin).
    const requested = await prisma.order.findMany({
      where: { id: { in: orderIds } },
      include: {
        class: { include: { school: true } },
        cancelRequest: { select: { status: true } },
        _count: { select: { students: true } }
      }
    })
    const skippedResults: BatchResult[] = []
    const cargoOrders = requested.filter(o => {
      let reason: string | null = null
      if (o.status !== 'CONFIRMED' && o.status !== 'INVOICED') reason = t('orders.notEligibleForAction', { action: 'SHIP', status: o.status })
      else if (o.class.school.deliveryType !== 'CARGO') reason = t('orders.notCargoDelivery')
      else if (o.cancelRequest?.status === 'PENDING') reason = t('orders.pendingCancelRequest')
      if (reason) skippedResults.push({ orderId: o.id, orderNumber: o.orderNumber, success: false, error: reason })
      return !reason
    })

    if (cargoOrders.length === 0) {
      return NextResponse.json({
        error: t('orders.noShippableOrders'),
        results: skippedResults,
        summary: { total: requested.length, success: 0, failed: skippedResults.length }
      }, { status: 400 })
    }

    const sessionId = session.id

    async function processOne(order: typeof cargoOrders[number]): Promise<BatchResult> {
      // Atomic claim ONCE (tekli /shipment ile ayni desen): bu arada degisen/iptal edilen
      // siparis icin Yurtici'de sahipsiz kargo kaydi acilmasin.
      const claim = await prisma.order.updateMany({
        where: { id: order.id, status: order.status, trackingNo: null },
        data: { status: 'SHIPPED', shippedAt: new Date() }
      })
      if (claim.count === 0) {
        return { orderId: order.id, orderNumber: order.orderNumber, success: false, error: t('orders.shipmentClaimConflict') }
      }
      const rollback = () => prisma.order.updateMany({
        where: { id: order.id, status: 'SHIPPED', trackingNo: null },
        data: { status: order.status, shippedAt: null }
      }).catch(err => console.error('Batch shipment rollback error:', err))

      try {
        const shipmentResult = await createShipment({
          orderNumber: order.orderNumber,
          receiverName: order.parentName,
          receiverPhone: order.phone,
          receiverAddress: order.deliveryAddress || order.address || '',
          // il/ilce sadece fatura=teslimat iken kullanilir (yapisal city/district fatura adresinindir)
          receiverCity: order.invoiceAddressSame ? (order.city || undefined) : undefined,
          receiverDistrict: order.invoiceAddressSame ? (order.district || undefined) : undefined,
          receiverEmail: order.email || undefined,
          packageCount: 1,
          studentCount: order._count.students,
          packageContent: 'Okul Malzemeleri'
        })

        if (!shipmentResult.success) {
          await rollback()
          return {
            orderId: order.id,
            orderNumber: order.orderNumber,
            success: false,
            error: shipmentResult.errorMessage || t('orders.shipmentCreateFailed')
          }
        }

        // Takip numarasini yaz (siparis claim ile zaten SHIPPED)
        await prisma.order.update({
          where: { id: order.id },
          data: { trackingNo: shipmentResult.trackingNo }
        })

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
        await rollback()
        return {
          orderId: order.id,
          orderNumber: order.orderNumber,
          success: false,
          error: error instanceof Error ? error.message : t('orders.unknownError')
        }
      }
    }

    // 10'arli paralel (3rd-party rate-limit korunur)
    const CONCURRENCY = 10
    const results: BatchResult[] = [...skippedResults]
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
      message: t('orders.batchShipmentResult', { success: successCount, failed: failCount }),
      results,
      summary: { total: results.length, success: successCount, failed: failCount }
    })

  } catch (error) {
    console.error('Toplu kargo olusturulamadi:', error)
    return NextResponse.json({ error: t('orders.batchShipmentFailed') }, { status: 500 })
  }
}
