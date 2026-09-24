import { prisma } from '@/lib/prisma'
import { createInvoice } from '@/lib/kolaybi'
import { sendInvoiceCreated } from '@/lib/email'
import { logAction } from '@/lib/logger'
import { buildInvoiceItems } from '@/lib/invoice-items'

/**
 * Siparis COMPLETED durumuna gectiginde otomatik e-fatura kesimi (idempotent, best-effort).
 * Tum COMPLETED gecis noktalarindan (tekli PUT, toplu teslimat) ayni davranisi saglamak icin
 * ortak fonksiyon olarak tutuluyor — basarisiz olursa hicbir sey firlatmaz, sadece loglar.
 */
export async function autoInvoiceOrderOnComplete(
  orderId: string,
  adminUserId: string
): Promise<{ invoiceNo: string; invoicePdfPath: string | null; invoiceDate: Date; invoicedAt: Date } | null> {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        orderNumber: true,
        parentName: true,
        email: true,
        phone: true,
        invoiceAddress: true,
        address: true,
        isCorporateInvoice: true,
        taxNumber: true,
        taxOffice: true,
        city: true,
        district: true,
        totalAmount: true,
        locale: true,
        invoiceNo: true,
        items: true,
        students: { select: { id: true } },
        class: {
          select: {
            school: { select: { address: true } },
            package: { include: { items: true } }
          }
        }
      }
    })
    if (!order || order.invoiceNo) return null

    const studentCount = Math.max(1, order.students.length)
    const invoiceItems = buildInvoiceItems(order, studentCount)

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

    if (!invoiceResult.success || !invoiceResult.invoiceNo) {
      console.error('[auto-invoice] COMPLETED otomatik fatura basarisiz:', order.orderNumber, invoiceResult.errorMessage)
      return null
    }

    const invoiceDate = new Date()
    const invoicePdfPath = invoiceResult.invoiceUrl ?? null
    await prisma.order.update({
      where: { id: orderId },
      data: {
        invoiceNo: invoiceResult.invoiceNo,
        invoicePdfPath,
        invoiceDate,
        invoicedAt: invoiceDate,
      }
    })

    await logAction({
      userId: adminUserId,
      userType: 'ADMIN',
      action: 'AUTO_INVOICE_CREATED',
      entity: 'ORDER',
      entityId: orderId,
      details: { orderNumber: order.orderNumber, invoiceNo: invoiceResult.invoiceNo, trigger: 'COMPLETED' },
    }).catch(() => {})

    if (order.email) {
      sendInvoiceCreated({
        email: order.email,
        orderNumber: order.orderNumber,
        parentName: order.parentName,
        invoiceNo: invoiceResult.invoiceNo,
        totalAmount: Number(order.totalAmount),
        locale: (order.locale ?? undefined) as ('tr' | 'en' | 'de' | 'ar' | undefined),
      }).catch(err => console.error('Fatura bildirim maili gonderilemedi:', err))
    }

    return { invoiceNo: invoiceResult.invoiceNo, invoicePdfPath, invoiceDate, invoicedAt: invoiceDate }
  } catch (err) {
    console.error('[auto-invoice] COMPLETED otomatik fatura hatasi:', orderId, err)
    return null
  }
}
