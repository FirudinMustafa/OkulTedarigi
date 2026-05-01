import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/auth'
import { REVENUE_STATUSES } from '@/lib/constants'

export async function GET(request: Request) {
  try {
    const session = await getAdminSession()
    if (!session) {
      return NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'all'

    // Tarih filtresi olustur
    let dateFilter: Date | undefined
    const now = new Date()

    switch (period) {
      case 'today':
        dateFilter = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        break
      case 'week':
        dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case 'month':
        dateFilter = new Date(now.getFullYear(), now.getMonth(), 1)
        break
    }

    const dateWhere = dateFilter ? { createdAt: { gte: dateFilter } } : {}

    // Temel istatistikler
    const [
      orders,
      schoolCount,
      classCount
    ] = await Promise.all([
      prisma.order.findMany({
        where: dateWhere,
        include: {
          class: {
            include: {
              school: { select: { id: true, name: true, deliveryType: true } }
            }
          }
        }
      }),
      prisma.school.count({ where: { isActive: true } }),
      prisma.class.count({ where: { isActive: true } })
    ])

    // Hesaplamalar
    const totalOrders = orders.length
    const totalRevenue = orders
      .filter(o => REVENUE_STATUSES.includes(o.status))
      .reduce((acc, o) => acc + Number(o.totalAmount), 0)
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0
    const completedOrders = orders.filter(o => o.status === 'COMPLETED').length
    const cancelledOrders = orders.filter(o => o.status === 'CANCELLED').length

    // Durum dagilimi
    const ordersByStatus: Record<string, number> = {}
    orders.forEach(order => {
      ordersByStatus[order.status] = (ordersByStatus[order.status] || 0) + 1
    })

    // Teslimat tipi dagilimi (okul bazinda)
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

    return NextResponse.json({
      totalRevenue,
      totalOrders,
      averageOrderValue,
      completedOrders,
      cancelledOrders,
      schoolCount,
      classCount,
      ordersByStatus,
      ordersByDeliveryType,
      topSchools,
      monthlyRevenue: [] // Ileride eklenebilir
    })
  } catch (error) {
    console.error('Rapor olusturulamadi:', error)
    return NextResponse.json(
      { error: 'Rapor yuklenemedi' },
      { status: 500 }
    )
  }
}
