import { redirect } from 'next/navigation'
import { getMudurSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table"
import { ShoppingCart, Download, Users, ChevronLeft, ChevronRight } from "lucide-react"
import { formatDateTime } from "@/lib/utils"
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from "@/lib/constants"
import Link from 'next/link'

const statusLabels = ORDER_STATUS_LABELS
const statusColors = ORDER_STATUS_COLORS

const PAGE_SIZE = 50
const MAX_PAGE_SIZE = 200

async function getSchoolOrders(schoolId: string, page: number, limit: number) {
  // School bilgisi (deliveryType icin)
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { deliveryType: true, isActive: true }
  })

  if (!school) return { orders: [], deliveryType: 'SCHOOL_DELIVERY', total: 0 }

  // Siparisleri okul bazinda filtrele (cross-tenant koruma)
  const where = { class: { schoolId } }

  const [total, rawOrders] = await prisma.$transaction([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      include: { class: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    })
  ])

  const orders = rawOrders.map(o => ({ ...o, className: o.class.name }))
  return { orders, deliveryType: school.deliveryType, total }
}

export default async function MudurSiparislerPage(
  { searchParams }: { searchParams: Promise<{ page?: string; limit?: string }> }
) {
  const session = await getMudurSession()

  if (!session || !session.schoolId) {
    redirect('/mudur/login')
  }

  const sp = await searchParams
  const pageNum = Math.max(1, parseInt(sp.page || '1', 10) || 1)
  const limitNum = Math.min(MAX_PAGE_SIZE, Math.max(10, parseInt(sp.limit || String(PAGE_SIZE), 10) || PAGE_SIZE))

  const { orders, deliveryType, total } = await getSchoolOrders(session.schoolId, pageNum, limitNum)
  const totalPages = Math.max(1, Math.ceil(total / limitNum))
  const safePageNum = Math.min(pageNum, totalPages)
  const hasPrev = safePageNum > 1
  const hasNext = safePageNum < totalPages
  const rangeStart = total === 0 ? 0 : (safePageNum - 1) * limitNum + 1
  const rangeEnd = Math.min(safePageNum * limitNum, total)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Siparisler</h1>
          <p className="text-gray-500">Okulunuza ait tum siparisler</p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="/api/mudur/students/export"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border border-gray-200 rounded-md bg-white hover:bg-gray-50 transition-colors"
          >
            <Users className="h-4 w-4" />
            Ogrenci Listesi
          </a>
          <a
            href="/api/mudur/orders/export"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border border-gray-200 rounded-md bg-white hover:bg-gray-50 transition-colors"
          >
            <Download className="h-4 w-4" />
            Siparis Listesi
          </a>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Siparis Listesi (Toplam {total})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <ShoppingCart className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p className="text-base font-medium text-gray-700">Henuz siparis bulunmuyor</p>
              <p className="text-sm mt-1">Okulunuza ait yeni siparisler burada gosterilecek</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Siparis No</TableHead>
                    <TableHead>Sinif</TableHead>
                    <TableHead>Ogrenci</TableHead>
                    <TableHead>Veli</TableHead>
                    <TableHead>Tutar</TableHead>
                    <TableHead>Teslimat</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead>Tarih</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-mono text-sm">
                        {order.orderNumber}
                      </TableCell>
                      <TableCell>{order.className}</TableCell>
                      <TableCell className="font-medium">
                        {order.studentName}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm">{order.parentName}</p>
                          <p className="text-xs text-gray-500">{order.phone}</p>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {Number(order.totalAmount).toFixed(2)} TL
                      </TableCell>
                      <TableCell>
                        {deliveryType === "CARGO" ? "Kargo" : "Okula"}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColors[order.status] || ""}>
                          {statusLabels[order.status] || order.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {formatDateTime(order.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                <p className="text-sm text-gray-500">
                  {rangeStart}-{rangeEnd} / {total} siparis
                </p>
                <div className="flex items-center gap-2">
                  {hasPrev ? (
                    <Link
                      href={`/mudur/siparisler?page=${safePageNum - 1}&limit=${limitNum}`}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-200 rounded-md bg-white hover:bg-gray-50"
                    >
                      <ChevronLeft className="h-4 w-4" /> Onceki
                    </Link>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-200 rounded-md bg-gray-50 text-gray-400 cursor-not-allowed">
                      <ChevronLeft className="h-4 w-4" /> Onceki
                    </span>
                  )}
                  <span className="text-sm text-gray-600 px-2">
                    Sayfa {safePageNum} / {totalPages}
                  </span>
                  {hasNext ? (
                    <Link
                      href={`/mudur/siparisler?page=${safePageNum + 1}&limit=${limitNum}`}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-200 rounded-md bg-white hover:bg-gray-50"
                    >
                      Sonraki <ChevronRight className="h-4 w-4" />
                    </Link>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-200 rounded-md bg-gray-50 text-gray-400 cursor-not-allowed">
                      Sonraki <ChevronRight className="h-4 w-4" />
                    </span>
                  )}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
