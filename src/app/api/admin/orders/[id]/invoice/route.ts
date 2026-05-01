import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/auth'
import { logAction } from '@/lib/logger'
import { createInvoice } from '@/lib/kolaybi'
import { sendInvoiceCreated } from '@/lib/email'

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

    if (!['PAID', 'CONFIRMED'].includes(order.status)) {
      return NextResponse.json(
        { error: 'Bu siparis icin fatura kesilemez (sadece onaylanmis siparisler)' },
        { status: 400 }
      )
    }

    // Idempotency: Fatura zaten kesilmisse tekrar kesme.
    if (order.invoiceNo) {
      return NextResponse.json(
        {
          error: 'Bu siparise daha onceden fatura kesilmis',
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
        { error: 'Fatura kesim islemi su anda baska bir admin tarafindan yapiliyor' },
        { status: 409 }
      )
    }

    // Mock fatura olustur
    const invoiceResult = await createInvoice({
      orderNumber: order.orderNumber,
      customerName: order.parentName,
      customerEmail: order.email || undefined,
      customerPhone: order.phone,
      customerAddress: order.address || order.class.school.address || undefined,
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

    // Fatura sonucu basarisizsa status'u geri al (rollback)
    if (!invoiceResult.success) {
      await prisma.order.update({
        where: { id },
        data: { status: order.status, invoicedAt: null }
      })
      return NextResponse.json(
        { error: invoiceResult.errorMessage || 'Fatura olusturulamadi' },
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
      { error: 'Fatura olusturulamadi' },
      { status: 500 }
    )
  }
}
