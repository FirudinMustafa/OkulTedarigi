import { redirect } from 'next/navigation'
import { getMudurSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ShoppingCart, DollarSign, Users, Package,
  CheckCircle
} from "lucide-react"
import { formatNumber } from "@/lib/utils"
import { ORDER_STATUS_LABELS, COMMISSION_STATUSES } from "@/lib/constants"

interface Order {
  id: string
  orderNumber: string
  studentName: string
  status: string
  totalAmount: { toString(): string }
  createdAt: Date
}

interface ClassItem {
  id: string
  commissionAmount: { toString(): string }
  orders: Order[]
}

async function getDashboardStats(schoolId: string) {
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    include: {
      classes: {
        include: {
          orders: true,
          package: true
        }
      },
      schoolPayments: true
    }
  })

  if (!school) return null

  const allOrders = school.classes.flatMap((c: ClassItem) => c.orders)
  const totalOrders = allOrders.length
  const completedOrders = allOrders.filter((o: Order) => o.status === 'COMPLETED').length
  const pendingOrders = allOrders.filter((o: Order) =>
    !['COMPLETED', 'CANCELLED', 'REFUNDED'].includes(o.status)
  ).length

  const totalRevenue = allOrders
    .filter((o: Order) => COMMISSION_STATUSES.includes(o.status))
    .reduce((acc: number, o: Order) => acc + Number(o.totalAmount), 0)

  // Komisyonu sinif bazinda hesapla (sadece odenmis ve sonrasi siparisler)
  let totalCommission = 0
  school.classes.forEach((classItem: ClassItem) => {
    const classOrders = classItem.orders.filter(
      (o: Order) => COMMISSION_STATUSES.includes(o.status)
    ).length
    totalCommission += Number(classItem.commissionAmount) * classOrders
  })

  const paidCommission = school.schoolPayments.reduce(
    (acc: number, p: { amount: { toString(): string } }) => acc + Number(p.amount),
    0
  )

  const recentOrders = allOrders
    .sort((a: Order, b: Order) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5)

  return {
    school,
    totalOrders,
    completedOrders,
    pendingOrders,
    totalRevenue,
    commission: totalCommission,
    paidCommission,
    pendingCommission: totalCommission - paidCommission,
    totalClasses: school.classes.length,
    recentOrders
  }
}

export default async function MudurDashboard() {
  const session = await getMudurSession()

  if (!session || !session.schoolId) {
    redirect('/mudur/login')
  }

  const stats = await getDashboardStats(session.schoolId)

  if (!stats) {
    redirect('/mudur/login')
  }

  const statusLabels = ORDER_STATUS_LABELS

  const statCards = [
    {
      title: "Toplam Siparis",
      value: stats.totalOrders,
      icon: ShoppingCart,
      color: "text-blue-600",
      bgColor: "bg-blue-100"
    },
    {
      title: "Tamamlanan",
      value: stats.completedOrders,
      icon: CheckCircle,
      color: "text-green-600",
      bgColor: "bg-green-100"
    },
    {
      title: "Sinif Sayisi",
      value: stats.totalClasses,
      icon: Users,
      color: "text-indigo-600",
      bgColor: "bg-indigo-100"
    },
    {
      title: "Toplam Ciro",
      value: `${formatNumber(stats.totalRevenue)} TL`,
      icon: DollarSign,
      color: "text-purple-600",
      bgColor: "bg-purple-100"
    },
    {
      title: "Kurum Hakedisi",
      value: `${formatNumber(stats.commission)} TL`,
      icon: DollarSign,
      color: "text-emerald-600",
      bgColor: "bg-emerald-100"
    },
    {
      title: "Verilen Odeme",
      value: `${formatNumber(stats.paidCommission)} TL`,
      icon: CheckCircle,
      color: "text-green-600",
      bgColor: "bg-green-100"
    }
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{stats.school.name}</h1>
        <p className="text-gray-500">Okul siparis ve komisyon durumu</p>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {statCards.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                {stat.title}
              </CardTitle>
              <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Kurum Hakedisi Durumu */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Kurum Hakedisi</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 bg-emerald-50 rounded-lg text-center">
              <p className="text-sm text-emerald-600 mb-1 font-medium">Toplam Hakediş</p>
              <p className="text-2xl font-bold text-emerald-700">
                {stats.commission.toFixed(2)} TL
              </p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg text-center">
              <p className="text-sm text-green-600 mb-1 font-medium">Kuruma Verilen</p>
              <p className="text-2xl font-bold text-green-700">
                {stats.paidCommission.toFixed(2)} TL
              </p>
            </div>
            <div className="p-4 bg-yellow-50 rounded-lg text-center">
              <p className="text-sm text-yellow-600 mb-1 font-medium">Kalan</p>
              <p className="text-2xl font-bold text-yellow-700">
                {stats.pendingCommission.toFixed(2)} TL
              </p>
            </div>
          </div>
          {stats.paidCommission > 0 && (
            <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-100">
              <p className="text-sm text-green-700 text-center">
                Kuruma toplam <span className="font-bold">{stats.paidCommission.toFixed(2)} TL</span> ödeme yapılmıştır.
                {stats.pendingCommission > 0 && (
                  <span> Kalan <span className="font-bold">{stats.pendingCommission.toFixed(2)} TL</span> bekleyen hakediştir.</span>
                )}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Son Siparisler */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Son Siparisler</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {stats.recentOrders.length === 0 ? (
              <p className="text-gray-500 text-center py-4">Henuz siparis yok</p>
            ) : (
              stats.recentOrders.map((order: Order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                      <Package className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="font-medium">{order.orderNumber}</p>
                      <p className="text-sm text-gray-500">
                        {order.studentName}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{Number(order.totalAmount).toFixed(2)} TL</p>
                    <p className="text-sm text-gray-500">
                      {statusLabels[order.status] || order.status}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
