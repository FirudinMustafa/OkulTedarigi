import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/auth'
import { logAction } from '@/lib/logger'
import { cancelShipment } from '@/lib/yurtici-kargo'
import { getApiLocale } from '@/lib/api-locale'
import { getTranslations } from 'next-intl/server'

/**
 * Kargo Iptali: yanlislikla kargolanmis (SHIPPED) bir siparisin Yurtici kaydini iptal eder.
 * Basarili olursa siparis CONFIRMED'e geri doner ve trackingNo temizlenir -> tekrar kargolanabilir.
 * (Yurtici'de iptal edilen cargoKey serbest kalir; ayni siparis no ile yeniden kargolama calisir.)
 */
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
      include: { class: { include: { school: true } } }
    })

    if (!order) {
      return NextResponse.json({ error: t('orders.orderNotFound') }, { status: 404 })
    }

    if (order.class.school.deliveryType !== 'CARGO') {
      return NextResponse.json({ error: t('orders.notCargoDelivery') }, { status: 400 })
    }

    if (order.status !== 'SHIPPED' || !order.trackingNo) {
      return NextResponse.json(
        { error: 'Yalnizca kargolanmis (Dagitimda) ve takip numarasi olan siparislerin kargosu iptal edilebilir.' },
        { status: 400 }
      )
    }

    // Yurtici'de iptal et (basarisizsa siparise dokunma)
    let cancelResult
    try {
      cancelResult = await cancelShipment(order.trackingNo)
    } catch (cargoErr) {
      console.error('Yurtici kargo iptali teknik hata:', cargoErr)
      return NextResponse.json(
        { error: 'Yurtici kargo iptali sirasinda teknik bir hata olustu, tekrar deneyin.' },
        { status: 500 }
      )
    }

    if (!cancelResult.success) {
      return NextResponse.json(
        { error: cancelResult.message || 'Yurtici kargo iptali basarisiz.' },
        { status: 400 }
      )
    }

    // Atomic: yalnizca hala SHIPPED + ayni trackingNo ise geri al
    const revert = await prisma.order.updateMany({
      where: { id, status: 'SHIPPED', trackingNo: order.trackingNo },
      data: { status: 'CONFIRMED', trackingNo: null, shippedAt: null }
    })
    if (revert.count === 0) {
      return NextResponse.json(
        { error: t('orders.statusChangedByAnother') },
        { status: 409 }
      )
    }

    await logAction({
      userId: session.id,
      userType: 'ADMIN',
      action: 'CANCEL',
      entity: 'SHIPMENT',
      entityId: order.id,
      details: {
        orderNumber: order.orderNumber,
        trackingNo: order.trackingNo,
        cargoMessage: cancelResult.message
      }
    })

    return NextResponse.json({ success: true, message: cancelResult.message })
  } catch (error) {
    console.error('Kargo iptal edilemedi:', error)
    return NextResponse.json({ error: t('orders.shipmentCreateFailed') }, { status: 500 })
  }
}
