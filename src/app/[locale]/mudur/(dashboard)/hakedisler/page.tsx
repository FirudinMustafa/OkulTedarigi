import { getTranslations, getLocale } from 'next-intl/server'
import { redirect } from '@/i18n/navigation'
import { getMudurSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { COMMISSION_STATUSES } from '@/lib/constants'
import type { OrderStatus } from '@prisma/client'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table"
import { DollarSign, CheckCircle, Clock } from "lucide-react"
import { formatDateTime } from "@/lib/utils"

interface Order {
  status: string
}

interface ClassItem {
  commissionAmount: { toString(): string }
  orders: Order[]
}

interface Payment {
  id: string
  amount: { toString(): string }
  description: string | null
  status: string
  paymentDate: Date
  paidAt: Date | null
  createdAt: Date
}

async function getSchoolPayments(schoolId: string) {
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    include: {
      schoolPayments: {
        where: { status: 'PAID' },
        orderBy: { paidAt: 'desc' }
      },
      classes: {
        include: {
          orders: {
            where: {
              status: {
                in: COMMISSION_STATUSES as unknown as OrderStatus[]
              }
            }
          }
        }
      }
    }
  })

  if (!school) return null

  let totalCommission = 0
  school.classes.forEach((classItem: ClassItem) => {
    totalCommission += Number(classItem.commissionAmount) * classItem.orders.length
  })

  const paidAmount = school.schoolPayments.reduce(
    (acc: number, p) => acc + Number(p.amount),
    0
  )

  const pendingAmount = Math.max(totalCommission - paidAmount, 0)

  return {
    school,
    payments: school.schoolPayments as unknown as Payment[],
    totalCommission,
    paidAmount,
    pendingAmount
  }
}

export default async function MudurHakedislerPage() {
  const locale = await getLocale()
  const t = await getTranslations('mudur.payments')
  const session = await getMudurSession()

  if (!session || !session.schoolId) {
    return redirect({ href: '/mudur/login', locale })
  }

  const data = await getSchoolPayments(session.schoolId)

  if (!data) {
    return redirect({ href: '/mudur/login', locale })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
        <p className="text-gray-500">{t('subtitle')}</p>
      </div>

      {/* Ozet Kartlari */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              {t('totalCommission')}
            </CardTitle>
            <DollarSign className="h-5 w-5 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {data.totalCommission.toFixed(2)} TL
            </div>
            <p className="text-xs text-gray-500">
              {t('calculatedByClass')}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              {t('paid')}
            </CardTitle>
            <CheckCircle className="h-5 w-5 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {data.paidAmount.toFixed(2)} TL
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              {t('pending')}
            </CardTitle>
            <Clock className="h-5 w-5 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {data.pendingAmount.toFixed(2)} TL
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Odeme Gecmisi */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('paymentHistory')}</CardTitle>
        </CardHeader>
        <CardContent>
          {data.payments.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <DollarSign className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>{t('noPayments')}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('colDate')}</TableHead>
                  <TableHead>{t('colAmount')}</TableHead>
                  <TableHead>{t('colDescription')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.payments.map((payment: Payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="font-medium">
                      {formatDateTime(payment.paidAt ?? payment.paymentDate)}
                    </TableCell>
                    <TableCell className="font-medium">
                      {Number(payment.amount).toFixed(2)} TL
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {payment.description || '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Bilgilendirme */}
      <Card>
        <CardContent className="pt-6">
          <div className="bg-purple-50 p-4 rounded-lg">
            <h4 className="font-medium text-purple-900 mb-2">{t('infoTitle')}</h4>
            <ul className="text-sm text-purple-700 space-y-1">
              <li>{t('info1')}</li>
              <li>{t('info2')}</li>
              <li>{t('info3')}</li>
              <li>{t('info4')}</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
