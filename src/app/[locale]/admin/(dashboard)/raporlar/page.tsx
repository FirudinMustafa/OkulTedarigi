"use client"

import { useState, useEffect, useCallback } from "react"
import { useTranslations } from "next-intl"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  BarChart3, TrendingUp, TrendingDown, DollarSign, ShoppingCart,
  Users, School, Package, Download, CreditCard, Wallet, PiggyBank, Check
} from "lucide-react"
import { formatNumber } from "@/lib/utils"

interface DailyRow { date: string; orders: number; revenue: number; paymentFee: number; net: number }

interface ReportData {
  totalRevenue: number
  totalOrders: number
  revenueOrderCount: number
  averageOrderValue: number
  completedOrders: number
  cancelledOrders: number
  schoolCount: number
  classCount: number
  paymentCommissionRate: number
  paymentCommissionAmount: number
  netAfterPayment: number
  totalSchoolCommission: number
  netProfit: number
  ordersByStatus: Record<string, number>
  ordersByDeliveryType: { CARGO: number; SCHOOL: number }
  topSchools: Array<{ name: string; orders: number; revenue: number }>
  dailyBreakdown: DailyRow[]
}

const money = (n: number) => `${formatNumber(n)} TL`

export default function RaporlarPage() {
  const t = useTranslations('admin.reports')
  const ts = useTranslations('status')
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState("all")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  // Ozel aralik uygulandiysa burada tutulur (period yerine kullanilir)
  const [appliedRange, setAppliedRange] = useState<{ from: string; to: string } | null>(null)

  // Oran duzenleme
  const [rateInput, setRateInput] = useState("")
  const [savingRate, setSavingRate] = useState(false)
  const [rateSaved, setRateSaved] = useState(false)

  const buildQuery = useCallback(() => {
    if (appliedRange) {
      return `from=${appliedRange.from}&to=${appliedRange.to}`
    }
    return `period=${period}`
  }, [appliedRange, period])

  const fetchReport = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/reports?${buildQuery()}`, { credentials: 'include', cache: 'no-store' })
      const result = await res.json()
      if (res.ok) {
        setData(result)
        setRateInput(String(result.paymentCommissionRate))
      } else {
        console.error("Rapor yuklenemedi:", result.error)
      }
    } catch (error) {
      console.error("Rapor yuklenemedi:", error)
    } finally {
      setLoading(false)
    }
  }, [buildQuery])

  useEffect(() => { fetchReport() }, [fetchReport])

  const selectPreset = (p: string) => {
    setAppliedRange(null)
    setFrom("")
    setTo("")
    setPeriod(p)
  }

  const applyCustomRange = () => {
    if (!from || !to) return
    setAppliedRange({ from, to })
  }

  const saveRate = async () => {
    const val = Number(rateInput)
    if (!Number.isFinite(val) || val < 0 || val > 100) return
    setSavingRate(true)
    setRateSaved(false)
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ paymentCommissionRate: val })
      })
      if (res.ok) {
        setRateSaved(true)
        await fetchReport()
        setTimeout(() => setRateSaved(false), 2000)
      }
    } catch (e) {
      console.error('Oran kaydedilemedi:', e)
    } finally {
      setSavingRate(false)
    }
  }

  const presets: Array<{ key: string; label: string }> = [
    { key: 'today', label: t('periodToday') },
    { key: 'yesterday', label: t('periodYesterday') },
    { key: 'week', label: t('periodWeek') },
    { key: 'month', label: t('periodMonth') },
    { key: 'all', label: t('periodAll') },
  ]

  const exportQuery = appliedRange ? `from=${appliedRange.from}&to=${appliedRange.to}` : `period=${period}`

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
          <p className="text-gray-500">{t('subtitle')}</p>
        </div>
        <a
          href={`/api/admin/reports/export?${exportQuery}`}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border border-gray-200 rounded-md bg-white hover:bg-gray-50 transition-colors self-start"
        >
          <Download className="h-4 w-4" />
          {t('downloadReport')}
        </a>
      </div>

      {/* Tarih filtresi: kisayollar + ozel aralik */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {presets.map(p => (
                <Button
                  key={p.key}
                  size="sm"
                  variant={!appliedRange && period === p.key ? "default" : "outline"}
                  onClick={() => selectPreset(p.key)}
                >
                  {p.label}
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <div>
                <label className="block text-xs text-gray-500 mb-1">{t('dateFrom')}</label>
                <Input type="date" value={from} max={to || undefined} onChange={e => setFrom(e.target.value)} className="w-[150px]" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">{t('dateTo')}</label>
                <Input type="date" value={to} min={from || undefined} onChange={e => setTo(e.target.value)} className="w-[150px]" />
              </div>
              <Button size="sm" onClick={applyCustomRange} disabled={!from || !to}>{t('apply')}</Button>
            </div>
          </div>
          {appliedRange && (
            <p className="text-xs text-gray-500 mt-2">{appliedRange.from} — {appliedRange.to}</p>
          )}
        </CardContent>
      </Card>

      {loading || !data ? (
        <div className="flex items-center justify-center h-64 text-gray-500">
          {loading ? t('loading') : t('noData')}
        </div>
      ) : (
      <>
      {/* Ozet Kartlari - sayim */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">{t('totalRevenue')}</CardTitle>
            <DollarSign className="h-5 w-5 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{money(data.totalRevenue)}</div>
            <p className="text-xs text-gray-500 mt-1">{t('avgOrder', { value: data.averageOrderValue.toFixed(2) })}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">{t('totalOrders')}</CardTitle>
            <ShoppingCart className="h-5 w-5 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.totalOrders}</div>
            <div className="flex gap-2 mt-1">
              <Badge variant="outline" className="text-xs">
                <TrendingUp className="h-3 w-3 mr-1 text-green-500" />
                {t('completedCount', { count: data.completedOrders })}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">{t('activeSchools')}</CardTitle>
            <School className="h-5 w-5 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.schoolCount}</div>
            <p className="text-xs text-gray-500 mt-1">{t('classCount', { count: data.classCount })}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">{t('cancelRefund')}</CardTitle>
            <TrendingDown className="h-5 w-5 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{data.cancelledOrders}</div>
            <p className="text-xs text-gray-500 mt-1">
              {t('rate', { value: data.totalOrders > 0 ? ((data.cancelledOrders / data.totalOrders) * 100).toFixed(1) : 0 })}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Kazanc Kartlari */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Odeme komisyonu + duzenlenebilir oran */}
        <Card className="border-red-100">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">{t('paymentCommission')}</CardTitle>
            <CreditCard className="h-5 w-5 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">- {money(data.paymentCommissionAmount)}</div>
            <div className="flex items-center gap-1 mt-2">
              <span className="text-xs text-gray-500">{t('rateEditLabel')}</span>
              <Input
                type="number" step="0.01" min="0" max="100"
                value={rateInput}
                onChange={e => setRateInput(e.target.value)}
                className="h-7 w-20 text-xs"
              />
              <span className="text-xs text-gray-500">%</span>
              <Button size="sm" variant="outline" className="h-7 px-2" onClick={saveRate} disabled={savingRate}>
                {rateSaved ? <Check className="h-3 w-3 text-green-600" /> : t('save')}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Net (odeme sonrasi) */}
        <Card className="border-blue-100">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">{t('netAfterPayment')}</CardTitle>
            <Wallet className="h-5 w-5 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{money(data.netAfterPayment)}</div>
            <p className="text-xs text-gray-500 mt-1">{t('netAfterPaymentDesc')}</p>
          </CardContent>
        </Card>

        {/* Okul hakedisi */}
        <Card className="border-amber-100">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">{t('schoolCommissionTotal')}</CardTitle>
            <Users className="h-5 w-5 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">- {money(data.totalSchoolCommission)}</div>
            <p className="text-xs text-gray-500 mt-1">{t('schoolCommissionDesc')}</p>
          </CardContent>
        </Card>

        {/* Net kar */}
        <Card className="border-emerald-200 bg-emerald-50/40">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-emerald-700">{t('netProfit')}</CardTitle>
            <PiggyBank className="h-5 w-5 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-700">{money(data.netProfit)}</div>
            <p className="text-xs text-emerald-600/80 mt-1">{t('netProfitDesc')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Gunluk dokum */}
      {data.dailyBreakdown.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              {t('dailyBreakdown')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="py-2 pr-4 font-medium">{t('colDate')}</th>
                    <th className="py-2 pr-4 font-medium text-right">{t('colOrders')}</th>
                    <th className="py-2 pr-4 font-medium text-right">{t('colRevenue')}</th>
                    <th className="py-2 pr-4 font-medium text-right">{t('colPaymentFee')}</th>
                    <th className="py-2 font-medium text-right">{t('colNet')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.dailyBreakdown.map(r => (
                    <tr key={r.date} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="py-2 pr-4">{r.date}</td>
                      <td className="py-2 pr-4 text-right">{r.orders}</td>
                      <td className="py-2 pr-4 text-right">{money(r.revenue)}</td>
                      <td className="py-2 pr-4 text-right text-red-600">- {money(r.paymentFee)}</td>
                      <td className="py-2 text-right font-medium">{money(r.net)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Siparis Dagilimi */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              {t('statusDistribution')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(data.ordersByStatus).map(([status, count]) => {
                const percentage = data.totalOrders > 0 ? (count / data.totalOrders) * 100 : 0
                return (
                  <div key={status}>
                    <div className="flex justify-between text-sm mb-1">
                      <span>{ts.has(status) ? ts(status) : status}</span>
                      <span className="font-medium">{count}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${percentage}%` }} />
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
              {t('deliveryTypeDistribution')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-orange-50 rounded-lg text-center">
                <div className="text-3xl font-bold text-orange-600">{data.ordersByDeliveryType.CARGO}</div>
                <p className="text-sm text-orange-700 mt-1">{t('byCargo')}</p>
                <p className="text-xs text-orange-500">
                  %{data.totalOrders > 0 ? ((data.ordersByDeliveryType.CARGO / data.totalOrders) * 100).toFixed(0) : 0}
                </p>
              </div>
              <div className="p-4 bg-blue-50 rounded-lg text-center">
                <div className="text-3xl font-bold text-blue-600">{data.ordersByDeliveryType.SCHOOL}</div>
                <p className="text-sm text-blue-700 mt-1">{t('schoolDelivery')}</p>
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
              {t('topSchools')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.topSchools.length === 0 ? (
              <div className="text-center py-8 text-gray-500">{t('noDataYet')}</div>
            ) : (
              <div className="space-y-4">
                {data.topSchools.map((school, index) => (
                  <div key={school.name} className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center font-bold text-blue-600">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{school.name}</p>
                      <p className="text-sm text-gray-500">{t('orderCount', { count: school.orders })}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{money(school.revenue)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      </>
      )}
    </div>
  )
}
