import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/auth'
import { ACTIVE_SCHOOL_WHERE, REVENUE_STATUSES, UNPAID_STATUSES } from '@/lib/constants'
import { Prisma, type OrderStatus } from '@prisma/client'
import { getApiLocale } from '@/lib/api-locale'
import { getTranslations } from 'next-intl/server'
import { unstable_cache } from 'next/cache'

// Veri cekimi ~21 sorgu/cagri — kimlik dogrulamadan bagimsiz, kisa TTL'li cache
// ile tekrarli dashboard yuklemelerinde DB'ye tekrar tekrar gidilmesi engellenir.
const getDashboardData = unstable_cache(
  async () => {
    // Get date ranges
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const startOfWeek = new Date(now)
    startOfWeek.setDate(now.getDate() - 7)
    // Odenmemis (terk edilmis checkout) siparisler hicbir sayima girmez
    const paidOnly = { status: { notIn: UNPAID_STATUSES as OrderStatus[] } }
    const revenueIn = Prisma.join(REVENUE_STATUSES)
    const unpaidIn = Prisma.join(UNPAID_STATUSES)

    // Basic counts
    const [
      totalOrders,
      pendingOrders,
      completedOrders,
      totalSchools,
      totalClasses,
      totalPackages,
      cancelRequests,
      todayOrders
    ] = await Promise.all([
      prisma.order.count({
        where: { status: { notIn: UNPAID_STATUSES as OrderStatus[] } }
      }),
      prisma.order.count({
        where: { status: { in: ['PAID', 'CONFIRMED', 'SHIPPED', 'UNDELIVERED'] } }
      }),
      prisma.order.count({
        where: { status: 'COMPLETED' }
      }),
      prisma.school.count({ where: ACTIVE_SCHOOL_WHERE }),
      prisma.class.count({ where: { isActive: true } }),
      prisma.package.count({ where: { isActive: true } }),
      prisma.cancelRequest.count({ where: { status: 'PENDING' } }),
      prisma.order.count({
        where: { ...paidOnly, createdAt: { gte: startOfToday } }
      })
    ])

    // Revenue calculations
    const [totalRevenue, monthlyRevenue, lastMonthRevenue, weeklyRevenue] = await Promise.all([
      prisma.order.aggregate({
        where: { status: { in: REVENUE_STATUSES as OrderStatus[] } },
        _sum: { totalAmount: true }
      }),
      prisma.order.aggregate({
        where: {
          status: { in: REVENUE_STATUSES as OrderStatus[] },
          createdAt: { gte: startOfMonth }
        },
        _sum: { totalAmount: true }
      }),
      prisma.order.aggregate({
        where: {
          status: { in: REVENUE_STATUSES as OrderStatus[] },
          // lt ayin 1'i: gecen ayin SON GUNU de dahil (lte son-gun-00:00 o gunu disarida birakiyordu)
          createdAt: { gte: startOfLastMonth, lt: startOfMonth }
        },
        _sum: { totalAmount: true }
      }),
      prisma.order.aggregate({
        where: {
          status: { in: REVENUE_STATUSES as OrderStatus[] },
          createdAt: { gte: startOfWeek }
        },
        _sum: { totalAmount: true }
      })
    ])

    // Order status distribution
    const ordersByStatus = await prisma.order.groupBy({
      by: ['status'],
      where: paidOnly,
      _count: { status: true }
    })

    // Okul bazli: okul ID'sine gore (ayni adli iki okul birlesmesin), siparis sayisina gore
    // sirali. Sayi = odenmis siparisler; ciro = yalniz REVENUE_STATUSES.
    const schoolRows = await prisma.$queryRaw<Array<{ id: string; name: string; orders: bigint; revenue: number | string | null }>>`
      SELECT s.id AS id, s.name AS name,
        COUNT(*) AS orders,
        COALESCE(SUM(CASE WHEN o.status IN (${revenueIn}) THEN o.totalAmount ELSE 0 END), 0) AS revenue
      FROM orders o
      JOIN classes c ON c.id = o.classId
      JOIN schools s ON s.id = c.schoolId
      WHERE o.status NOT IN (${unpaidIn})
      GROUP BY s.id, s.name
      ORDER BY orders DESC
      LIMIT 50
    `
    const schoolStats = schoolRows.map(r => ({
      name: r.name,
      orders: Number(r.orders),
      revenue: Number(r.revenue || 0)
    }))

    // Gunluk/aylik grafikler: createdAt DB'de UTC tutulur -> gun/ay Turkiye saatine (UTC+3,
    // yaz saati yok) cevrilerek gruplanir. Sayi = odenmis siparisler; ciro = REVENUE_STATUSES
    // (karttaki "Toplam Ciro" ile ayni tanim).
    const dailyOrders = await prisma.$queryRaw<Array<{ date: string; count: bigint; revenue: number }>>`
      SELECT
        DATE_FORMAT(CONVERT_TZ(createdAt, '+00:00', '+03:00'), '%Y-%m-%d') as date,
        COUNT(*) as count,
        COALESCE(SUM(CASE WHEN status IN (${revenueIn}) THEN totalAmount ELSE 0 END), 0) as revenue
      FROM orders
      WHERE createdAt >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 7 DAY)
        AND status NOT IN (${unpaidIn})
      GROUP BY date
      ORDER BY date ASC
    `

    const monthlyOrders = await prisma.$queryRaw<Array<{ month: string; count: bigint; revenue: number }>>`
      SELECT
        DATE_FORMAT(CONVERT_TZ(createdAt, '+00:00', '+03:00'), '%Y-%m') as month,
        COUNT(*) as count,
        COALESCE(SUM(CASE WHEN status IN (${revenueIn}) THEN totalAmount ELSE 0 END), 0) as revenue
      FROM orders
      WHERE createdAt >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 6 MONTH)
        AND status NOT IN (${unpaidIn})
      GROUP BY month
      ORDER BY month ASC
    `

    // Recent orders
    const recentOrders = await prisma.order.findMany({
      where: paidOnly,
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        class: {
          include: {
            school: { select: { name: true } }
          }
        },
        package: { select: { name: true } }
      }
    })

    // Delivery stats
    const deliveryStats = await Promise.all([
      prisma.order.count({ where: { status: 'SHIPPED' } }),
      prisma.order.count({ where: { status: 'UNDELIVERED' } }),
      prisma.order.count({ where: { status: 'COMPLETED' } })
    ])

    // Calculate growth
    const currentMonthRev = Number(monthlyRevenue._sum.totalAmount || 0)
    const lastMonthRev = Number(lastMonthRevenue._sum.totalAmount || 0)
    const revenueGrowth = lastMonthRev > 0
      ? ((currentMonthRev - lastMonthRev) / lastMonthRev * 100).toFixed(1)
      : '0'

    return {
      summary: {
        totalOrders,
        pendingOrders,
        completedOrders,
        totalSchools,
        totalClasses,
        totalPackages,
        cancelRequests,
        todayOrders,
        totalRevenue: Number(totalRevenue._sum.totalAmount || 0),
        monthlyRevenue: currentMonthRev,
        weeklyRevenue: Number(weeklyRevenue._sum.totalAmount || 0),
        revenueGrowth
      },
      ordersByStatus: ordersByStatus.map(s => ({
        status: s.status,
        count: s._count.status
      })),
      schoolStats,
      dailyOrders: dailyOrders.map(d => ({
        date: String(d.date),
        orders: Number(d.count),
        revenue: Number(d.revenue)
      })),
      monthlyOrders: monthlyOrders.map(m => ({
        month: m.month,
        orders: Number(m.count),
        revenue: Number(m.revenue)
      })),
      recentOrders: recentOrders.map(o => ({
        id: o.id,
        orderNumber: o.orderNumber,
        studentName: o.studentName,
        parentName: o.parentName,
        schoolName: o.class.school.name,
        className: o.class.name,
        packageName: o.package.name,
        totalAmount: Number(o.totalAmount),
        status: o.status,
        createdAt: o.createdAt.toISOString()
      })),
      deliveryStats: {
        shipped: deliveryStats[0],
        undelivered: deliveryStats[1],
        completed: deliveryStats[2]
      }
    }
  },
  ['admin-dashboard-stats'],
  { revalidate: 30, tags: ['admin-dashboard'] }
)

export async function GET() {
  const t = await getTranslations({ locale: await getApiLocale(), namespace: 'apiErrors' })
  try {
    const session = await getAdminSession()
    if (!session) {
      return NextResponse.json({ error: t('adminMisc.unauthorized') }, { status: 401 })
    }

    const data = await getDashboardData()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Dashboard stats error:', error)
    return NextResponse.json(
      { error: t('adminMisc.dashboardLoadFailed') },
      { status: 500 }
    )
  }
}
