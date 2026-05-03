import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/auth'
import { logAction } from '@/lib/logger'
import { createInvoice } from '@/lib/kolaybi'
import { createShipment } from '@/lib/aras-kargo'
import { sendInvoiceCreated, sendCargoNotification } from '@/lib/email'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession()
    if (!session) {
      return NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 401 })
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
        }
      }
    })

    if (!order) {
      return NextResponse.json({ error: 'Siparis bulunamadi' }, { status: 404 })
    }

    // Teslimat tipi okul uzerinden alinir
    if (order.class.school.deliveryType !== 'CARGO') {
      return NextResponse.json(
        { error: 'Bu siparis kargo ile gonderilmeyecek' },
        { status: 400 }
      )
    }

    if (!['PAID', 'CONFIRMED', 'INVOICED'].includes(order.status)) {
      return NextResponse.json(
        { error: 'Bu siparis icin kargo olusturulamaz' },
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
          { error: `Otomatik fatura olusturulamadi: ${invoiceResult.errorMessage}` },
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
          })
        } catch (notifError) {
          console.error('Otomatik fatura bildirim maili gonderilemedi:', notifError)
        }
      }
    }

    // Kargo olustur
    const shipmentResult = await createShipment({
      orderNumber: order.orderNumber,
      receiverName: order.parentName,
      receiverPhone: order.phone,
      receiverAddress: order.deliveryAddress || order.address || '',
      packageCount: 1,
      packageWeight: 2, // varsayilan 2 kg
      packageContent: 'Okul Malzemeleri'
    })

    // Siparis durumunu guncelle
    await prisma.order.update({
      where: { id },
      data: {
        status: 'SHIPPED',
        trackingNo: shipmentResult.trackingNo,
        shippedAt: new Date()
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
          trackingUrl: shipmentResult.trackingUrl || `https://kargotakip.araskargo.com.tr/mainpage.aspx?code=${shipmentResult.trackingNo}`,
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
      { error: 'Kargo olusturulamadi' },
      { status: 500 }
    )
  }
}
