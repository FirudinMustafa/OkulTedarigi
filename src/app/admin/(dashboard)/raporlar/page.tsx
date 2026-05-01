"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import {
  BarChart3, TrendingUp, TrendingDown, DollarSign, ShoppingCart,
  Users, School, Package, Download
} from "lucide-react"
import { formatNumber } from "@/lib/utils"
import { ORDER_STATUS_LABELS } from "@/lib/constants"

interface ReportData {
  totalRevenue: number
  totalOrders: number
  averageOrderValue: number
  completedOrders: number
  cancelledOrders: number
  schoolCount: number
  classCount: number
  ordersByStatus: Record<string, number>
  ordersByDeliveryType: { CARGO: number; SCHOOL: number }
  topSchools: Array<{ name: string; orders: number; revenue: number }>
  monthlyRevenue: Array<{ month: string; revenue: number; orders: number }>
}

const statusLabels = ORDER_STATUS_LABELS

export default function RaporlarPage() {
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState("all")

  useEffect(() => {
    fetchReport()
  }, [period])

  const fetchReport = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/reports?period=${period}`, { credentials: 'include' })
      const result = await res.json()
      if (res.ok) {
        setData(result)
      } else {
        console.error("Rapor yuklenemedi:", result.error)
      }
    } catch (error) {
      console.error("Rapor yuklenemedi:", error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Rapor yukleniyor...</div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Rapor verisi bulunamadi</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Raporlar</h1>
          <p className="text-gray-500">Sistem istatistikleri ve analizler</p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href={`/api/admin/reports/export?period=${period}`}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border border-gray-200 rounded-md bg-white hover:bg-gray-50 transition-colors"
          >
            <Download className="h-4 w-4" />
            Rapor Indir
          </a>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Donem secin" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tum Zamanlar</SelectItem>
              <SelectItem value="month">Bu Ay</SelectItem>
              <SelectItem value="week">Bu Hafta</SelectItem>
              <SelectItem value="today">Bugun</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Ozet Kartlari */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Toplam Ciro
            </CardTitle>
            <DollarSign className="h-5 w-5 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatNumber(data.totalRevenue)} TL
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Ort. siparis: {data.averageOrderValue.toFixed(2)} TL
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Toplam Siparis
            </CardTitle>
            <ShoppingCart className="h-5 w-5 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.totalOrders}</div>
            <div className="flex gap-2 mt-1">
              <Badge variant="outline" className="text-xs">
                <TrendingUp className="h-3 w-3 mr-1 text-green-500" />
                {data.completedOrders} tamamlandi
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Aktif Okul
            </CardTitle>
            <School className="h-5 w-5 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.schoolCount}</div>
            <p className="text-xs text-gray-500 mt-1">
              {data.classCount} sinif
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Iptal/Iade
            </CardTitle>
            <TrendingDown className="h-5 w-5 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {data.cancelledOrders}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              %{data.totalOrders > 0 ? ((data.cancelledOrders / data.totalOrders) * 100).toFixed(1) : 0} oran
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Siparis Dagilimi */}
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
                        className="bg-blue-500 h-2 rounded-full transition-all"
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
                  {data.ordersByDeliveryType.SCHOOL}
                </div>
                <p className="text-sm text-blue-700 mt-1">Okula Teslim</p>
                <p className="text-xs text-blue-500">
                  %{data.totalOrders > 0 ? ((data.ordersByDeliveryType.SCHOOL / data.totalOrders) * 100).toFixed(0) : 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* En Cok Siparis Alan Okullar */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              En Cok Siparis Alan Okullar
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.topSchools.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                Henuz veri yok
              </div>
            ) : (
              <div className="space-y-4">
                {data.topSchools.map((school, index) => (
                  <div key={school.name} className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center font-bold text-blue-600">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{school.name}</p>
                      <p className="text-sm text-gray-500">{school.orders} siparis</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{formatNumber(school.revenue)} TL</p>
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
