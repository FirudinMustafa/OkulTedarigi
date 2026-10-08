import { NextResponse } from 'next/server'
import type { OrderStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/auth'
import { REVENUE_STATUSES, COMMISSION_STATUSES, ACTIVE_SCHOOL_WHERE, UNPAID_STATUSES } from '@/lib/constants'
import { getPaymentCommissionRate } from '@/lib/settings'
import { getApiLocale } from '@/lib/api-locale'
import { getTranslations } from 'next-intl/server'
import { resolveReportRange, rangeWhere, ymd } from '@/lib/report-range'
import { orderCommission, round2 } from '@/lib/commission'


export async function GET(request: Request) {
  const t = await getTranslations({ locale: await getApiLocale(), namespace: 'apiErrors' })
  try {
    const session = await getAdminSession()
    if (!session) {
      return NextResponse.json({ error: t('adminMisc.unauthorized') }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    // Tarih araligi: Excel export ile AYNI fonksiyon (lib/report-range)
    const dateWhere = rangeWhere(resolveReportRange(searchParams))

    const paymentCommissionRate = await getPaymentCommissionRate()

    const [orders, schoolCount, classCount] = await Promise.all([
      prisma.order.findMany({
        where: { ...dateWhere, status: { notIn: UNPAID_STATUSES as OrderStatus[] } },
        include: {
          class: {
            include: {
              school: { select: { id: true, name: true, deliveryType: true } }
            }
          },
          _count: { select: { students: true } }
        }
      }),
      prisma.school.count({ where: ACTIVE_SCHOOL_WHERE }),
      prisma.class.count({ where: { isActive: true } })
    ])

    // Ciroya dahil siparisler
    const revenueOrders = orders.filter(o => REVENUE_STATUSES.includes(o.status))
    const totalOrders = orders.length
    const revenueOrderCount = revenueOrders.length
    const totalRevenue = round2(revenueOrders.reduce((acc, o) => acc + Number(o.totalAmount), 0))

    // Ortalama: payda ciroya dahil siparisler (audit duzeltmesi)
    const averageOrderValue = revenueOrderCount > 0 ? round2(totalRevenue / revenueOrderCount) : 0

    // Odeme entegrasyonu komisyonu + net hesaplari
    const paymentCommissionAmount = round2(totalRevenue * paymentCommissionRate / 100)
    const netAfterPayment = round2(totalRevenue - paymentCommissionAmount)

    // Okul hakedisi toplami (lib/commission ile ayni: siparis anindaki, ogrenci basina hakedis)
    const totalSchoolCommission = round2(
      orders
        .filter(o => COMMISSION_STATUSES.includes(o.status))
        .reduce((acc, o) => acc + orderCommission(o, o.class.commissionAmount), 0)
    )
    const netProfit = round2(netAfterPayment - totalSchoolCommission)

    const completedOrders = orders.filter(o => o.status === 'COMPLETED').length
    const cancelledOrders = orders.filter(o => o.status === 'CANCELLED' || o.status === 'REFUNDED').length

    // Durum dagilimi
    const ordersByStatus: Record<string, number> = {}
    orders.forEach(order => {
      ordersByStatus[order.status] = (ordersByStatus[order.status] || 0) + 1
    })

    // Teslimat tipi dagilimi
    const ordersByDeliveryType = {
      CARGO: orders.filter(o => o.class.school.deliveryType === 'CARGO').length,
      SCHOOL: orders.filter(o => o.class.school.deliveryType === 'SCHOOL_DELIVERY').length
    }

    // Okul bazli istatistikler
    const schoolStats: Record<string, { name: string; orders: number; revenue: number }> = {}
    orders.forEach(order => {
      const schoolId = order.class.school.id
      const schoolName = order.class.school.name
      if (!schoolStats[schoolId]) {
        schoolStats[schoolId] = { name: schoolName, orders: 0, revenue: 0 }
      }
      schoolStats[schoolId].orders++
      if (REVENUE_STATUSES.includes(order.status)) {
        schoolStats[schoolId].revenue += Number(order.totalAmount)
      }
    })
    const topSchools = Object.values(schoolStats)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)

    // Gunluk dokum: gun -> { orders, revenue, paymentFee, net }
    const dayMap: Record<string, { orders: number; revenue: number }> = {}
    orders.forEach(order => {
      const key = ymd(order.createdAt)
      if (!dayMap[key]) dayMap[key] = { orders: 0, revenue: 0 }
      dayMap[key].orders++
      if (REVENUE_STATUSES.includes(order.status)) {
        dayMap[key].revenue += Number(order.totalAmount)
      }
    })
    const dailyBreakdown = Object.entries(dayMap)
      .map(([date, v]) => {
        const revenue = round2(v.revenue)
        const paymentFee = round2(revenue * paymentCommissionRate / 100)
        return { date, orders: v.orders, revenue, paymentFee, net: round2(revenue - paymentFee) }
      })
      .sort((a, b) => a.date.localeCompare(b.date))

    return NextResponse.json({
      totalRevenue,
      totalOrders,
      revenueOrderCount,
      averageOrderValue,
      completedOrders,
      cancelledOrders,
      schoolCount,
      classCount,
      // Komisyon / kazanc
      paymentCommissionRate,
      paymentCommissionAmount,
      netAfterPayment,
      totalSchoolCommission,
      netProfit,
      // Dagitimlar
      ordersByStatus,
      ordersByDeliveryType,
      topSchools,
      dailyBreakdown,
      monthlyRevenue: []
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('Rapor olusturulamadi:', error)
    return NextResponse.json(
      { error: t('adminMisc.reportLoadFailed') },
      { status: 500 }
    )
  }
}
