"use client"

import { useState, useEffect, useRef } from "react"
import { useTranslations, useLocale } from "next-intl"
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
import { Search, DollarSign, CheckCircle, Clock, Building2, Download, XCircle, AlertTriangle } from "lucide-react"
import { formatDate, formatPrice, normalizeSearch } from "@/lib/utils"

interface SchoolPayment {
  id: string
  school: { id: string; name: string }
  amount: number
  period: string
  status: string
  paidAt: string | null
  cancelledAt: string | null
  cancelReason: string | null
  createdAt: string
}

interface SchoolSummary {
  id: string
  name: string
  isActive: boolean
  overpaid: number
  commissionRate: number
  totalOrders: number
  totalRevenue: number
  commission: number
  paid: number
  pendingPayments: number
  pending: number
}

export default function HakedislerPage() {
  const t = useTranslations('admin.payments')
  const locale = useLocale()
  const tl = (v: number | string) => `${formatPrice(v, locale)} TL`
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
        setListError(data?.error || t('payFailed', { status: res.status }))
        return
      }
      fetchData()
    } catch {
      setListError(t('serverUnreachable'))
    } finally {
      setPayingId(null)
    }
  }

  const [paymentError, setPaymentError] = useState("")
  const [paymentAmount, setPaymentAmount] = useState("")
  const [submitting, setSubmitting] = useState(false)
  // Kayit oncesi ozet adimi + sunucudan gelen mukerrer uyarisi
  const [confirmStep, setConfirmStep] = useState(false)
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  // State bir sonraki render'a kadar guncellenmez; hizli cift tikta ikinci istegi bu kilit keser
  const submitLock = useRef(false)

  const openPaymentDialog = (school: SchoolSummary) => {
    setSelectedSchool(school)
    setPaymentAmount(school.pending.toFixed(2))
    setPaymentError("")
    setConfirmStep(false)
    setDuplicateWarning(null)
    setPaymentDialogOpen(true)
  }

  const parsedAmount = parseFloat(paymentAmount.replace(',', '.'))

  const goToConfirm = () => {
    if (!selectedSchool) return
    setPaymentError("")
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setPaymentError(t('invalidAmount'))
      return
    }
    // Kurus bazinda karsilastir: "Tamami" 26.95 iken pending 26.949999... olabilir
    if (Math.round(parsedAmount * 100) > Math.round(selectedSchool.pending * 100)) {
      setPaymentError(t('amountExceeds', { value: formatPrice(selectedSchool.pending, locale) }))
      return
    }
    setDuplicateWarning(null)
    setConfirmStep(true)
  }

  const createPayment = async () => {
    if (!selectedSchool || submitLock.current) return
    submitLock.current = true
    setPaymentError("")
    setSubmitting(true)
    try {
      const res = await fetch("/api/admin/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({
          schoolId: selectedSchool.id,
          amount: parsedAmount,
          // Uyari gosterildiyse ve admin yine de kaydet dediyse
          confirmDuplicate: duplicateWarning !== null
        })
      })

      if (!res.ok) {
        const data = await safeJson(res)
        if (res.status === 409 && data?.code === 'DUPLICATE') {
          setDuplicateWarning(data.error)
          return
        }
        setPaymentError(data?.error || t('createFailed', { status: res.status }))
        return
      }

      setSuccessMessage(t('paymentSaved', { school: selectedSchool.name, amount: tl(parsedAmount) }))
      fetchData()
      setPaymentDialogOpen(false)
    } catch {
      setPaymentError(t('serverUnreachable'))
    } finally {
      submitLock.current = false
      setSubmitting(false)
    }
  }

  // Hatali/mukerrer kaydi iptal (silinmez, gerekceyle CANCELLED olur)
  const [cancelTarget, setCancelTarget] = useState<SchoolPayment | null>(null)
  const [cancelReason, setCancelReason] = useState("")
  const [cancelError, setCancelError] = useState("")
  const [cancelling, setCancelling] = useState(false)

  const cancelPayment = async () => {
    if (!cancelTarget || cancelling) return
    if (cancelReason.trim().length < 3) {
      setCancelError(t('cancelReasonRequired'))
      return
    }
    setCancelError("")
    setCancelling(true)
    try {
      const res = await fetch(`/api/admin/payments/${cancelTarget.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({ reason: cancelReason.trim() })
      })
      if (!res.ok) {
        const data = await safeJson(res)
        setCancelError(data?.error || t('cancelFailed', { status: res.status }))
        return
      }
      setSuccessMessage(t('paymentCancelled', { school: cancelTarget.school.name, amount: tl(cancelTarget.amount) }))
      setCancelTarget(null)
      fetchData()
    } catch {
      setCancelError(t('serverUnreachable'))
    } finally {
      setCancelling(false)
    }
  }

  const q = normalizeSearch(searchTerm)
  const filteredPayments = payments.filter(p => {
    const matchesSearch = normalizeSearch(p.school.name).includes(q)
    const matchesStatus = !filterStatus || p.status === filterStatus
    return matchesSearch && matchesStatus
  })

  const totalPending = schoolSummaries.reduce((acc, s) => acc + s.pending, 0)
  const totalPaid = payments
    .filter(p => p.status === "PAID")
    .reduce((acc, p) => acc + Number(p.amount), 0)
  // Eski akistan kalan, henuz "Odendi" isaretlenmemis kayitlar
  const totalAwaiting = payments
    .filter(p => p.status === "PENDING")
    .reduce((acc, p) => acc + Number(p.amount), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
          <p className="text-gray-500">{t('subtitle')}</p>
        </div>
        <a
          href="/api/admin/payments/export"
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border border-gray-200 rounded-md bg-white hover:bg-gray-50 transition-colors"
        >
          <Download className="h-4 w-4" />
          {t('exportExcel')}
        </a>
      </div>

      {/* Ozet Kartlari */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              {t('pendingCommission')}
            </CardTitle>
            <Clock className="h-5 w-5 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {tl(totalPending)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              {t('totalPaid')}
            </CardTitle>
            <CheckCircle className="h-5 w-5 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {tl(totalPaid)}
            </div>
            {totalAwaiting > 0 && (
              <p className="text-xs text-orange-600 mt-1">
                {t('pendingConfirmationHint', { value: tl(totalAwaiting) })}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              {t('activeSchools')}
            </CardTitle>
            <Building2 className="h-5 w-5 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {schoolSummaries.filter(s => s.isActive && s.totalOrders > 0).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Okul Ozeti */}
      <Card>
        <CardHeader>
          <CardTitle>{t('schoolSummaryTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-gray-500">{t('loading')}</div>
          ) : schoolSummaries.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Building2 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>{t('noSummaryData')}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('colSchool')}</TableHead>
                  <TableHead>{t('colOrderCount')}</TableHead>
                  <TableHead>{t('colTotalRevenue')}</TableHead>
                  <TableHead>{t('colTotalCommission')}</TableHead>
                  <TableHead className="text-green-700">{t('colPaid')}</TableHead>
                  <TableHead className="text-orange-700">{t('colProcessing')}</TableHead>
                  <TableHead className="text-yellow-700">{t('colRemaining')}</TableHead>
                  <TableHead className="text-right">{t('colAction')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schoolSummaries.map((school) => (
                  <TableRow key={school.id}>
                    <TableCell className="font-medium">
                      {school.name}
                      {!school.isActive && (
                        <Badge variant="secondary" className="ml-2">{t('inactiveSchool')}</Badge>
                      )}
                    </TableCell>
                    <TableCell>{school.totalOrders}</TableCell>
                    <TableCell>{tl(school.totalRevenue)}</TableCell>
                    <TableCell>{tl(school.commission)}</TableCell>
                    <TableCell className="font-medium text-green-600">
                      {school.paid > 0 ? tl(school.paid) : <span className="text-gray-400">—</span>}
                    </TableCell>
                    <TableCell className="font-medium text-orange-600">
                      {school.pendingPayments > 0 ? tl(school.pendingPayments) : <span className="text-gray-400">—</span>}
                    </TableCell>
                    <TableCell className="font-medium text-yellow-600">
                      {school.pending > 0
                        ? tl(school.pending)
                        : school.overpaid > 0
                          ? <span className="text-red-600">{t('overpaid', { value: tl(school.overpaid) })}</span>
                          : school.pendingPayments > 0
                            ? <span className="text-orange-600">{t('awaitingConfirmation')}</span>
                            : <span className="text-green-500">{t('done')}</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      {school.pending > 0 && (
                        <Button
                          size="sm"
                          onClick={() => openPaymentDialog(school)}
                        >
                          <DollarSign className="h-4 w-4 mr-1" />
                          {t('makePayment')}
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
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <CardTitle>{t('paymentHistory')}</CardTitle>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder={t('searchSchool')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-full sm:w-[200px]"
                />
              </div>
              <Select value={filterStatus || "__all__"} onValueChange={(val) => setFilterStatus(val === "__all__" ? "" : val)}>
                <SelectTrigger className="w-full sm:w-[150px]">
                  <SelectValue placeholder={t('allStatuses')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">{t('all')}</SelectItem>
                  <SelectItem value="PENDING">{t('statusPending')}</SelectItem>
                  <SelectItem value="PAID">{t('statusPaid')}</SelectItem>
                  <SelectItem value="CANCELLED">{t('statusCancelled')}</SelectItem>
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
          {successMessage && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 flex items-center justify-between gap-2">
              <span>{successMessage}</span>
              <button type="button" className="text-green-700 hover:text-green-900" onClick={() => setSuccessMessage(null)}>×</button>
            </div>
          )}
          {filteredPayments.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {t('noPaymentRecords')}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('colSchool')}</TableHead>
                  <TableHead>{t('colPeriod')}</TableHead>
                  <TableHead>{t('colAmount')}</TableHead>
                  <TableHead>{t('colStatus')}</TableHead>
                  <TableHead>{t('colCreatedAt')}</TableHead>
                  <TableHead>{t('colPaidAt')}</TableHead>
                  <TableHead className="text-right">{t('colAction')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPayments.map((payment) => (
                  <TableRow key={payment.id} className={payment.status === "CANCELLED" ? "opacity-60" : undefined}>
                    <TableCell className="font-medium">{payment.school.name}</TableCell>
                    <TableCell>{payment.period}</TableCell>
                    <TableCell className={payment.status === "CANCELLED" ? "line-through" : undefined}>{tl(payment.amount)}</TableCell>
                    <TableCell>
                      {payment.status === "CANCELLED" ? (
                        <div>
                          <Badge variant="outline" className="text-gray-500">{t('statusCancelled')}</Badge>
                          {payment.cancelReason && (
                            <p className="text-xs text-gray-500 mt-1 max-w-[220px]">{payment.cancelReason}</p>
                          )}
                        </div>
                      ) : (
                        <Badge variant={payment.status === "PAID" ? "default" : "secondary"}>
                          {payment.status === "PAID" ? t('statusPaid') : t('statusPending')}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{formatDate(payment.createdAt)}</TableCell>
                    <TableCell>{payment.paidAt ? formatDate(payment.paidAt) : "-"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {payment.status === "PENDING" && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={payingId === payment.id}
                            onClick={() => markAsPaid(payment.id)}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            {payingId === payment.id ? t('processing') : t('markPaid')}
                          </Button>
                        )}
                        {payment.status !== "CANCELLED" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => {
                              setCancelTarget(payment)
                              setCancelReason("")
                              setCancelError("")
                            }}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            {t('cancelPayment')}
                          </Button>
                        )}
                      </div>
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
            <DialogTitle>{t('createPaymentTitle')}</DialogTitle>
          </DialogHeader>
          {selectedSchool && (
            <div className="space-y-4 py-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium">{selectedSchool.name}</h4>
                <p className="text-sm text-gray-500 mt-1">
                  {t('commissionRate', { rate: selectedSchool.commissionRate })}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">{t('totalRevenueLabel')}</span>
                  <p className="font-medium">{tl(selectedSchool.totalRevenue)}</p>
                </div>
                <div>
                  <span className="text-gray-500">{t('totalCommissionLabel')}</span>
                  <p className="font-medium">{tl(selectedSchool.commission)}</p>
                </div>
                <div>
                  <span className="text-gray-500">{t('paidLabel')}</span>
                  <p className="font-medium text-green-600">{tl(selectedSchool.paid)}</p>
                </div>
                {selectedSchool.pendingPayments > 0 && (
                  <div>
                    <span className="text-gray-500">{t('processingLabel')}</span>
                    <p className="font-medium text-orange-600">{tl(selectedSchool.pendingPayments)}</p>
                  </div>
                )}
                <div className="col-span-2 border-t pt-2">
                  <span className="text-gray-500">{t('remainingLabel')}</span>
                  <p className="font-bold text-yellow-700 text-lg">{tl(selectedSchool.pending)}</p>
                </div>
              </div>
              {confirmStep ? (
              <div className="border-t pt-4 space-y-3">
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-900">
                  {t.rich('confirmPaymentText', {
                    school: selectedSchool.name,
                    amount: tl(parsedAmount),
                    b: (chunks) => <strong>{chunks}</strong>
                  })}
                </div>
                {duplicateWarning && (
                  <div className="p-3 bg-orange-50 border border-orange-300 rounded-lg text-sm text-orange-800 flex gap-2">
                    <AlertTriangle className="h-5 w-5 shrink-0" />
                    <span>{duplicateWarning}</span>
                  </div>
                )}
                {paymentError && (
                  <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{paymentError}</p>
                )}
              </div>
              ) : (
              <div className="border-t pt-4 space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('amountToPayLabel')}
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
                      {t('fullAmount')}
                    </Button>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    {t('pendingHint', { value: formatPrice(selectedSchool.pending, locale) })}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {t('paymentRecordedAsPaid')}
                  </p>
                </div>
                {paymentError && (
                  <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{paymentError}</p>
                )}
              </div>
              )}
            </div>
          )}
          <DialogFooter>
            {confirmStep ? (
              <>
                <Button variant="outline" onClick={() => { setConfirmStep(false); setDuplicateWarning(null) }} disabled={submitting}>
                  {t('back')}
                </Button>
                <Button
                  onClick={createPayment}
                  disabled={submitting}
                  className={duplicateWarning ? "bg-orange-600 hover:bg-orange-700" : undefined}
                >
                  {submitting ? t('saving') : duplicateWarning ? t('saveAnyway') : t('confirmAndSave')}
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>
                  {t('cancel')}
                </Button>
                <Button onClick={goToConfirm}>
                  {t('createPayment')}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hakedis Iptal Dialog */}
      <Dialog open={cancelTarget !== null} onOpenChange={(open) => { if (!open && !cancelling) setCancelTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('cancelPaymentTitle')}</DialogTitle>
          </DialogHeader>
          {cancelTarget && (
            <div className="space-y-4 py-2">
              <div className="p-3 bg-gray-50 rounded-lg text-sm">
                <p className="font-medium">{cancelTarget.school.name}</p>
                <p className="text-gray-600 mt-1">
                  {tl(cancelTarget.amount)} · {formatDate(cancelTarget.createdAt)} · {cancelTarget.status === "PAID" ? t('statusPaid') : t('statusPending')}
                </p>
              </div>
              <p className="text-sm text-gray-600">{t('cancelPaymentHint')}</p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('cancelReasonLabel')}</label>
                <Input
                  value={cancelReason}
                  maxLength={500}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder={t('cancelReasonPlaceholder')}
                />
              </div>
              {cancelError && (
                <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{cancelError}</p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelTarget(null)} disabled={cancelling}>
              {t('back')}
            </Button>
            <Button onClick={cancelPayment} disabled={cancelling} className="bg-red-600 hover:bg-red-700">
              {cancelling ? t('processing') : t('confirmCancelPayment')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
