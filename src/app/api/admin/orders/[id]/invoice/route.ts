import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/auth'
import { logAction } from '@/lib/logger'
import { createInvoice } from '@/lib/kolaybi'
import { sendInvoiceCreated } from '@/lib/email'
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

    if (!order) {
      return NextResponse.json({ error: t('orders.orderNotFound') }, { status: 404 })
    }

    if (!['PAID', 'CONFIRMED'].includes(order.status)) {
      return NextResponse.json(
        { error: t('orders.notInvoiceable') },
        { status: 400 }
      )
    }

    // Idempotency: Fatura zaten kesilmisse tekrar kesme.
    if (order.invoiceNo) {
      return NextResponse.json(
        {
          error: t('orders.alreadyInvoiced'),
          invoiceNo: order.invoiceNo
        },
        { status: 409 }
      )
    }

    // Atomic claim: Fatura kesim slot'u rezerve et (concurrent POST'lar engellenir).
    // Status'u INVOICED'a guncelle ve invoiceNo bos olanlari sec; count=0 ise baska slot once kapilmistir.
    const claimResult = await prisma.order.updateMany({
      where: { id, status: order.status, invoiceNo: null },
      data: { status: 'INVOICED', invoicedAt: new Date() }
    })
    if (claimResult.count === 0) {
      return NextResponse.json(
        { error: t('orders.invoiceInProgress') },
        { status: 409 }
      )
    }

    // Fatura kalemleri: velinin gercekten sectigi kalemler order.items (OrderItem snapshot)
    // icinde saklidir. Ozellestirilebilir pakette veli kalem cikarabildigi icin paketin sabit
    // listesi yerine snapshot kullanilir. Eski (snapshot'siz) siparisler icin paket listesine
    // fallback yapilir. Adetler ogrenci sayisiyla carpilir (totalAmount = birim x ogrenci).
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

    // Fatura sonucu basarisizsa status'u geri al (rollback)
    if (!invoiceResult.success) {
      await prisma.order.update({
        where: { id },
        data: { status: order.status, invoicedAt: null }
      })
      return NextResponse.json(
        { error: invoiceResult.errorMessage || t('orders.invoiceCreateFailed') },
        { status: 500 }
      )
    }

    // Fatura no/url'i guncelle (status zaten INVOICED'a alindi)
    await prisma.order.update({
      where: { id },
      data: {
        invoiceNo: invoiceResult.invoiceNo,
        invoicePdfPath: invoiceResult.invoiceUrl,
        invoiceDate: new Date()
      }
    })

    await logAction({
      userId: session.id,
      userType: 'ADMIN',
      action: 'CREATE',
      entity: 'INVOICE',
      entityId: order.id,
      details: {
        orderNumber: order.orderNumber,
        invoiceNo: invoiceResult.invoiceNo
      }
    })

    // Veliye fatura kesim bildirimi (best-effort, fatura iptal etmez)
    if (order.email && invoiceResult.invoiceNo) {
      try {
        await sendInvoiceCreated({
          email: order.email,
          orderNumber: order.orderNumber,
          parentName: order.parentName,
          invoiceNo: invoiceResult.invoiceNo,
          totalAmount: Number(order.totalAmount),
          locale: (order.locale ?? undefined) as ('tr'|'en'|'de'|'ar' | undefined),
        })
      } catch (notifError) {
        console.error('Fatura bildirim maili gonderilemedi:', notifError)
      }
    }

    return NextResponse.json({
      success: true,
      invoiceNo: invoiceResult.invoiceNo,
      invoiceUrl: invoiceResult.invoiceUrl
    })
  } catch (error) {
    console.error('Fatura olusturulamadi:', error)
    return NextResponse.json(
      { error: t('orders.invoiceCreateFailed') },
      { status: 500 }
    )
  }
}
