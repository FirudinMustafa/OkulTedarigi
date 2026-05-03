import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/auth'

export async function GET() {
  try {
    const session = await getAdminSession()
    if (!session) {
      return NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 401 })
    }

    // Get date ranges
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)
    const startOfWeek = new Date(now)
    startOfWeek.setDate(now.getDate() - 7)

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
      prisma.order.count(),
      prisma.order.count({
        where: { status: { in: ['NEW', 'PAYMENT_PENDING', 'PAID', 'CONFIRMED', 'INVOICED'] } }
      }),
      prisma.order.count({
        where: { status: 'COMPLETED' }
      }),
      prisma.school.count({ where: { isActive: true } }),
      prisma.class.count({ where: { isActive: true } }),
      prisma.package.count({ where: { isActive: true } }),
      prisma.cancelRequest.count({ where: { status: 'PENDING' } }),
      prisma.order.count({
        where: {
          createdAt: { gte: new Date(now.setHours(0, 0, 0, 0)) }
        }
      })
    ])

    // Revenue calculations
    const [totalRevenue, monthlyRevenue, lastMonthRevenue, weeklyRevenue] = await Promise.all([
      prisma.order.aggregate({
        where: { status: { in: ['PAID', 'CONFIRMED', 'INVOICED', 'SHIPPED', 'DELIVERED', 'COMPLETED'] } },
        _sum: { totalAmount: true }
      }),
      prisma.order.aggregate({
        where: {
          status: { in: ['PAID', 'CONFIRMED', 'INVOICED', 'SHIPPED', 'DELIVERED', 'COMPLETED'] },
          createdAt: { gte: startOfMonth }
        },
        _sum: { totalAmount: true }
      }),
      prisma.order.aggregate({
        where: {
          status: { in: ['PAID', 'CONFIRMED', 'INVOICED', 'SHIPPED', 'DELIVERED', 'COMPLETED'] },
          createdAt: { gte: startOfLastMonth, lte: endOfLastMonth }
        },
        _sum: { totalAmount: true }
      }),
      prisma.order.aggregate({
        where: {
          status: { in: ['PAID', 'CONFIRMED', 'INVOICED', 'SHIPPED', 'DELIVERED', 'COMPLETED'] },
          createdAt: { gte: startOfWeek }
        },
        _sum: { totalAmount: true }
      })
    ])

    // Order status distribution
    const ordersByStatus = await prisma.order.groupBy({
      by: ['status'],
      _count: { status: true }
    })

    // Orders by school
    const ordersBySchool = await prisma.order.groupBy({
      by: ['classId'],
      _count: { id: true },
      _sum: { totalAmount: true }
    })

    // Get school names for the orders
    const classIds = ordersBySchool.map(o => o.classId)
    const classes = await prisma.class.findMany({
      where: { id: { in: classIds } },
      include: { school: { select: { name: true } } }
    })

    const schoolOrderMap = new Map<string, { orders: number; revenue: number }>()
    ordersBySchool.forEach(order => {
      const classInfo = classes.find(c => c.id === order.classId)
      if (classInfo) {
        const schoolName = classInfo.school.name
        const existing = schoolOrderMap.get(schoolName) || { orders: 0, revenue: 0 }
        schoolOrderMap.set(schoolName, {
          orders: existing.orders + order._count.id,
          revenue: existing.revenue + Number(order._sum.totalAmount || 0)
        })
      }
    })

    const schoolStats = Array.from(schoolOrderMap.entries()).map(([name, data]) => ({
      name,
      orders: data.orders,
      revenue: data.revenue
    }))

    // Daily orders for the last 7 days
    const dailyOrders = await prisma.$queryRaw<Array<{ date: Date; count: bigint; revenue: number }>>`
      SELECT
        DATE(createdAt) as date,
        COUNT(*) as count,
        COALESCE(SUM(totalAmount), 0) as revenue
      FROM orders
      WHERE createdAt >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      GROUP BY DATE(createdAt)
      ORDER BY date ASC
    `

    // Monthly orders for the last 6 months
    const monthlyOrders = await prisma.$queryRaw<Array<{ month: string; count: bigint; revenue: number }>>`
      SELECT
        DATE_FORMAT(createdAt, '%Y-%m') as month,
        COUNT(*) as count,
        COALESCE(SUM(totalAmount), 0) as revenue
      FROM orders
      WHERE createdAt >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
      GROUP BY DATE_FORMAT(createdAt, '%Y-%m')
      ORDER BY month ASC
    `

    // Recent orders
    const recentOrders = await prisma.order.findMany({
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
      prisma.order.count({ where: { status: 'DELIVERED' } }),
      prisma.order.count({ where: { status: 'COMPLETED' } })
    ])

    // Calculate growth
    const currentMonthRev = Number(monthlyRevenue._sum.totalAmount || 0)
    const lastMonthRev = Number(lastMonthRevenue._sum.totalAmount || 0)
    const revenueGrowth = lastMonthRev > 0
      ? ((currentMonthRev - lastMonthRev) / lastMonthRev * 100).toFixed(1)
      : '0'

    return NextResponse.json({
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
        date: d.date.toISOString().split('T')[0],
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
        delivered: deliveryStats[1],
        completed: deliveryStats[2]
      }
    })
  } catch (error) {
    console.error('Dashboard stats error:', error)
    return NextResponse.json(
      { error: 'Dashboard verileri alinamadi' },
      { status: 500 }
    )
  }
}
