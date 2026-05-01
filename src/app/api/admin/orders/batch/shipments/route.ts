import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/auth'
import { logAction } from '@/lib/logger'
import { createInvoice } from '@/lib/kolaybi'
import { createShipment } from '@/lib/aras-kargo'

interface BatchResult {
  orderId: string
  orderNumber: string
  success: boolean
  trackingNo?: string
  invoiceNo?: string
  autoInvoiced?: boolean
  error?: string
}

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
      return NextResponse.json(
        { error: 'Siparis ID listesi gerekli (max 500)' },
        { status: 400 }
      )
    }
    if (!orderIds.every(id => typeof id === 'string' && id.length > 0 && id.length <= 40)) {
      return NextResponse.json({ error: 'Gecersiz siparis ID' }, { status: 400 })
    }

    // Kargo gonderimi yapilabilecek siparisleri getir
    // PAID veya PREPARING durumundaki siparisler
    const orders = await prisma.order.findMany({
      where: {
        id: { in: orderIds },
        status: { in: ['PAID', 'PREPARING'] }
      },
      include: {
        class: {
          include: {
            school: true,
            package: { include: { items: true } }
          }
        }
      }
    })

    // Sadece CARGO teslimat tipindeki siparisleri filtrele
    const cargoOrders = orders.filter(o => o.class.school.deliveryType === 'CARGO')

    if (cargoOrders.length === 0) {
      return NextResponse.json(
        { error: 'Kargo gonderilebilir siparis bulunamadi' },
        { status: 400 }
      )
    }

    // Closure icinde session non-null olsun diye id'yi onceden yakala
    const sessionId = session.id

    // Tek bir siparis icin kargo+otomatik fatura akisi
    async function processOne(order: typeof cargoOrders[number]): Promise<BatchResult> {
      try {
        let invoiceNo: string | null | undefined = order.invoiceNo
        let autoInvoiced = false

        // OTOMATIK FATURA: Henuz faturalanmamis siparisler icin once fatura kes
        if (order.status === 'PAID' && !order.invoiceNo) {
          const invoiceResult = await createInvoice({
            orderNumber: order.orderNumber,
            customerName: order.parentName,
            customerEmail: order.email || undefined,
            customerPhone: order.phone,
            customerAddress: order.invoiceAddress || order.address || order.class.school.address || undefined,
            isCorporate: order.isCorporateInvoice,
            taxNumber: order.taxNumber || undefined,
            taxOffice: order.taxOffice || undefined,
            items: order.class.package?.items.map(item => ({
              name: item.name,
              quantity: item.quantity,
              unitPrice: Number(item.price),
              totalPrice: Number(item.price) * item.quantity
            })) || [],
            totalAmount: Number(order.totalAmount)
          })

          if (!invoiceResult.success) {
            return {
              orderId: order.id,
              orderNumber: order.orderNumber,
              success: false,
              error: `Otomatik fatura olusturulamadi: ${invoiceResult.errorMessage || 'Bilinmeyen hata'}`
            }
          }

          // Idempotent atomic update: invoiceNo bos olanlar icin
          const claim = await prisma.order.updateMany({
            where: { id: order.id, invoiceNo: null },
            data: {
              invoiceNo: invoiceResult.invoiceNo,
              invoicePdfPath: invoiceResult.invoiceUrl,
              invoiceDate: new Date(),
              invoicedAt: new Date()
            }
          })
          if (claim.count > 0) {
            invoiceNo = invoiceResult.invoiceNo
            autoInvoiced = true

            logAction({
              userId: sessionId,
              userType: 'ADMIN',
              action: 'AUTO_INVOICE_CREATED',
              entity: 'ORDER',
              entityId: order.id,
              details: {
                orderNumber: order.orderNumber,
                invoiceNo: invoiceResult.invoiceNo,
                autoCreated: true,
                batchOperation: true
              }
            }).catch(err => console.error('Auto invoice log error:', err))
          }
        }

        // Kargo olustur
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
            invoiceNo: invoiceNo || undefined,
            autoInvoiced,
            error: shipmentResult.errorMessage || 'Kargo olusturulamadi'
          }
        }

        // Siparis durumunu guncelle (trackingNo bos olanlari atomic guncelle)
        const shipUpdate = await prisma.order.updateMany({
          where: { id: order.id, trackingNo: null },
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
            autoInvoiced,
            batchOperation: true
          }
        }).catch(err => console.error('Batch shipment log error:', err))

        return {
          orderId: order.id,
          orderNumber: order.orderNumber,
          success: true,
          trackingNo: shipmentResult.trackingNo,
          invoiceNo: invoiceNo || undefined,
          autoInvoiced
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

    // Chunk paralelizasyon: 10'arli paralel calistir (3rd-party rate-limit korunur)
    const CONCURRENCY = 10
    const results: BatchResult[] = []
    for (let i = 0; i < cargoOrders.length; i += CONCURRENCY) {
      const chunk = cargoOrders.slice(i, i + CONCURRENCY)
      const chunkResults = await Promise.all(chunk.map(processOne))
      results.push(...chunkResults)
    }

    const successCount = results.filter(r => r.success).length
    const failCount = results.filter(r => !r.success).length
    const autoInvoicedCount = results.filter(r => r.autoInvoiced).length

    // Toplu islem logu
    await logAction({
      userId: session.id,
      userType: 'ADMIN',
      action: 'BATCH_SHIPMENT_COMPLETED',
      entity: 'ORDER',
      details: {
        totalOrders: cargoOrders.length,
        successCount,
        failCount,
        autoInvoicedCount,
        orderIds: results.filter(r => r.success).map(r => r.orderId)
      }
    })

    return NextResponse.json({
      success: true,
      message: `${successCount} kargo olusturuldu${autoInvoicedCount > 0 ? ` (${autoInvoicedCount} otomatik fatura)` : ''}${failCount > 0 ? `, ${failCount} hata` : ''}`,
      results,
      summary: {
        total: cargoOrders.length,
        success: successCount,
        failed: failCount,
        autoInvoiced: autoInvoicedCount
      }
    })

  } catch (error) {
    console.error('Toplu kargo olusturulamadi:', error)
    return NextResponse.json(
      { error: 'Toplu kargo olusturulamadi' },
      { status: 500 }
    )
  }
}
