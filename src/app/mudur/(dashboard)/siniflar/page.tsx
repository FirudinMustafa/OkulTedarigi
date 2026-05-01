import { redirect } from 'next/navigation'
import { getMudurSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Users, Package, DollarSign, ShoppingCart } from "lucide-react"
import { formatNumber } from "@/lib/utils"
import { COMMISSION_STATUSES } from "@/lib/constants"

interface ClassOrder {
  status: string
  totalAmount: { toString(): string }
}

interface ClassWithDetails {
  id: string
  name: string
  commissionAmount: { toString(): string }
  isActive: boolean
  package: { name: string; price: { toString(): string } } | null
  orders: ClassOrder[]
}

async function getSchoolClasses(schoolId: string) {
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: {
      name: true,
      deliveryType: true,
      classes: {
        orderBy: { name: 'asc' },
        include: {
          package: {
            select: { name: true, price: true }
          },
          orders: {
            select: {
              status: true,
              totalAmount: true
            }
          }
        }
      }
    }
  })

  return school
}

export default async function MudurSiniflarPage() {
  const session = await getMudurSession()
  if (!session || !session.schoolId) {
    redirect('/mudur/login')
  }

  const school = await getSchoolClasses(session.schoolId)
  if (!school) {
    redirect('/mudur/login')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Siniflar</h1>
        <p className="text-gray-500">{school.name} - Sinif ve paket bilgileri</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Toplam Sinif</CardTitle>
            <Users className="h-5 w-5 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{school.classes.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Toplam Siparis</CardTitle>
            <ShoppingCart className="h-5 w-5 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {school.classes.reduce((acc: number, cls: ClassWithDetails) => acc + cls.orders.length, 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Teslimat Tipi</CardTitle>
            <Package className="h-5 w-5 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">
              {school.deliveryType === 'CARGO' ? 'Kargo ile' : 'Okula Teslim'}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        {school.classes.map((cls: ClassWithDetails) => {
          const commissionOrders = cls.orders.filter((o: ClassOrder) => COMMISSION_STATUSES.includes(o.status))
          const totalRevenue = commissionOrders.reduce((acc: number, o: ClassOrder) => acc + Number(o.totalAmount), 0)
          const completedOrders = cls.orders.filter((o: ClassOrder) => o.status === 'COMPLETED').length
          const pendingOrders = cls.orders.filter((o: ClassOrder) =>
            !['COMPLETED', 'CANCELLED', 'REFUNDED'].includes(o.status)
          ).length
          const commission = Number(cls.commissionAmount) * commissionOrders.length

          return (
            <Card key={cls.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Users className="h-5 w-5 text-purple-500" />
                    {cls.name}
                  </CardTitle>
                  <Badge variant={cls.isActive ? "default" : "secondary"}>
                    {cls.isActive ? "Aktif" : "Pasif"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500">Paket</p>
                    <p className="font-medium text-sm">{cls.package?.name || 'Tanimlanmamis'}</p>
                    {cls.package && (
                      <p className="text-xs text-gray-400">{formatNumber(Number(cls.package.price))} TL</p>
                    )}
                  </div>
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <p className="text-xs text-blue-600">Toplam Siparis</p>
                    <p className="font-bold text-lg text-blue-700">{cls.orders.length}</p>
                    <p className="text-xs text-blue-500">
                      {completedOrders} tamamlandi, {pendingOrders} devam ediyor
                    </p>
                  </div>
                  <div className="p-3 bg-purple-50 rounded-lg">
                    <p className="text-xs text-purple-600">Ciro</p>
                    <p className="font-bold text-lg text-purple-700">{formatNumber(totalRevenue)} TL</p>
                  </div>
                  <div className="p-3 bg-emerald-50 rounded-lg">
                    <p className="text-xs text-emerald-600">Hakedis Miktari</p>
                    <p className="font-bold text-lg text-emerald-700">{Number(cls.commissionAmount).toFixed(2)} TL</p>
                    <p className="text-xs text-emerald-500">siparis basina</p>
                  </div>
                  <div className="p-3 bg-yellow-50 rounded-lg">
                    <p className="text-xs text-yellow-600">Toplam Hakedis</p>
                    <p className="font-bold text-lg text-yellow-700">{formatNumber(commission)} TL</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
