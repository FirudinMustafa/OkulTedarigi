import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/auth'

export async function GET() {
  try {
    const session = await getAdminSession()
    if (!session) {
      return NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 401 })
    }

    const schools = await prisma.school.findMany({
      where: { isActive: true },
      include: {
        classes: {
          include: {
            orders: {
              where: {
                status: {
                  in: ['PAID', 'CONFIRMED', 'INVOICED', 'PREPARING', 'SHIPPED', 'DELIVERED', 'COMPLETED']
                }
              }
            }
          }
        },
        schoolPayments: true
      }
    })

    const summaries = schools.map(school => {
      let totalCommission = 0
      let totalOrders = 0
      let totalRevenue = 0

      school.classes.forEach(classItem => {
        const classOrders = classItem.orders
        totalOrders += classOrders.length
        totalCommission += Number(classItem.commissionAmount) * classOrders.length
        totalRevenue += classOrders.reduce((acc: number, order) => acc + Number(order.totalAmount), 0)
      })

      // Fiilen ödenmiş (status=PAID)
      const paid = school.schoolPayments
        .filter(p => p.status === 'PAID')
        .reduce((acc, p) => acc + Number(p.amount), 0)

      // Onay bekleyen ödeme kayıtları (admin oluşturdu, henüz "Ödendi İşaretle" basmadı)
      const pendingPayments = school.schoolPayments
        .filter(p => p.status === 'PENDING')
        .reduce((acc, p) => acc + Number(p.amount), 0)

      // Henüz commit edilmemiş kalan komisyon — yeni ödeme oluştururken kullanılacak
      const remaining = Math.max(totalCommission - paid - pendingPayments, 0)

      const commissionRate = totalRevenue > 0 ? (totalCommission / totalRevenue * 100) : 0

      return {
        id: school.id,
        name: school.name,
        commissionRate: Number(commissionRate.toFixed(2)),
        totalOrders,
        totalRevenue,
        commission: totalCommission,
        paid,
        pendingPayments,
        pending: remaining
      }
    })

    return NextResponse.json({ summaries })
  } catch (error) {
    console.error('Ozet hesaplanamadi:', error)
    return NextResponse.json(
      { error: 'Ozet yuklenemedi' },
      { status: 500 }
    )
  }
}
