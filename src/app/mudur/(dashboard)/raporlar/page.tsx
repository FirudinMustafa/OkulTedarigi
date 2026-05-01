import { redirect } from 'next/navigation'
import { getMudurSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  BarChart3, TrendingUp, Users, Package, ShoppingCart
} from "lucide-react"
import { formatNumber } from "@/lib/utils"
import { ORDER_STATUS_LABELS } from "@/lib/constants"
import YearFilter from "@/components/mudur/year-filter"
import ReportExportButton from "@/components/mudur/report-export-button"

interface OrderItem {
  status: string
  totalAmount: { toString(): string }
  createdAt: Date
}

interface ClassItem {
  name: string
  package: { name: string } | null
  orders: OrderItem[]
}

async function getSchoolReports(schoolId: string, year?: string) {
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    include: {
      classes: {
        include: {
          orders: true,
          package: true
        }
      }
    }
  })

  if (!school) return null

  let allOrders = school.classes.flatMap((c: ClassItem) => c.orders)
  if (year && year !== 'all') {
    const yearNum = parseInt(year)
    allOrders = allOrders.filter((o: OrderItem) =>
      new Date(o.createdAt).getFullYear() === yearNum
    )
  }

  // Durum dagilimi
  const ordersByStatus: Record<string, number> = {}
  allOrders.forEach((order: OrderItem) => {
    ordersByStatus[order.status] = (ordersByStatus[order.status] || 0) + 1
  })

  // Teslimat tipi - okul bazinda (tum siparisler ayni tipte)
  const ordersByDeliveryType = {
    CARGO: school.deliveryType === 'CARGO' ? allOrders.length : 0,
    SCHOOL_DELIVERY: school.deliveryType === 'SCHOOL_DELIVERY' ? allOrders.length : 0
  }

  // Sinif bazli istatistikler
  const classStat = school.classes.map((cls: ClassItem) => {
    let classOrders = cls.orders
    if (year && year !== 'all') {
      const yearNum = parseInt(year)
      classOrders = classOrders.filter((o: OrderItem) =>
        new Date(o.createdAt).getFullYear() === yearNum
      )
    }
    return {
      name: cls.name,
      packageName: cls.package?.name || 'Paket yok',
      orderCount: classOrders.length,
      revenue: classOrders
        .filter((o: OrderItem) => !['CANCELLED', 'REFUNDED'].includes(o.status))
        .reduce((acc: number, o: OrderItem) => acc + Number(o.totalAmount), 0)
    }
  }).sort((a, b) => b.orderCount - a.orderCount)

  const totalRevenue = allOrders
    .filter((o: OrderItem) => !['CANCELLED', 'REFUNDED'].includes(o.status))
    .reduce((acc: number, o: OrderItem) => acc + Number(o.totalAmount), 0)

  return {
    school,
    totalOrders: allOrders.length,
    completedOrders: allOrders.filter((o: OrderItem) => o.status === 'COMPLETED').length,
    cancelledOrders: allOrders.filter((o: OrderItem) => o.status === 'CANCELLED').length,
    totalRevenue,
    ordersByStatus,
    ordersByDeliveryType,
    classStat,
    totalClasses: school.classes.length
  }
}

const statusLabels = ORDER_STATUS_LABELS

export default async function MudurRaporlarPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const session = await getMudurSession()

  if (!session || !session.schoolId) {
    redirect('/mudur/login')
  }

  const params = await searchParams
  const selectedYear = params.year || 'all'
  const data = await getSchoolReports(session.schoolId, selectedYear)

  if (!data) {
    redirect('/mudur/login')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Raporlar</h1>
          <p className="text-gray-500">{data.school.name} istatistikleri</p>
        </div>
        <div className="flex items-center gap-2">
          <ReportExportButton />
          <YearFilter />
        </div>
      </div>

      {/* Ozet */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Toplam Siparis
            </CardTitle>
            <ShoppingCart className="h-5 w-5 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.totalOrders}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Tamamlanan
            </CardTitle>
            <TrendingUp className="h-5 w-5 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {data.completedOrders}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Toplam Ciro
            </CardTitle>
            <BarChart3 className="h-5 w-5 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatNumber(data.totalRevenue)} TL
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Sinif Sayisi
            </CardTitle>
            <Users className="h-5 w-5 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.totalClasses}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Siparis Durumu Dagilimi */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Siparis Durumu Dagilimi
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(data.ordersByStatus).map(([status, count]) => {
                const percentage = data.totalOrders > 0 ? (count / data.totalOrders) * 100 : 0
                return (
                  <div key={status}>
                    <div className="flex justify-between text-sm mb-1">
                      <span>{statusLabels[status] || status}</span>
                      <span className="font-medium">{count}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className="bg-purple-500 h-2 rounded-full transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Teslimat Tipi */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Teslimat Tipi Dagilimi
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-orange-50 rounded-lg text-center">
                <div className="text-3xl font-bold text-orange-600">
                  {data.ordersByDeliveryType.CARGO}
                </div>
                <p className="text-sm text-orange-700 mt-1">Kargo ile</p>
                <p className="text-xs text-orange-500">
                  %{data.totalOrders > 0 ? ((data.ordersByDeliveryType.CARGO / data.totalOrders) * 100).toFixed(0) : 0}
                </p>
              </div>
              <div className="p-4 bg-blue-50 rounded-lg text-center">
                <div className="text-3xl font-bold text-blue-600">
                  {data.ordersByDeliveryType.SCHOOL_DELIVERY}
                </div>
                <p className="text-sm text-blue-700 mt-1">Okula Teslim</p>
                <p className="text-xs text-blue-500">
                  %{data.totalOrders > 0 ? ((data.ordersByDeliveryType.SCHOOL_DELIVERY / data.totalOrders) * 100).toFixed(0) : 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sinif Bazli Istatistikler */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Sinif Bazli Istatistikler
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.classStat.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                Henuz sinif verisi yok
              </div>
            ) : (
              <div className="space-y-4">
                {data.classStat.map((cls, index) => (
                  <div key={cls.name} className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center font-bold text-purple-600">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{cls.name}</p>
                      <p className="text-sm text-gray-500">{cls.packageName}</p>
                    </div>
                    <div className="text-center">
                      <p className="font-medium">{cls.orderCount}</p>
                      <p className="text-xs text-gray-500">siparis</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{formatNumber(cls.revenue)} TL</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
