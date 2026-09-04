import { NextResponse } from 'next/server'
import type { OrderStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/auth'
import { REVENUE_STATUSES, COMMISSION_STATUSES, ACTIVE_SCHOOL_WHERE, UNPAID_STATUSES } from '@/lib/constants'
import { getPaymentCommissionRate } from '@/lib/settings'
import { getApiLocale } from '@/lib/api-locale'
import { getTranslations } from 'next-intl/server'

const round2 = (n: number) => Math.round(n * 100) / 100

// Sunucu yerel saatine gore gun siniri (mevcut "today/week/month" mantigiyla tutarli)
function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0)
}
function endOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)
}
// 'YYYY-MM-DD' -> yerel Date (UTC kaymasi olmadan)
function parseYmd(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}
function ymd(d: Date): string {
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const da = String(d.getDate()).padStart(2, '0')
  return `${y}-${mo}-${da}`
}

export async function GET(request: Request) {
  const t = await getTranslations({ locale: await getApiLocale(), namespace: 'apiErrors' })
  try {
    const session = await getAdminSession()
    if (!session) {
      return NextResponse.json({ error: t('adminMisc.unauthorized') }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'all'
    const fromParam = searchParams.get('from')
    const toParam = searchParams.get('to')

    // Tarih araligi olustur: ozel from/to onceliklidir, yoksa period preset.
    let gte: Date | undefined
    let lte: Date | undefined
    const now = new Date()

    if (fromParam || toParam) {
      const from = fromParam ? parseYmd(fromParam) : null
      const to = toParam ? parseYmd(toParam) : null
      if (from) gte = startOfDay(from)
      if (to) lte = endOfDay(to)
    } else {
      switch (period) {
        case 'today':
          gte = startOfDay(now)
          break
        case 'yesterday': {
          const y = new Date(now.getTime() - 24 * 60 * 60 * 1000)
          gte = startOfDay(y)
          lte = endOfDay(y)
          break
        }
        case 'week':
          gte = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          break
        case 'month':
          gte = new Date(now.getFullYear(), now.getMonth(), 1)
          break
      }
    }

    const createdAt: { gte?: Date; lte?: Date } = {}
    if (gte) createdAt.gte = gte
    if (lte) createdAt.lte = lte
    const dateWhere = (gte || lte) ? { createdAt } : {}

    const paymentCommissionRate = await getPaymentCommissionRate()

    const [orders, schoolCount, classCount] = await Promise.all([
      prisma.order.findMany({
        where: { ...dateWhere, status: { notIn: UNPAID_STATUSES as OrderStatus[] } },
        include: {
          class: {
            include: {
              school: { select: { id: true, name: true, deliveryType: true } }
            }
          }
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

    // Okul hakedisi toplami (payments/summaries ile tutarli: hakedise dahil siparis basina class komisyonu)
    const totalSchoolCommission = round2(
      orders
        .filter(o => COMMISSION_STATUSES.includes(o.status))
        .reduce((acc, o) => acc + Number(o.class.commissionAmount), 0)
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
