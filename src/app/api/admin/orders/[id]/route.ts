import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/auth'
import { logAction } from '@/lib/logger'
import { VALID_STATUS_TRANSITIONS } from '@/lib/constants'
import { cancelShipment } from '@/lib/yurtici-kargo'
import { autoInvoiceOrderOnComplete } from '@/lib/auto-invoice'
import { adminOrderUpdateSchema, formatZodError } from '@/lib/validators'
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

    const parsed = adminOrderUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: formatZodError(parsed.error, await getApiLocale()) },
        { status: 400 }
      )
    }

    // Sadece body'de gonderilen (undefined olmayan) alanlar guncellenir
    const updateData: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(parsed.data)) {
      if (value !== undefined) updateData[key] = value
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: t('orders.noFieldsToUpdate') }, { status: 400 })
    }

    // Mevcut siparisi tek bir okumayla cek (audit trail icin onceki degerler)
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
      const invoiceUpdate = await autoInvoiceOrderOnComplete(id, session.id)
      if (invoiceUpdate) {
        order.invoiceNo = invoiceUpdate.invoiceNo
        order.invoicePdfPath = invoiceUpdate.invoicePdfPath
        order.invoiceDate = invoiceUpdate.invoiceDate
        order.invoicedAt = invoiceUpdate.invoicedAt
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

    // Yasal saklama (VUK/TTK): gercek odeme veya fatura kaydi olan siparisler kalici silinemez —
    // School/Class silme guard'iyla ayni ilke (bkz. admin/schools/[id]/route.ts DELETE).
    if (order.paidAt || order.invoiceNo) {
      return NextResponse.json({ error: t('orders.deleteBlockedRetention') }, { status: 409 })
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
