import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/auth'
import { logAction } from '@/lib/logger'
import { createInvoice } from '@/lib/kolaybi'
import { sendInvoiceCreated } from '@/lib/email'
import { getApiLocale } from '@/lib/api-locale'
import { getTranslations } from 'next-intl/server'

interface BatchResult {
  orderId: string
  orderNumber: string
  success: boolean
  invoiceNo?: string
  error?: string
}

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
      return NextResponse.json(
        { error: t('orders.idListRequired500') },
        { status: 400 }
      )
    }
    if (!orderIds.every(id => typeof id === 'string' && id.length > 0 && id.length <= 40)) {
      return NextResponse.json({ error: t('orders.invalidOrderId') }, { status: 400 })
    }

    // Fatura kesilebilir durumdaki siparisleri getir (zaten faturalanmamis olanlar)
    const orders = await prisma.order.findMany({
      where: {
        id: { in: orderIds },
        status: { in: ['PAID', 'CONFIRMED'] },
        invoiceNo: null
      },
      include: {
        items: true,
        students: { select: { id: true } },
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
        { error: t('orders.noInvoiceableOrders') },
        { status: 400 }
      )
    }

    // Closure icinde session non-null olsun diye id'yi onceden yakala
    const sessionId = session.id

    // Tek bir siparis icin fatura kesim islemi (paralel calisacak)
    async function processOne(order: typeof orders[number]): Promise<BatchResult> {
      try {
        // Fatura kalemleri: velinin sectigi kalemler order.items (OrderItem snapshot) icinden.
        // Eski snapshot'siz siparisler icin paket listesine fallback. Adetler ogrenci sayisiyla carpilir.
        const studentCount = Math.max(1, order.students.length)
        const snapshotItems = order.items.length > 0
          ? order.items
          : (order.class.package?.items ?? [])
        const invoiceItems = snapshotItems.map(item => ({
          name: item.name,
          quantity: item.quantity * studentCount,
          unitPrice: Number(item.price),
          totalPrice: Number(item.price) * item.quantity * studentCount,
        }))

        const invoiceResult = await createInvoice({
          orderNumber: order.orderNumber,
          customerName: order.parentName,
          customerEmail: order.email || undefined,
          customerPhone: order.phone,
          customerAddress: order.invoiceAddress || order.address || order.class.school.address || undefined,
          isCorporate: order.isCorporateInvoice,
          taxNumber: order.taxNumber || undefined,
          taxOffice: order.taxOffice || undefined,
          city: order.city || undefined,
          district: order.district || undefined,
          items: invoiceItems,
          totalAmount: Number(order.totalAmount)
        })

        if (!invoiceResult.success) {
          return {
            orderId: order.id,
            orderNumber: order.orderNumber,
            success: false,
            error: invoiceResult.errorMessage || t('orders.invoiceCreateFailed')
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
            error: t('orders.alreadyInvoicedConcurrent')
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
            locale: (order.locale ?? undefined) as ('tr'|'en'|'de'|'ar' | undefined),
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
          error: error instanceof Error ? error.message : t('orders.unknownError')
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
      message: t('orders.batchInvoiceResult', { success: successCount, failed: failCount }),
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
      { error: t('orders.batchInvoiceFailed') },
      { status: 500 }
    )
  }
}
