"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Search, DollarSign, CheckCircle, Clock, Building2, Download } from "lucide-react"
import { formatDate } from "@/lib/utils"

interface SchoolPayment {
  id: string
  school: { id: string; name: string }
  amount: number
  period: string
  status: string
  paidAt: string | null
  createdAt: string
}

interface SchoolSummary {
  id: string
  name: string
  commissionRate: number
  totalOrders: number
  totalRevenue: number
  commission: number
  paid: number
  pendingPayments: number
  pending: number
}

export default function HakedislerPage() {
  const [payments, setPayments] = useState<SchoolPayment[]>([])
  const [schoolSummaries, setSchoolSummaries] = useState<SchoolSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterStatus, setFilterStatus] = useState("")
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false)
  const [selectedSchool, setSelectedSchool] = useState<SchoolSummary | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [paymentsRes, summariesRes] = await Promise.all([
        fetch("/api/admin/payments", { credentials: 'include' }),
        fetch("/api/admin/payments/summaries", { credentials: 'include' })
      ])

      const [paymentsData, summariesData] = await Promise.all([
        paymentsRes.json(),
        summariesRes.json()
      ])

      setPayments(paymentsData.payments || [])
      setSchoolSummaries(summariesData.summaries || [])
    } catch (error) {
      console.error("Veri yuklenemedi:", error)
    } finally {
      setLoading(false)
    }
  }

  const [payingId, setPayingId] = useState<string | null>(null)
  const [listError, setListError] = useState<string | null>(null)

  const safeJson = async (res: Response) => {
    try { return await res.json() } catch { return null }
  }

  const markAsPaid = async (paymentId: string) => {
    setListError(null)
    setPayingId(paymentId)
    try {
      const res = await fetch(`/api/admin/payments/${paymentId}/pay`, {
        method: "POST",
        credentials: 'include'
      })
      if (!res.ok) {
        const data = await safeJson(res)
        setListError(data?.error || `Ödeme tamamlanamadı (HTTP ${res.status})`)
        return
      }
      fetchData()
    } catch {
      setListError("Sunucuya ulaşılamadı. Lütfen tekrar deneyin.")
    } finally {
      setPayingId(null)
    }
  }

  const [paymentError, setPaymentError] = useState("")
  const [paymentAmount, setPaymentAmount] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const createPayment = async () => {
    if (!selectedSchool || submitting) return
    setPaymentError("")

    const amount = parseFloat(paymentAmount)
    if (isNaN(amount) || amount <= 0) {
      setPaymentError("Geçerli bir tutar girin")
      return
    }
    if (amount > selectedSchool.pending) {
      setPaymentError(`Tutar kalan hakedişi (${selectedSchool.pending.toFixed(2)} TL) aşamaz`)
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch("/api/admin/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({
          schoolId: selectedSchool.id,
          amount
        })
      })

      if (!res.ok) {
        const data = await safeJson(res)
        setPaymentError(data?.error || `Hakediş oluşturulamadı (HTTP ${res.status})`)
        return
      }

      fetchData()
      setPaymentDialogOpen(false)
    } catch {
      setPaymentError("Sunucuya ulaşılamadı. Lütfen tekrar deneyin.")
    } finally {
      setSubmitting(false)
    }
  }

  const filteredPayments = payments.filter(p => {
    const matchesSearch = p.school.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = !filterStatus || p.status === filterStatus
    return matchesSearch && matchesStatus
  })

  const totalPending = schoolSummaries.reduce((acc, s) => acc + s.pending, 0)
  const totalPaid = payments
    .filter(p => p.status === "PAID")
    .reduce((acc, p) => acc + Number(p.amount), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Hakedisler</h1>
          <p className="text-gray-500">Okul komisyon ve odeme yonetimi</p>
        </div>
        <a
          href="/api/admin/payments/export"
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border border-gray-200 rounded-md bg-white hover:bg-gray-50 transition-colors"
        >
          <Download className="h-4 w-4" />
          Excel Indir
        </a>
      </div>

      {/* Ozet Kartlari */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Bekleyen Hakedis
            </CardTitle>
            <Clock className="h-5 w-5 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {totalPending.toFixed(2)} TL
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Odenen Toplam
            </CardTitle>
            <CheckCircle className="h-5 w-5 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {totalPaid.toFixed(2)} TL
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Aktif Okul
            </CardTitle>
            <Building2 className="h-5 w-5 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {schoolSummaries.filter(s => s.totalOrders > 0).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Okul Ozeti */}
      <Card>
        <CardHeader>
          <CardTitle>Okul Bazli Hakedis Durumu</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-gray-500">Yukleniyor...</div>
          ) : schoolSummaries.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Building2 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>Henuz hakedis verisi yok</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Okul</TableHead>
                  <TableHead>Siparis Sayisi</TableHead>
                  <TableHead>Toplam Ciro</TableHead>
                  <TableHead>Toplam Hakedis</TableHead>
                  <TableHead className="text-green-700">Verilen</TableHead>
                  <TableHead className="text-orange-700">İşlemde</TableHead>
                  <TableHead className="text-yellow-700">Kalan</TableHead>
                  <TableHead className="text-right">Islem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schoolSummaries.map((school) => (
                  <TableRow key={school.id}>
                    <TableCell className="font-medium">{school.name}</TableCell>
                    <TableCell>{school.totalOrders}</TableCell>
                    <TableCell>{school.totalRevenue.toFixed(2)} TL</TableCell>
                    <TableCell>{school.commission.toFixed(2)} TL</TableCell>
                    <TableCell className="font-medium text-green-600">
                      {school.paid > 0 ? `${school.paid.toFixed(2)} TL` : <span className="text-gray-400">—</span>}
                    </TableCell>
                    <TableCell className="font-medium text-orange-600">
                      {school.pendingPayments > 0 ? `${school.pendingPayments.toFixed(2)} TL` : <span className="text-gray-400">—</span>}
                    </TableCell>
                    <TableCell className="font-medium text-yellow-600">
                      {school.pending > 0 ? `${school.pending.toFixed(2)} TL` : <span className="text-green-500">✓ Tamam</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      {school.pending > 0 && (
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedSchool(school)
                            setPaymentAmount(school.pending.toFixed(2))
                            setPaymentError("")
                            setPaymentDialogOpen(true)
                          }}
                        >
                          <DollarSign className="h-4 w-4 mr-1" />
                          Odeme Yap
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Odeme Gecmisi */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Odeme Gecmisi</CardTitle>
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Okul ara..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-[200px]"
                />
              </div>
              <Select value={filterStatus || "__all__"} onValueChange={(val) => setFilterStatus(val === "__all__" ? "" : val)}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Tum durumlar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Tumu</SelectItem>
                  <SelectItem value="PENDING">Bekliyor</SelectItem>
                  <SelectItem value="PAID">Odendi</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {listError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {listError}
            </div>
          )}
          {filteredPayments.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Odeme kaydi bulunamadi
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Okul</TableHead>
                  <TableHead>Donem</TableHead>
                  <TableHead>Tutar</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead>Olusturma Tarihi</TableHead>
                  <TableHead>Odeme Tarihi</TableHead>
                  <TableHead className="text-right">Islem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPayments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="font-medium">{payment.school.name}</TableCell>
                    <TableCell>{payment.period}</TableCell>
                    <TableCell>{Number(payment.amount).toFixed(2)} TL</TableCell>
                    <TableCell>
                      <Badge variant={payment.status === "PAID" ? "default" : "secondary"}>
                        {payment.status === "PAID" ? "Odendi" : "Bekliyor"}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(payment.createdAt)}</TableCell>
                    <TableCell>{payment.paidAt ? formatDate(payment.paidAt) : "-"}</TableCell>
                    <TableCell className="text-right">
                      {payment.status === "PENDING" && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={payingId === payment.id}
                          onClick={() => markAsPaid(payment.id)}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          {payingId === payment.id ? "İşleniyor..." : "Odendi Isaretle"}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Hakedis Olusturma Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hakedis Olustur</DialogTitle>
          </DialogHeader>
          {selectedSchool && (
            <div className="space-y-4 py-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium">{selectedSchool.name}</h4>
                <p className="text-sm text-gray-500 mt-1">
                  Komisyon Orani: %{selectedSchool.commissionRate}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Toplam Ciro:</span>
                  <p className="font-medium">{selectedSchool.totalRevenue.toFixed(2)} TL</p>
                </div>
                <div>
                  <span className="text-gray-500">Toplam Komisyon:</span>
                  <p className="font-medium">{selectedSchool.commission.toFixed(2)} TL</p>
                </div>
                <div>
                  <span className="text-gray-500">Verilen (PAID):</span>
                  <p className="font-medium text-green-600">{selectedSchool.paid.toFixed(2)} TL</p>
                </div>
                <div>
                  <span className="text-gray-500">İşlemde (PENDING):</span>
                  <p className="font-medium text-orange-600">{selectedSchool.pendingPayments.toFixed(2)} TL</p>
                </div>
                <div className="col-span-2 border-t pt-2">
                  <span className="text-gray-500">Kalan (yeni kayıt için):</span>
                  <p className="font-bold text-yellow-700 text-lg">{selectedSchool.pending.toFixed(2)} TL</p>
                </div>
              </div>
              <div className="border-t pt-4 space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ödenecek Tutar (TL)
                  </label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      max={selectedSchool.pending}
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      className="flex-1"
                      placeholder="0.00"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setPaymentAmount(selectedSchool.pending.toFixed(2))}
                    >
                      Tamamı
                    </Button>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    Bekleyen: {selectedSchool.pending.toFixed(2)} TL — kısmi ödeme girebilirsiniz
                  </p>
                </div>
                {paymentError && (
                  <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{paymentError}</p>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentDialogOpen(false)} disabled={submitting}>
              Iptal
            </Button>
            <Button onClick={createPayment} disabled={submitting}>
              {submitting ? "Kaydediliyor..." : "Hakedis Olustur"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
