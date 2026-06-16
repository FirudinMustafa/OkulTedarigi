import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/auth'
import { logAction } from '@/lib/logger'
import { cancelInvoice } from '@/lib/kolaybi'
import { sendInvoiceCancelled } from '@/lib/email'
import { getApiLocale } from '@/lib/api-locale'
import { getTranslations } from 'next-intl/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const t = await getTranslations({ locale: await getApiLocale(), namespace: 'apiErrors' })
  try {
    const session = await getAdminSession()
    if (!session) {
      return NextResponse.json({ error: t('orders.unauthorized') }, { status: 401 })
    }

    const { id } = await params

    const order = await prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        orderNumber: true,
        invoiceNo: true,
        status: true,
        parentName: true,
        email: true,
        locale: true
      }
    })

    if (!order) {
      return NextResponse.json({ error: t('orders.orderNotFound') }, { status: 404 })
    }

    if (!order.invoiceNo) {
      return NextResponse.json(
        { error: t('orders.noInvoiceOnOrder') },
        { status: 400 }
      )
    }

    // Fatura iptal et
    const result = await cancelInvoice(order.invoiceNo)

    if (!result.success) {
      return NextResponse.json(
        { error: result.message || t('orders.invoiceCancelFailed') },
        { status: 500 }
      )
    }

    // Fatura bilgilerini temizle ve durumu CONFIRMED'a geri al
    await prisma.order.update({
      where: { id },
      data: {
        status: 'CONFIRMED',
        invoiceNo: null,
        invoiceDate: null,
        invoicePdfPath: null,
        invoicedAt: null
      }
    })

    await logAction({
      userId: session.id,
      userType: 'ADMIN',
      action: 'CANCEL',
      entity: 'INVOICE',
      entityId: order.id,
      details: {
        orderNumber: order.orderNumber,
        cancelledInvoiceNo: order.invoiceNo
      }
    })

    // Veliye fatura iptal bildirim emaili (best-effort)
    if (order.email && order.invoiceNo) {
      try {
        await sendInvoiceCancelled({
          email: order.email,
          orderNumber: order.orderNumber,
          parentName: order.parentName,
          invoiceNo: order.invoiceNo,
          locale: (order.locale ?? undefined) as ('tr'|'en'|'de'|'ar' | undefined),
        })
      } catch (notifError) {
        console.error('Fatura iptal bildirim maili gonderilemedi:', notifError)
      }
    }

    return NextResponse.json({
      success: true,
      message: t('orders.invoiceCancelled')
    })
  } catch (error) {
    console.error('Fatura iptal edilemedi:', error)
    return NextResponse.json(
      { error: t('orders.invoiceCancelFailed') },
      { status: 500 }
    )
  }
}
