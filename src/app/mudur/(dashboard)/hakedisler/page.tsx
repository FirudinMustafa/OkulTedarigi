import { redirect } from 'next/navigation'
import { getMudurSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { COMMISSION_STATUSES } from '@/lib/constants'
import type { OrderStatus } from '@prisma/client'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table"
import { DollarSign, CheckCircle, Clock } from "lucide-react"
import { formatDateTime, formatNumber } from "@/lib/utils"

interface Order {
  status: string
  totalAmount: { toString(): string }
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

  const allOrders = school.classes.flatMap((c: ClassItem) => c.orders)
  const totalRevenue = allOrders.reduce(
    (acc: number, o: Order) => acc + Number(o.totalAmount),
    0
  )

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
    totalRevenue,
    totalCommission,
    paidAmount,
    pendingAmount
  }
}

export default async function MudurHakedislerPage() {
  const session = await getMudurSession()

  if (!session || !session.schoolId) {
    redirect('/mudur/login')
  }

  const data = await getSchoolPayments(session.schoolId)

  if (!data) {
    redirect('/mudur/login')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Hakedisler</h1>
        <p className="text-gray-500">Komisyon ve odeme durumu</p>
      </div>

      {/* Ozet Kartlari */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Toplam Ciro
            </CardTitle>
            <DollarSign className="h-5 w-5 text-blue-500" />
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
              Toplam Komisyon
            </CardTitle>
            <DollarSign className="h-5 w-5 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {data.totalCommission.toFixed(2)} TL
            </div>
            <p className="text-xs text-gray-500">
              Sinif bazinda hesaplandi
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Odenen
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
              Bekleyen
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
          <CardTitle className="text-lg">Odeme Gecmisi</CardTitle>
        </CardHeader>
        <CardContent>
          {data.payments.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <DollarSign className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>Henuz odeme kaydi bulunmuyor</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Odeme Tarihi</TableHead>
                  <TableHead>Tutar</TableHead>
                  <TableHead>Aciklama</TableHead>
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
            <h4 className="font-medium text-purple-900 mb-2">Hakedis Bilgilendirmesi</h4>
            <ul className="text-sm text-purple-700 space-y-1">
              <li>Komisyon miktari her sinif icin ayri belirlenir.</li>
              <li>Hakedisler aylik olarak hesaplanir ve odenir.</li>
              <li>Odeme islemleri banka havalesi ile yapilir.</li>
              <li>Sorulariniz icin yonetim ile iletisime gecebilirsiniz.</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
