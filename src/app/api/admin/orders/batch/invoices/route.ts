import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/auth'
import { logAction } from '@/lib/logger'
import { createInvoice } from '@/lib/kolaybi'
import { sendInvoiceCreated } from '@/lib/email'

interface BatchResult {
  orderId: string
  orderNumber: string
  success: boolean
  invoiceNo?: string
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

    // Fatura kesilebilir durumdaki siparisleri getir (zaten faturalanmamis olanlar)
    const orders = await prisma.order.findMany({
      where: {
        id: { in: orderIds },
        status: { in: ['PAID', 'CONFIRMED'] },
        invoiceNo: null
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

    if (orders.length === 0) {
      return NextResponse.json(
        { error: 'Fatura kesilebilir siparis bulunamadi' },
        { status: 400 }
      )
    }

    // Closure icinde session non-null olsun diye id'yi onceden yakala
    const sessionId = session.id

    // Tek bir siparis icin fatura kesim islemi (paralel calisacak)
    async function processOne(order: typeof orders[number]): Promise<BatchResult> {
      try {
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
            error: invoiceResult.errorMessage || 'Fatura olusturulamadi'
          }
        }

        // Idempotency: invoiceNo bos olanlari atomic olarak guncelle.
        // Iki paralel batch ayni siparise gelse 2.si count=0 doner.
        const updated = await prisma.order.updateMany({
          where: { id: order.id, invoiceNo: null },
          data: {
            status: 'INVOICED',
            invoiceNo: invoiceResult.invoiceNo,
            invoicePdfPath: invoiceResult.invoiceUrl,
            invoiceDate: new Date(),
            invoicedAt: new Date()
          }
        })
        if (updated.count === 0) {
          return {
            orderId: order.id,
            orderNumber: order.orderNumber,
            success: false,
            error: 'Bu siparise daha onceden fatura kesilmis (concurrent)'
          }
        }

        // Log + bildirim mail (best-effort, fatura kesimi etkilemez)
        logAction({
          userId: sessionId,
          userType: 'ADMIN',
          action: 'BATCH_INVOICE_CREATED',
          entity: 'ORDER',
          entityId: order.id,
          details: {
            orderNumber: order.orderNumber,
            invoiceNo: invoiceResult.invoiceNo,
            batchOperation: true
          }
        }).catch(err => console.error('Batch invoice log error:', err))

        if (order.email && invoiceResult.invoiceNo) {
          sendInvoiceCreated({
            email: order.email,
            orderNumber: order.orderNumber,
            parentName: order.parentName,
            invoiceNo: invoiceResult.invoiceNo,
            totalAmount: Number(order.totalAmount),
          }).catch(notifError => console.error('Toplu fatura mail hatasi:', notifError))
        }

        return {
          orderId: order.id,
          orderNumber: order.orderNumber,
          success: true,
          invoiceNo: invoiceResult.invoiceNo
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

    // Chunk paralelizasyon: 10'arli paralel calistir (KolayBi rate-limit'ine saygi).
    const CONCURRENCY = 10
    const results: BatchResult[] = []
    for (let i = 0; i < orders.length; i += CONCURRENCY) {
      const chunk = orders.slice(i, i + CONCURRENCY)
      const chunkResults = await Promise.all(chunk.map(processOne))
      results.push(...chunkResults)
    }

    const successCount = results.filter(r => r.success).length
    const failCount = results.filter(r => !r.success).length

    // Toplu islem logu
    await logAction({
      userId: session.id,
      userType: 'ADMIN',
      action: 'BATCH_INVOICE_COMPLETED',
      entity: 'ORDER',
      details: {
        totalOrders: orders.length,
        successCount,
        failCount,
        orderIds: results.filter(r => r.success).map(r => r.orderId)
      }
    })

    return NextResponse.json({
      success: true,
      message: `${successCount} fatura olusturuldu${failCount > 0 ? `, ${failCount} hata` : ''}`,
      results,
      summary: {
        total: orders.length,
        success: successCount,
        failed: failCount
      }
    })

  } catch (error) {
    console.error('Toplu fatura olusturulamadi:', error)
    return NextResponse.json(
      { error: 'Toplu fatura olusturulamadi' },
      { status: 500 }
    )
  }
}
