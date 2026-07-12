import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/auth'
import { logAction } from '@/lib/logger'
import { VALID_STATUS_TRANSITIONS } from '@/lib/constants'
import { cancelShipment } from '@/lib/yurtici-kargo'
import { createInvoice } from '@/lib/kolaybi'
import { sendInvoiceCreated } from '@/lib/email'
import { getApiLocale } from '@/lib/api-locale'
import { getTranslations } from 'next-intl/server'

export async function GET(
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
        items: {
          select: { id: true, name: true, quantity: true, price: true },
          orderBy: { createdAt: 'asc' },
        },
        cancelRequest: true
      }
    })

    if (!order) {
      return NextResponse.json({ error: t('orders.orderNotFound') }, { status: 404 })
    }

    // Map to expected format for admin panel
    const mappedOrder = {
      ...order,
      parentPhone: order.phone,
      parentEmail: order.email,
      deliveryType: order.class.school.deliveryType,
      deliveryAddress: order.deliveryAddress || order.address
    }

    return NextResponse.json({ order: mappedOrder })
  } catch (error) {
    console.error('Siparis getirilemedi:', error)
    return NextResponse.json(
      { error: t('orders.orderLoadFailed') },
      { status: 500 }
    )
  }
}

export async function PUT(
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
    const body = await request.json()

    // Izin verilen alanlari filtrele
    const allowedFields = ['status', 'trackingNo', 'address', 'phone', 'email', 'orderNote']
    const updateData: Record<string, unknown> = {}

    for (const key of Object.keys(body)) {
      if (allowedFields.includes(key)) {
        updateData[key] = body[key]
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: t('orders.noFieldsToUpdate') }, { status: 400 })
    }

    // Mevcut siparisi tek bir okumayla cek (audit trail icin onceki degerler +
    // COMPLETED gecisinde otomatik fatura icin gerekli alanlar)
    const previousOrder = await prisma.order.findUnique({
      where: { id },
      select: {
        status: true,
        trackingNo: true,
        address: true,
        phone: true,
        email: true,
        orderNote: true,
        invoiceNo: true,
        orderNumber: true,
        parentName: true,
        isCorporateInvoice: true,
        taxNumber: true,
        taxOffice: true,
        city: true,
        district: true,
        invoiceAddress: true,
        totalAmount: true,
        locale: true,
        items: true,
        students: { select: { id: true } },
        class: {
          select: {
            school: true,
            package: { include: { items: true } }
          }
        }
      }
    })
    if (!previousOrder) {
      return NextResponse.json({ error: t('orders.orderNotFound') }, { status: 404 })
    }

    // Status degisikligi varsa gecerli gecis kontrolu
    if (updateData.status) {
      const allowedTransitions = VALID_STATUS_TRANSITIONS[previousOrder.status] || []
      if (!allowedTransitions.includes(updateData.status as string)) {
        return NextResponse.json(
          { error: t('orders.transitionInvalid', { from: previousOrder.status, to: updateData.status as string }) },
          { status: 400 }
        )
      }

      // Durum gecislerinde tarih otomatik set et
      const now = new Date()
      if (updateData.status === 'PAID') updateData.paidAt = now
      if (updateData.status === 'CONFIRMED') updateData.confirmedAt = now
      if (updateData.status === 'INVOICED') updateData.invoicedAt = now
      if (updateData.status === 'SHIPPED') updateData.shippedAt = now
      if (updateData.status === 'DELIVERED') updateData.deliveredAt = now
      if (updateData.status === 'CANCELLED') updateData.cancelledAt = now
      if (updateData.status === 'REFUNDED') updateData.refundedAt = now
    }

    // Optimistic lock: status degisikliginde updateMany + WHERE status filter
    // Concurrent admin update'leri birbirini ezmez (count=0 -> 409 Conflict).
    let order
    if (updateData.status) {
      const lockResult = await prisma.order.updateMany({
        where: { id, status: previousOrder.status },
        data: updateData
      })
      if (lockResult.count === 0) {
        return NextResponse.json(
          { error: t('orders.statusChangedByAnother') },
          { status: 409 }
        )
      }
      order = await prisma.order.findUnique({ where: { id } })
    } else {
      order = await prisma.order.update({
        where: { id },
        data: updateData
      })
    }

    if (!order) {
      return NextResponse.json({ error: t('orders.orderNotFound') }, { status: 404 })
    }

    // Audit trail: hassas alanlarin oncesi/sonrasi log'a yazilsin
    const changes: Record<string, { from: unknown; to: unknown }> = {}
    for (const field of Object.keys(updateData)) {
      if (field in previousOrder) {
        const prev = (previousOrder as Record<string, unknown>)[field]
        const next = updateData[field]
        if (prev !== next) {
          changes[field] = { from: prev, to: next }
        }
      }
    }

    await logAction({
      userId: session.id,
      userType: 'ADMIN',
      action: 'UPDATE',
      entity: 'ORDER',
      entityId: order.id,
      details: {
        orderNumber: order.orderNumber,
        updatedFields: Object.keys(updateData),
        changes,
      }
    })

    // Veliye durum gecislerinde mail GONDERILMEZ (yalnizca odeme sonrasi tek mail gider).

    // COMPLETED gecisinde otomatik fatura (idempotent, best-effort — basarisiz olsa da
    // siparisin COMPLETED olmasini engellemez; teslimat zaten fiziksel olarak tamamlandi).
    if (updateData.status === 'COMPLETED' && !previousOrder.invoiceNo) {
      try {
        const studentCount = Math.max(1, previousOrder.students.length)
        const snapshotItems = previousOrder.items.length > 0
          ? previousOrder.items
          : (previousOrder.class.package?.items ?? [])
        const invoiceItems = snapshotItems.map(item => ({
          name: item.name,
          quantity: item.quantity * studentCount,
          unitPrice: Number(item.price),
          totalPrice: Number(item.price) * item.quantity * studentCount,
        }))

        const invoiceResult = await createInvoice({
          orderNumber: previousOrder.orderNumber,
          customerName: previousOrder.parentName,
          customerEmail: previousOrder.email || undefined,
          customerPhone: previousOrder.phone,
          customerAddress: previousOrder.invoiceAddress || previousOrder.address || previousOrder.class.school.address || undefined,
          isCorporate: previousOrder.isCorporateInvoice,
          taxNumber: previousOrder.taxNumber || undefined,
          taxOffice: previousOrder.taxOffice || undefined,
          city: previousOrder.city || undefined,
          district: previousOrder.district || undefined,
          items: invoiceItems,
          totalAmount: Number(previousOrder.totalAmount)
        })

        if (invoiceResult.success && invoiceResult.invoiceNo) {
          const invoiceDate = new Date()
          await prisma.order.update({
            where: { id },
            data: {
              invoiceNo: invoiceResult.invoiceNo,
              invoicePdfPath: invoiceResult.invoiceUrl,
              invoiceDate,
              invoicedAt: invoiceDate,
            }
          })
          order.invoiceNo = invoiceResult.invoiceNo
          order.invoicePdfPath = invoiceResult.invoiceUrl ?? null
          order.invoiceDate = invoiceDate
          order.invoicedAt = invoiceDate

          await logAction({
            userId: session.id,
            userType: 'ADMIN',
            action: 'AUTO_INVOICE_CREATED',
            entity: 'ORDER',
            entityId: order.id,
            details: { orderNumber: previousOrder.orderNumber, invoiceNo: invoiceResult.invoiceNo, trigger: 'COMPLETED' },
          }).catch(() => {})

          if (previousOrder.email) {
            sendInvoiceCreated({
              email: previousOrder.email,
              orderNumber: previousOrder.orderNumber,
              parentName: previousOrder.parentName,
              invoiceNo: invoiceResult.invoiceNo,
              totalAmount: Number(previousOrder.totalAmount),
              locale: (previousOrder.locale ?? undefined) as ('tr'|'en'|'de'|'ar' | undefined),
            }).catch(err => console.error('Fatura bildirim maili gonderilemedi:', err))
          }
        } else {
          console.error('[orders PUT] COMPLETED otomatik fatura basarisiz:', invoiceResult.errorMessage)
        }
      } catch (err) {
        console.error('[orders PUT] COMPLETED otomatik fatura hatasi:', err)
      }
    }

    return NextResponse.json({ order })
  } catch (error) {
    console.error('Siparis guncellenemedi:', error)
    return NextResponse.json(
      { error: t('orders.orderUpdateFailed') },
      { status: 500 }
    )
  }
}

