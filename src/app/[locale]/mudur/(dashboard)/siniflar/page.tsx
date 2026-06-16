import { getTranslations, getLocale } from 'next-intl/server'
import { redirect } from '@/i18n/navigation'
import { getMudurSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Users, Package, ShoppingCart } from "lucide-react"
import { formatNumber } from "@/lib/utils"
import { COMMISSION_STATUSES } from "@/lib/constants"

interface ClassOrder {
  status: string
}

interface ClassWithDetails {
  id: string
  name: string
  commissionAmount: { toString(): string }
  isActive: boolean
  package: { name: string } | null
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
            select: { name: true }
          },
          orders: {
            select: {
              status: true
            }
          }
        }
      }
    }
  })

  return school
}

export default async function MudurSiniflarPage() {
  const locale = await getLocale()
  const t = await getTranslations('mudur.classes')
  const session = await getMudurSession()
  if (!session || !session.schoolId) {
    return redirect({ href: '/mudur/login', locale })
  }

  const school = await getSchoolClasses(session.schoolId)
  if (!school) {
    return redirect({ href: '/mudur/login', locale })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
        <p className="text-gray-500">{t('subtitle', { name: school.name })}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">{t('totalClasses')}</CardTitle>
            <Users className="h-5 w-5 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{school.classes.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">{t('totalOrders')}</CardTitle>
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
            <CardTitle className="text-sm font-medium text-gray-500">{t('deliveryType')}</CardTitle>
            <Package className="h-5 w-5 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">
              {school.deliveryType === 'CARGO' ? t('deliveryCargo') : t('deliverySchool')}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        {school.classes.map((cls: ClassWithDetails) => {
          const commissionOrders = cls.orders.filter((o: ClassOrder) => COMMISSION_STATUSES.includes(o.status))
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
                    {cls.isActive ? t('active') : t('passive')}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500">{t('package')}</p>
                    <p className="font-medium text-sm">{cls.package?.name || t('undefined')}</p>
                  </div>
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <p className="text-xs text-blue-600">{t('totalOrders')}</p>
                    <p className="font-bold text-lg text-blue-700">{cls.orders.length}</p>
                    <p className="text-xs text-blue-500">
                      {t('ordersBreakdown', { completed: completedOrders, pending: pendingOrders })}
                    </p>
                  </div>
                  <div className="p-3 bg-emerald-50 rounded-lg">
                    <p className="text-xs text-emerald-600">{t('commissionAmount')}</p>
                    <p className="font-bold text-lg text-emerald-700">{Number(cls.commissionAmount).toFixed(2)} TL</p>
                    <p className="text-xs text-emerald-500">{t('perOrder')}</p>
                  </div>
                  <div className="p-3 bg-yellow-50 rounded-lg">
                    <p className="text-xs text-yellow-600">{t('totalCommission')}</p>
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
