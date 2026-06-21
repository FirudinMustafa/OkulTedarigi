import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/auth'
import { logAction } from '@/lib/logger'
import { createInvoice } from '@/lib/kolaybi'
import { createShipment } from '@/lib/yurtici-kargo'
import { sendInvoiceCreated, sendCargoNotification } from '@/lib/email'
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
        class: {
          include: {
            school: true,
            package: { include: { items: true } }
          }
        },
        _count: { select: { students: true } }
      }
    })

    if (!order) {
      return NextResponse.json({ error: t('orders.orderNotFound') }, { status: 404 })
    }

    // Teslimat tipi okul uzerinden alinir
    if (order.class.school.deliveryType !== 'CARGO') {
      return NextResponse.json(
        { error: t('orders.notCargoDelivery') },
        { status: 400 }
      )
    }

    if (!['PAID', 'CONFIRMED', 'INVOICED'].includes(order.status)) {
      return NextResponse.json(
        { error: t('orders.notShippable') },
        { status: 400 }
      )
    }

    let autoInvoiced = false
    let invoiceNo: string | null = order.invoiceNo

    // OTOMATIK FATURA: Henuz faturalanmamis siparisler icin once fatura kes
    if (['PAID', 'CONFIRMED'].includes(order.status)) {
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
        return NextResponse.json(
          { error: t('orders.autoInvoiceFailed', { message: invoiceResult.errorMessage ?? '' }) },
          { status: 500 }
        )
      }

      invoiceNo = invoiceResult.invoiceNo || null
      autoInvoiced = true

      // Fatura bilgilerini kaydet
      await prisma.order.update({
        where: { id },
        data: {
          invoiceNo: invoiceResult.invoiceNo,
          invoicePdfPath: invoiceResult.invoiceUrl,
          invoiceDate: new Date(),
          invoicedAt: new Date()
        }
      })

      await logAction({
        userId: session.id,
        userType: 'ADMIN',
        action: 'AUTO_INVOICE_CREATED',
        entity: 'ORDER',
        entityId: order.id,
        details: {
          orderNumber: order.orderNumber,
          invoiceNo: invoiceResult.invoiceNo,
          autoCreated: true
        }
      })

      // Veliye otomatik fatura kesim bildirimi (best-effort)
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
          console.error('Otomatik fatura bildirim maili gonderilemedi:', notifError)
        }
      }
    }

    // Atomic claim: SHIPPED slot'u rezerve et (concurrent POST'lar engellenir).
    // Sadece kargolanmamis (trackingNo: null) ve uygun statuslu siparisler claim edilir.
    // count=0 ise: baska admin/istek ayni anda kargoyu olusturmus.
    const previousStatus = order.status
    const shippedAt = new Date()
    const claimResult = await prisma.order.updateMany({
      where: {
        id,
        status: { in: ['PAID', 'CONFIRMED', 'INVOICED'] },
        trackingNo: null
      },
      data: {
        status: 'SHIPPED',
        shippedAt
      }
    })
    if (claimResult.count === 0) {
      return NextResponse.json(
        { error: t('orders.shipmentClaimConflict') },
        { status: 409 }
      )
    }

    // Yurtici kargo cagrisi (slot rezervasyonu sonrasi)
    // il/ilce: yapisal city/district FATURA adresinindir; yalnizca fatura=teslimat
    // (invoiceAddressSame) iken teslimat il/ilcesi olarak kullanilir, aksi halde bos
    // birakilir (Yurtici bos il/ilceyi kabul eder, adres metninden yonlendirir).
    let shipmentResult
    try {
      shipmentResult = await createShipment({
        orderNumber: order.orderNumber,
        receiverName: order.parentName,
        receiverPhone: order.phone,
        receiverAddress: order.deliveryAddress || order.address || '',
        receiverCity: order.invoiceAddressSame ? (order.city || undefined) : undefined,
        receiverDistrict: order.invoiceAddressSame ? (order.district || undefined) : undefined,
        receiverEmail: order.email || undefined,
        packageCount: 1,
        studentCount: order._count.students,
        packageContent: 'Okul Malzemeleri'
      })
    } catch (cargoErr) {
      // Teknik hata (network/config/SOAP fault) - status'u geri al (rollback)
      await prisma.order.update({
        where: { id },
        data: { status: previousStatus, shippedAt: null }
      })
      console.error('Kargo olusturulamadi (rollback yapildi):', cargoErr)
      return NextResponse.json(
        { error: t('orders.shipmentCreateRetry') },
        { status: 500 }
      )
    }

    // Is hatasi (Yurtici outFlag!=0, ornn duplicate/hatali veri): success=false doner,
    // throw etmez -> burada yakalayip rollback + gercek hata mesajini admin'e don.
    if (!shipmentResult.success) {
      await prisma.order.update({
        where: { id },
        data: { status: previousStatus, shippedAt: null }
      })
      return NextResponse.json(
        { error: shipmentResult.errorMessage || t('orders.shipmentCreateRetry') },
        { status: 400 }
      )
    }

    // Tracking numarasini kaydet (status zaten SHIPPED'a alindi)
    await prisma.order.update({
      where: { id },
      data: {
        trackingNo: shipmentResult.trackingNo
      }
    })

    await logAction({
      userId: session.id,
      userType: 'ADMIN',
      action: 'CREATE',
      entity: 'SHIPMENT',
      entityId: order.id,
      details: {
        orderNumber: order.orderNumber,
        trackingNo: shipmentResult.trackingNo
      }
    })

    // Kargo bildirim maili (best-effort)
    if (order.email && shipmentResult.trackingNo) {
      try {
        await sendCargoNotification({
          email: order.email,
          orderNumber: order.orderNumber,
          parentName: order.parentName,
          trackingNo: shipmentResult.trackingNo,
          trackingUrl: shipmentResult.trackingUrl || `https://www.yurticikargo.com/tr/online-servisler/gonderi-sorgula?code=${shipmentResult.trackingNo}`,
          locale: (order.locale ?? undefined) as ('tr'|'en'|'de'|'ar' | undefined),
        })
      } catch (notifError) {
        console.error('Kargo bildirim maili gonderilemedi:', notifError)
      }
    }

    return NextResponse.json({
      success: true,
      trackingNo: shipmentResult.trackingNo,
      trackingUrl: shipmentResult.trackingUrl,
      autoInvoiced,
      invoiceNo: invoiceNo || undefined
    })
  } catch (error) {
    console.error('Kargo olusturulamadi:', error)
    return NextResponse.json(
      { error: t('orders.shipmentCreateFailed') },
      { status: 500 }
    )
  }
}