/**
 * Siparisi KALICI siler (admin). Alt kayitlar (OrderStudent/OrderItem) cascade ile,
 * iptal talebi (CancelRequest, cascade YOK) manuel silinir. Kullanilmis indirim sayaci
 * geri alinir. SHIPPED + CARGO + trackingNo varsa Yurtici kargosu best-effort iptal edilir.
 */
export async function DELETE(
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
      include: { class: { include: { school: true } }, cancelRequest: true }
    })
    if (!order) {
      return NextResponse.json({ error: t('orders.orderNotFound') }, { status: 404 })
    }

    // SHIPPED + CARGO + trackingNo: Yurtici kargosunu iptal et (best-effort; silmeyi bloklamaz)
    let cargoCancelNote: string | undefined
    if (order.status === 'SHIPPED' && order.class.school.deliveryType === 'CARGO' && order.trackingNo) {
      try {
        const r = await cancelShipment(order.trackingNo)
        cargoCancelNote = r.success ? 'cancelled' : `failed: ${r.message || ''}`
      } catch (e) {
        cargoCancelNote = 'error'
        console.error('Silme oncesi kargo iptali hatasi:', e)
      }
    }

    await prisma.$transaction(async (tx) => {
      if (order.cancelRequest) {
        await tx.cancelRequest.delete({ where: { orderId: id } })
      }
      await tx.order.delete({ where: { id } })
      // Kullanilmis indirimi geri al (siparis discountCode tutar)
      if (order.discountCode) {
        await tx.$executeRaw`
          UPDATE discounts SET usedCount = usedCount - 1, updatedAt = NOW(3)
          WHERE code = ${order.discountCode} AND usedCount > 0
        `
      }
    })

    await logAction({
      userId: session.id,
      userType: 'ADMIN',
      action: 'DELETE',
      entity: 'ORDER',
      entityId: id,
      details: {
        orderNumber: order.orderNumber,
        status: order.status,
        trackingNo: order.trackingNo,
        discountCode: order.discountCode,
        cargoCancelNote
      }
    })

    return NextResponse.json({ success: true, cargoCancelNote })
  } catch (error) {
    console.error('Siparis silinemedi:', error)
    return NextResponse.json(
      { error: t('orders.orderUpdateFailed') },
      { status: 500 }
    )
  }
}
