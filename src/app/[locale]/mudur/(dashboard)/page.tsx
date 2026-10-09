import { getTranslations, getLocale } from 'next-intl/server'
import { redirect } from '@/i18n/navigation'
import { getMudurSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ShoppingCart, DollarSign, Users, Package,
  CheckCircle
} from "lucide-react"
import { formatPrice } from "@/lib/utils"
import { UNPAID_STATUSES } from "@/lib/constants"
import { getSchoolPayoutSummary } from "@/lib/commission"
import { OrderStatus } from "@prisma/client"

interface Order {
  id: string
  orderNumber: string
  studentName: string
  status: string
  createdAt: Date
}

async function getDashboardStats(schoolId: string) {
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { id: true, name: true, _count: { select: { classes: true } } }
  })
  if (!school) return null

  // Odenmemis (terk edilmis) siparisler sayilmaz — admin ile ayni kural
  const paidScope = { class: { schoolId }, status: { notIn: UNPAID_STATUSES as OrderStatus[] } }
  const [totalOrders, completedOrders, recentOrders, payout] = await Promise.all([
    prisma.order.count({ where: paidScope }),
    prisma.order.count({ where: { class: { schoolId }, status: 'COMPLETED' } }),
    prisma.order.findMany({
      where: paidScope,
      select: { id: true, orderNumber: true, studentName: true, status: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 5
    }),
    // Hakedis: admin hakedisler ve mudur hakedisler sayfasiyla AYNI hesap
    getSchoolPayoutSummary(schoolId)
  ])

  return {
    school,
    totalOrders,
    completedOrders,
    commission: payout?.commission ?? 0,
    // Yalnizca PAID kayitlar "verilen" sayilir
    paidCommission: payout?.paid ?? 0,
    // Okulun henuz eline gecmeyen tutar (eksiye dusmez; fazla odeme ayri gosterilir)
    pendingCommission: payout?.notYetPaid ?? 0,
    overpaid: payout?.overpaidPaid ?? 0,
    totalClasses: school._count.classes,
    recentOrders: recentOrders as Order[]
  }
}

export default async function MudurDashboard() {
  const locale = await getLocale()
  const t = await getTranslations('mudur.dashboard')
  const ts = await getTranslations('status')
  const session = await getMudurSession()

  if (!session || !session.schoolId) {
    return redirect({ href: '/mudur/login', locale })
  }

  const stats = await getDashboardStats(session.schoolId)

  if (!stats) {
    return redirect({ href: '/mudur/login', locale })
  }

  const statCards = [
    {
      title: t('totalOrders'),
      value: stats.totalOrders,
      icon: ShoppingCart,
      color: "text-blue-600",
      bgColor: "bg-blue-100"
    },
    {
      title: t('completed'),
      value: stats.completedOrders,
      icon: CheckCircle,
      color: "text-green-600",
      bgColor: "bg-green-100"
    },
    {
      title: t('classCount'),
      value: stats.totalClasses,
      icon: Users,
      color: "text-indigo-600",
      bgColor: "bg-indigo-100"
    },
    {
      title: t('totalCommission'),
      value: `${formatPrice(stats.commission, locale)} TL`,
      icon: DollarSign,
      color: "text-emerald-600",
      bgColor: "bg-emerald-100"
    },
    {
      title: t('paidAmount'),
      value: `${formatPrice(stats.paidCommission, locale)} TL`,
      icon: CheckCircle,
      color: "text-green-600",
      bgColor: "bg-green-100"
    }
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{stats.school.name}</h1>
        <p className="text-gray-500">{t('subtitle')}</p>
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
          <CardTitle className="text-lg">{t('commissionStatusTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 bg-emerald-50 rounded-lg text-center">
              <p className="text-sm text-emerald-600 mb-1 font-medium">{t('totalCommission')}</p>
              <p className="text-2xl font-bold text-emerald-700">
                {formatPrice(stats.commission, locale)} TL
              </p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg text-center">
              <p className="text-sm text-green-600 mb-1 font-medium">{t('givenToInstitution')}</p>
              <p className="text-2xl font-bold text-green-700">
                {formatPrice(stats.paidCommission, locale)} TL
              </p>
            </div>
            <div className="p-4 bg-yellow-50 rounded-lg text-center">
              <p className="text-sm text-yellow-600 mb-1 font-medium">{t('remaining')}</p>
              <p className="text-2xl font-bold text-yellow-700">
                {formatPrice(stats.pendingCommission, locale)} TL
              </p>
            </div>
          </div>
          {stats.overpaid > 0 && (
            <div className="mt-4 p-3 bg-red-50 rounded-lg border border-red-100 text-sm text-red-700 text-center">
              {t('overpaidNote', { amount: `${formatPrice(stats.overpaid, locale)} TL` })}
            </div>
          )}
          {stats.paidCommission > 0 && (
            <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-100">
              <p className="text-sm text-green-700 text-center">
                {t.rich('paidSummary', {
                  amount: `${formatPrice(stats.paidCommission, locale)} TL`,
                  bold: (chunks) => <span className="font-bold">{chunks}</span>
                })}
                {stats.pendingCommission > 0 && (
                  <span>{' '}{t.rich('pendingSummary', {
                    amount: `${formatPrice(stats.pendingCommission, locale)} TL`,
                    bold: (chunks) => <span className="font-bold">{chunks}</span>
                  })}</span>
                )}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Son Siparisler */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('recentOrdersTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {stats.recentOrders.length === 0 ? (
              <p className="text-gray-500 text-center py-4">{t('noOrders')}</p>
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
                    <p className="text-sm text-gray-500">
                      {ts(order.status)}
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
