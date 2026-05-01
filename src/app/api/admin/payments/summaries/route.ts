import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/auth'

export async function GET() {
  try {
    const session = await getAdminSession()
    if (!session) {
      return NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 401 })
    }

    // Tum aktif okullari getir
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
        schoolPayments: {
          where: {
            status: 'PAID'
          }
        }
      }
    })

    const summaries = schools.map(school => {
      // Her sinifin hakedis miktarini ve siparislerini hesapla
      let totalCommission = 0
      let totalOrders = 0
      let totalRevenue = 0

      school.classes.forEach(classItem => {
        const classOrders = classItem.orders
        totalOrders += classOrders.length

        // Sinif hakedis miktari x siparis sayisi
        totalCommission += Number(classItem.commissionAmount) * classOrders.length

        // Toplam ciro
        totalRevenue += classOrders.reduce((acc: number, order) => acc + Number(order.totalAmount), 0)
      })

      // Odenen toplam (sadece PAID olanlar)
      const paid = school.schoolPayments.reduce((acc: number, p) => acc + Number(p.amount), 0)

      // Bekleyen hakedis
      const pending = totalCommission - paid

      // Komisyon orani hesapla (toplam ciro / toplam komisyon * 100)
      const commissionRate = totalRevenue > 0 ? (totalCommission / totalRevenue * 100) : 0

      return {
        id: school.id,
        name: school.name,
        commissionRate: Number(commissionRate.toFixed(2)),
        totalOrders,
        totalRevenue,
        commission: totalCommission,
        paid,
        pending: pending > 0 ? pending : 0
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
