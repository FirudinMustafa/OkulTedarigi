import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/auth'
import { logAction } from '@/lib/logger'
import { getApiLocale } from '@/lib/api-locale'
import { getTranslations } from 'next-intl/server'

/**
 * SISTEM VERILERINI SIFIRLA (KALICI, geri alinamaz) — admin.
 * Tum siparisleri ve siparis-turevli/finansal kayitlari siler ki dashboard,
 * raporlar ve hakedis rakamlari sifirlanip bundan sonraki siparisler temiz sayilsin.
 *
 * Silinenler:
 *  - cancel_requests (FK cascade YOK, once silinir)
 *  - orders (order_students / order_items cascade ile)
 *  - school_payments (hakedis odeme gecmisi)
 *  - discounts.usedCount -> 0 (indirim kullanim sayaclari)
 *  - system_logs (audit) — sifirlama kaydi yeniden yazilir
 *
 * KORUNUR (config): schools, classes (commissionAmount dahil), packages, package_items,
 *                   discounts (kodlarin kendisi), admins.
 *
 * Guvenlik: body.confirm === 'SIFIRLA' olmali (yanlislikla calismayi engeller).
 */
export async function POST(request: Request) {
  const t = await getTranslations({ locale: await getApiLocale(), namespace: 'apiErrors' })
  try {
    const session = await getAdminSession()
    if (!session) {
      return NextResponse.json({ error: t('orders.unauthorized') }, { status: 401 })
    }

    const body = await request.json().catch(() => ({})) as { confirm?: string }
    if (body?.confirm !== 'SIFIRLA') {
      return NextResponse.json(
        { error: 'Onay kelimesi hatali — islem yapilmadi.' },
        { status: 400 }
      )
    }

    // Silinecek kayit sayilari (rapor icin, silmeden once)
    const [orders, schoolPayments, systemLogs, cancelRequests] = await Promise.all([
      prisma.order.count(),
      prisma.schoolPayment.count(),
      prisma.systemLog.count(),
      prisma.cancelRequest.count(),
    ])

    await prisma.$transaction(async (tx) => {
      await tx.cancelRequest.deleteMany({})
      await tx.order.deleteMany({}) // order_students + order_items DB cascade ile silinir
      await tx.schoolPayment.deleteMany({})
      await tx.$executeRaw`UPDATE discounts SET usedCount = 0, updatedAt = NOW(3)`
      await tx.systemLog.deleteMany({})
    })

    // Temiz audit'e tek kayit: sifirlamanin kendisi
    await logAction({
      userId: session.id,
      userType: 'ADMIN',
      action: 'SYSTEM_RESET',
      entity: 'USER',
      details: { deletedOrders: orders, deletedSchoolPayments: schoolPayments, deletedSystemLogs: systemLogs, deletedCancelRequests: cancelRequests },
    })

    return NextResponse.json({
      success: true,
      deleted: { orders, schoolPayments, systemLogs, cancelRequests },
    })
  } catch (error) {
    console.error('Sistem sifirlama hatasi:', error)
    return NextResponse.json({ error: t('orders.orderUpdateFailed') }, { status: 500 })
  }
}
