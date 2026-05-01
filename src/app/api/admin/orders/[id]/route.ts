import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/auth'
import { logAction } from '@/lib/logger'
import { VALID_STATUS_TRANSITIONS } from '@/lib/constants'

export async function GET(
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
        },
        cancelRequest: true
      }
    })

    if (!order) {
      return NextResponse.json({ error: 'Siparis bulunamadi' }, { status: 404 })
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
      { error: 'Siparis yuklenemedi' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession()
    if (!session) {
      return NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 401 })
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
      return NextResponse.json({ error: 'Guncellenecek alan bulunamadi' }, { status: 400 })
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
      }
    })
    if (!previousOrder) {
      return NextResponse.json({ error: 'Siparis bulunamadi' }, { status: 404 })
    }

    // Status degisikligi varsa gecerli gecis kontrolu
    if (updateData.status) {
      const allowedTransitions = VALID_STATUS_TRANSITIONS[previousOrder.status] || []
      if (!allowedTransitions.includes(updateData.status as string)) {
        return NextResponse.json(
          { error: `${previousOrder.status} durumundan ${updateData.status} durumuna gecis yapilamaz` },
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
          { error: 'Bu siparisin durumu baska bir kullanici tarafindan degistirildi. Sayfayi yenileyip tekrar deneyin.' },
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
      return NextResponse.json({ error: 'Siparis bulunamadi' }, { status: 404 })
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

    return NextResponse.json({ order })
  } catch (error) {
    console.error('Siparis guncellenemedi:', error)
    return NextResponse.json(
      { error: 'Siparis guncellenemedi' },
      { status: 500 }
    )
  }
}
