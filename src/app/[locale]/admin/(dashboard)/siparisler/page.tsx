"use client"

import { useState, useEffect, useMemo } from "react"
import { useTranslations, useLocale } from "next-intl"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from "@/components/ui/dialog"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Search, Eye, FileText, Truck, X, ArrowRight,
  CheckCircle, CheckCheck, RefreshCw, RotateCcw, Loader2, Printer, Download, Inbox
} from "lucide-react"
import { formatDateTime, formatPrice, normalizeSearch } from "@/lib/utils"
import { ORDER_STATUS_COLORS } from "@/lib/constants"
import {
  previewShippingLabel, printBulkLabels,
  type LabelOrder
} from "@/lib/shipping-label"

// ============================================================
// Tipler
// ============================================================
interface OrderStudent {
  id: string
  firstName: string
  lastName: string
  section: string | null
}

interface OrderType {
  id: string
  orderNumber: string
  studentName: string
  parentName: string
  parentPhone: string
  parentEmail: string | null
  deliveryType: string
  deliveryAddress: string | null
  trackingNo: string | null
  invoiceNo: string | null
  discountCode: string | null
  discountAmount: number | null
  totalAmount: number
  status: string
  paymentMethod: string | null
  createdAt: string
  shippedAt: string | null
  class: {
    name: string
    school: { name: string }
  }
  package: { name: string; items?: { id: string; name: string; quantity: number; price: number }[] } | null
  items?: { id: string; name: string; quantity: number; price: number }[]
  students?: OrderStudent[]
}

// ============================================================
// İş akışı: yeni 4-asamali model
// ============================================================
//
//   Gelen Sipariş (PAID) → [Onayla] → Hazırlanıyor (CONFIRMED)
//     → [Kargola | Okula Teslim Et] → Dağıtımda (SHIPPED)   (KolayBi odeme aninda gonderildi)
//     → [Tamamlandı (COMPLETED)] veya [Teslim Edilemeyen (UNDELIVERED)]
//   UNDELIVERED → [Tekrar Dağıtıma Çıkar] → SHIPPED
//   İptal: PAID/CONFIRMED → CANCELLED → (opsiyonel) REFUNDED
//
// Odenmemis (NEW/PAYMENT_PENDING) siparis API tarafindan hic donmez.

// Sayfanin ust kismindaki sekmeler
// statusKey: status namespace anahtari (durum adi sekmeleri icin); 'tumu' icin null.
const TABS = [
  { id: 'gelen',             statusKey: 'PAID',        statuses: ['PAID'] as string[] },
  { id: 'hazirlaniyor',      statusKey: 'CONFIRMED',   statuses: ['CONFIRMED'] as string[] },
  { id: 'dagitimda',         statusKey: 'SHIPPED',     statuses: ['SHIPPED'] as string[] },
  { id: 'teslim_edilemeyen', statusKey: 'UNDELIVERED', statuses: ['UNDELIVERED'] as string[] },
  { id: 'tamamlandi',        statusKey: 'COMPLETED',   statuses: ['COMPLETED'] as string[] },
  { id: 'iptal',             statusKey: 'CANCELLED',   statuses: ['CANCELLED', 'REFUNDED'] as string[] },
  { id: 'tumu',              statusKey: null,          statuses: [] as string[] },
] as const

type TabId = typeof TABS[number]['id']

// Sipariste bir sonraki birincil adim (durum + teslimat tipine gore)
// labelKey: admin.orders namespace anahtari (aksiyon butonu metni)
type NextStep =
  | { kind: 'none' }
  | { kind: 'confirm';         labelKey: string }  // PAID -> CONFIRMED (PUT)
  | { kind: 'ship';            labelKey: string }  // CARGO CONFIRMED -> SHIPPED (/shipment)
  | { kind: 'school_dispatch'; labelKey: string }  // SCHOOL CONFIRMED -> SHIPPED (deliveries/batch SCHOOL_DISPATCH)
  | { kind: 'complete';        labelKey: string }  // SHIPPED -> COMPLETED (deliveries/batch COMPLETED)
  | { kind: 'redispatch';      labelKey: string }  // UNDELIVERED -> SHIPPED (deliveries/batch REDISPATCH)

function getNextStep(order: OrderType): NextStep {
  const isCargo = order.deliveryType === 'CARGO'
  switch (order.status) {
    case 'PAID':
      return { kind: 'confirm', labelKey: 'actionConfirm' }
    case 'CONFIRMED':
      return isCargo
        ? { kind: 'ship', labelKey: 'actionShip' }
        : { kind: 'school_dispatch', labelKey: 'actionSchoolDispatch' }
    case 'SHIPPED':
      return { kind: 'complete', labelKey: 'actionComplete' }
    case 'UNDELIVERED':
      return { kind: 'redispatch', labelKey: 'actionRedispatch' }
    default:
      return { kind: 'none' }
  }
}

// Toplu islem secenekleri (durum + opsiyonel teslimat tipi)
type BulkActionKey = 'confirm' | 'ship' | 'school_dispatch' | 'complete' | 'undeliver' | 'redispatch'

const BULK_ACTIONS: Record<BulkActionKey, {
  labelKey: string
  eligibleStatuses: string[]
  deliveryType?: 'CARGO' | 'SCHOOL_DELIVERY'
  icon: typeof FileText
}> = {
  confirm:         { labelKey: 'bulkConfirm',        eligibleStatuses: ['PAID'],        icon: CheckCircle },
  ship:            { labelKey: 'bulkShip',           eligibleStatuses: ['CONFIRMED'],   deliveryType: 'CARGO',           icon: Truck },
  school_dispatch: { labelKey: 'bulkSchoolDispatch', eligibleStatuses: ['CONFIRMED'],   deliveryType: 'SCHOOL_DELIVERY', icon: ArrowRight },
  complete:        { labelKey: 'bulkComplete',       eligibleStatuses: ['SHIPPED'],     icon: CheckCheck },
  undeliver:       { labelKey: 'bulkUndeliver',      eligibleStatuses: ['SHIPPED'],     icon: RotateCcw },
  redispatch:      { labelKey: 'bulkRedispatch',     eligibleStatuses: ['UNDELIVERED'], icon: RefreshCw },
}

// ============================================================
// Sayfa
// ============================================================
export default function SiparislerPage() {
  const t = useTranslations('admin.orders')
  const ts = useTranslations('status')
  const locale = useLocale()
  const [orders, setOrders] = useState<OrderType[]>([])
  const [loading, setLoading] = useState(true)

  // Filtreler
  const [activeTab, setActiveTab] = useState<TabId>('gelen')
  const [searchTerm, setSearchTerm] = useState("")
  const [filterDelivery, setFilterDelivery] = useState<"" | "CARGO" | "SCHOOL_DELIVERY">("")
  // Liste tarih filtresi (sunucu tarafi)
  const [listStart, setListStart] = useState<string>("")
  const [listEnd, setListEnd] = useState<string>("")

  // Secili siparisleri indirme (teslim excel)
  const [downloadingSelected, setDownloadingSelected] = useState(false)

  // Teslim Listesi raporu filtreleri
  const [reportSchools, setReportSchools] = useState<Array<{ id: string; name: string }>>([])
  const [reportSchoolId, setReportSchoolId] = useState<string>("")
  const [reportStart, setReportStart] = useState<string>("")
  const [reportEnd, setReportEnd] = useState<string>("")

  // Detay
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<OrderType | null>(null)

  // Tekil islem loading: Map<orderId, "label">
  const [actionLoading, setActionLoading] = useState<Map<string, string>>(new Map())
  const isOrderBusy = (orderId: string) => actionLoading.has(orderId)
  const setOrderBusy = (orderId: string, label: string) => {
    setActionLoading(prev => new Map(prev).set(orderId, label))
  }
  const clearOrderBusy = (orderId: string) => {
    setActionLoading(prev => {
      const next = new Map(prev)
      next.delete(orderId)
      return next
    })
  }

  // Toplu islem
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set())
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false)
  const [bulkAction, setBulkAction] = useState<BulkActionKey | null>(null)
  const [bulkLoading, setBulkLoading] = useState(false)
  const [bulkResult, setBulkResult] = useState<{ message: string; success: number; failed: number } | null>(null)

  // Sayfa-genel sync loading (kargo durum sorgulama)
  const [syncLoading, setSyncLoading] = useState(false)

  // Etiket onizleme
  const [labelPreviewUrl, setLabelPreviewUrl] = useState<string | null>(null)
  const [labelPreviewOpen, setLabelPreviewOpen] = useState(false)
  const [labelPreviewOrderNumber, setLabelPreviewOrderNumber] = useState<string>("")

  // ============================================================
  // Veri yukleme
  // ============================================================
  const fetchOrders = async () => {
    try {
      const qs = new URLSearchParams({ limit: '100' })
      if (listStart) qs.set('start', listStart)
      if (listEnd) qs.set('end', listEnd)
      const res = await fetch(`/api/admin/orders?${qs.toString()}`, { credentials: 'include' })
      const data = await res.json()
      setOrders(data.orders || [])
    } catch (error) {
      console.error("Siparisler yuklenemedi:", error)
    } finally {
      setLoading(false)
    }
  }

  // Tarih filtresi degisince yeniden yukle
  useEffect(() => { fetchOrders() }, [listStart, listEnd]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetch('/api/admin/schools', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.schools) {
          setReportSchools(d.schools.map((s: { id: string; name: string }) => ({ id: s.id, name: s.name })))
        }
      })
      .catch(() => {})
  }, [])

  // ============================================================
  // Tekil islemler — tek "Sonraki Adim" handler'i
  // ============================================================
  const runStep = async (order: OrderType, step: NextStep) => {
    if (step.kind === 'none') return
    setOrderBusy(order.id, t(step.labelKey))

    try {
      let res: Response | null = null

      if (step.kind === 'confirm') {
        // PAID -> CONFIRMED (PUT)
        res = await fetch(`/api/admin/orders/${order.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ status: 'CONFIRMED' })
        })
      } else if (step.kind === 'ship') {
        // CARGO CONFIRMED -> SHIPPED (+ kargo/trackingNo)
        res = await fetch(`/api/admin/orders/${order.id}/shipment`, {
          method: 'POST', credentials: 'include'
        })
      } else {
        // school_dispatch / complete / redispatch -> deliveries/batch
        const action =
          step.kind === 'school_dispatch' ? 'SCHOOL_DISPATCH'
          : step.kind === 'complete' ? 'COMPLETED'
          : 'REDISPATCH'
        res = await fetch('/api/admin/deliveries/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ orderIds: [order.id], action })
        })
      }

      if (!res) return
      const data = await res.json().catch(() => ({}))

      if (!res.ok || (data.summary && data.summary.success === 0)) {
        const msg = data.results?.[0]?.error || data.error || t('actionFailed')
        alert(msg)
      }
      await fetchOrders()
    } catch (error) {
      console.error('Aksiyon hatasi:', error)
      alert(t('genericError'))
    } finally {
      clearOrderBusy(order.id)
    }
  }

  // Iptal etme (cancel) — herhangi bir sipariste yapilabilir
  const cancelOrder = async (order: OrderType) => {
    if (!confirm(t('confirmCancel', { orderNumber: order.orderNumber }))) return
    setOrderBusy(order.id, t('cancelling'))
    try {
      const res = await fetch(`/api/admin/orders/${order.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: 'CANCELLED' })
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        alert(data.error || t('cancelFailed'))
      }
      await fetchOrders()
    } finally {
      clearOrderBusy(order.id)
    }
  }

  // İade et (CANCELLED siparişi REFUNDED'a geçir)
  const refundOrder = async (order: OrderType) => {
    const tutar = Number(order.totalAmount).toFixed(2)
    if (!confirm(t('confirmRefund', { orderNumber: order.orderNumber, amount: tutar }))) return
    setOrderBusy(order.id, t('refunding'))
    try {
      const res = await fetch(`/api/admin/orders/${order.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: 'REFUNDED' })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        alert(data.error || t('refundFailed'))
      } else {
        alert(t('refundSuccess', { amount: tutar }))
      }
      await fetchOrders()
    } finally {
      clearOrderBusy(order.id)
    }
  }

  // Teslim Edilemeyen olarak isaretle (Dagitimda/SHIPPED siparisler icin)
  const markUndelivered = async (order: OrderType) => {
    if (!confirm(t('confirmUndelivered', { orderNumber: order.orderNumber }))) return
    setOrderBusy(order.id, t('actionUndeliver'))
    try {
      const res = await fetch('/api/admin/deliveries/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ orderIds: [order.id], action: 'UNDELIVERED' })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || (data.summary && data.summary.success === 0)) {
        alert(data.results?.[0]?.error || data.error || t('actionFailed'))
      }
      await fetchOrders()
    } finally {
      clearOrderBusy(order.id)
    }
  }

  // ============================================================
  // Toplu islem — uygun olmayan siparisleri ATLA
  // ============================================================
  const handleBulkAction = async () => {
    if (!bulkAction) return
    const action = BULK_ACTIONS[bulkAction]
    setBulkLoading(true)
    setBulkResult(null)

    // Sadece UYGUN (durum + teslimat tipi) siparisleri gonder
    const eligible = orders.filter(o =>
      selectedOrders.has(o.id) &&
      action.eligibleStatuses.includes(o.status) &&
      (!action.deliveryType || o.deliveryType === action.deliveryType)
    )
    const ids = eligible.map(o => o.id)
    const skipped = selectedOrders.size - ids.length

    if (ids.length === 0) {
      setBulkResult({
        message: t('bulkNoneEligible', { count: selectedOrders.size, action: t(action.labelKey) }),
        success: 0,
        failed: 0
      })
      setBulkLoading(false)
      return
    }

    try {
      let endpoint = '/api/admin/deliveries/batch'
      let body: Record<string, unknown> = { orderIds: ids }
      if (bulkAction === 'ship') {
        endpoint = '/api/admin/orders/batch/shipments'
      } else if (bulkAction === 'confirm') {
        body = { orderIds: ids, action: 'CONFIRM' }
      } else if (bulkAction === 'school_dispatch') {
        body = { orderIds: ids, action: 'SCHOOL_DISPATCH' }
      } else if (bulkAction === 'complete') {
        body = { orderIds: ids, action: 'COMPLETED' }
      } else if (bulkAction === 'undeliver') {
        body = { orderIds: ids, action: 'UNDELIVERED' }
      } else if (bulkAction === 'redispatch') {
        body = { orderIds: ids, action: 'REDISPATCH' }
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      const success = data.summary?.success ?? 0
      const failed = (data.summary?.failed ?? 0) + skipped
      const skipNote = skipped > 0 ? t('bulkSkipNote', { count: skipped }) : ''
      setBulkResult({
        message: (data.message || t('bulkDone')) + skipNote,
        success,
        failed,
      })

      await fetchOrders()
      setSelectedOrders(new Set())
    } catch (error) {
      console.error("Toplu islem hatasi:", error)
      setBulkResult({ message: t('genericError'), success: 0, failed: ids.length + skipped })
    } finally {
      setBulkLoading(false)
    }
  }

  const handleSyncCargo = async () => {
    setSyncLoading(true)
    try {
      const res = await fetch('/api/admin/deliveries/sync-cargo', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify({})
      })
      const data = await res.json()
      if (data.success) {
        alert(t('syncResult', { total: data.summary.total, updated: data.summary.updated }))
        fetchOrders()
      }
    } catch (error) { console.error('Kargo sync hatasi:', error) }
    finally { setSyncLoading(false) }
  }

  // ============================================================
  // Etiket
  // ============================================================
  const toLabelOrder = (order: OrderType): LabelOrder => ({
    orderNumber: order.orderNumber,
    parentName: order.parentName,
    phone: order.parentPhone,
    deliveryAddress: order.deliveryAddress,
    trackingNo: order.trackingNo || '',
    totalAmount: order.totalAmount,
    shippedAt: order.shippedAt,
    class: order.class,
    package: order.package || undefined,
  })

  const openLabelPreview = async (order: OrderType) => {
    if (!order.trackingNo) {
      alert(t('noTrackingNo'))
      return
    }
    setOrderBusy(order.id, t('labelBusy'))
    setLabelPreviewOrderNumber(order.orderNumber)
    try {
      const url = await previewShippingLabel(toLabelOrder(order), locale as 'tr' | 'en' | 'de' | 'ar')
      setLabelPreviewUrl(url)
      setLabelPreviewOpen(true)
    } catch (e) {
      console.error('Etiket olusturulamadi:', e)
      alert(t('labelCreateFailed'))
    } finally {
      clearOrderBusy(order.id)
    }
  }

  const printSelectedBarcodes = async () => {
    const labels = orders
      .filter(o => selectedOrders.has(o.id) && o.deliveryType === 'CARGO' && o.trackingNo)
      .map(toLabelOrder)
    if (labels.length === 0) {
      alert(t('noCargoSelected'))
      return
    }
    try {
      await printBulkLabels(labels, locale as 'tr' | 'en' | 'de' | 'ar')
    } catch (e) {
      console.error(e)
      alert(t('printError', { message: e instanceof Error ? e.message : t('unknown') }))
    }
  }

  const handleDownloadLabel = async () => {
    if (!labelPreviewUrl) return
    const a = document.createElement('a')
    a.href = labelPreviewUrl
    a.download = `etiket-${labelPreviewOrderNumber}.pdf`
    a.click()
  }

  const closeLabelPreview = () => {
    setLabelPreviewOpen(false)
    if (labelPreviewUrl) {
      URL.revokeObjectURL(labelPreviewUrl)
      setLabelPreviewUrl(null)
    }
  }

  // ============================================================
  // Filtreleme + sekme bazli sayim
  // ============================================================
  const tabCounts = useMemo(() => {
    const counts: Record<TabId, number> = { gelen: 0, hazirlaniyor: 0, dagitimda: 0, teslim_edilemeyen: 0, tamamlandi: 0, iptal: 0, tumu: 0 }
    counts.tumu = orders.length
    for (const o of orders) {
      for (const tab of TABS) {
        if (tab.id === 'tumu') continue
        if (tab.statuses.includes(o.status)) counts[tab.id]++
      }
    }
    return counts
  }, [orders])

  const filteredOrders = useMemo(() => {
    const tab = TABS.find(t => t.id === activeTab)!
    const term = normalizeSearch(searchTerm)
    return orders.filter(o => {
      if (tab.statuses.length > 0 && !tab.statuses.includes(o.status)) return false
      if (filterDelivery && o.deliveryType !== filterDelivery) return false
      if (term) {
        const hit =
          normalizeSearch(o.orderNumber).includes(term) ||
          normalizeSearch(o.studentName).includes(term) ||
          normalizeSearch(o.parentName).includes(term) ||
          normalizeSearch(o.class.school.name).includes(term) ||
          (o.trackingNo ? normalizeSearch(o.trackingNo).includes(term) : false)
        if (!hit) return false
      }
      return true
    })
  }, [orders, activeTab, searchTerm, filterDelivery])

  // Toplu islem icin kac siparis uygun? (durum + teslimat tipi)
  const bulkEligibility = useMemo(() => {
    const result: Record<BulkActionKey, number> = {
      confirm: 0, ship: 0, school_dispatch: 0, complete: 0, undeliver: 0, redispatch: 0
    }
    for (const o of orders) {
      if (!selectedOrders.has(o.id)) continue
      for (const key of Object.keys(BULK_ACTIONS) as BulkActionKey[]) {
        const def = BULK_ACTIONS[key]
        if (def.eligibleStatuses.includes(o.status) && (!def.deliveryType || o.deliveryType === def.deliveryType)) {
          result[key]++
        }
      }
    }
    return result
  }, [orders, selectedOrders])

  // Secili siparisleri Teslim Excel'i olarak indir (POST -> blob)
  const downloadSelectedTeslim = async () => {
    const ids = Array.from(selectedOrders)
    if (ids.length === 0) return
    setDownloadingSelected(true)
    try {
      const res = await fetch('/api/admin/orders/export-teslim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ orderIds: ids })
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        alert(data.error || t('downloadFailed'))
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `teslim_listesi_secili_${new Date().toISOString().slice(0, 10)}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error('Secili teslim indirme hatasi:', e)
      alert(t('downloadError'))
    } finally {
      setDownloadingSelected(false)
    }
  }

  // Secim
  const toggleSelectAll = () => {
    if (selectedOrders.size === filteredOrders.length) setSelectedOrders(new Set())
    else setSelectedOrders(new Set(filteredOrders.map(o => o.id)))
  }
  const toggleSelectOrder = (orderId: string) => {
    const s = new Set(selectedOrders)
    if (s.has(orderId)) s.delete(orderId); else s.add(orderId)
    setSelectedOrders(s)
  }

  // ============================================================
  // Render
  // ============================================================
  const renderActions = (order: OrderType) => {
    const busyLabel = actionLoading.get(order.id)
    if (busyLabel) {
      return (
        <span className="inline-flex items-center text-xs text-gray-500">
          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          {busyLabel}
        </span>
      )
    }
    const step = getNextStep(order)
    const canCancel = ['PAID', 'CONFIRMED'].includes(order.status)
    const canRefund = order.status === 'CANCELLED'
    const showLabel = !!order.trackingNo
    const showUndeliver = order.status === 'SHIPPED'

    return (
      <div className="flex items-center gap-1">
        {showLabel && (
          <Button
            size="icon" variant="outline" className="h-7 w-7"
            onClick={() => openLabelPreview(order)}
            title={t('cargoLabel')}
          >
            <Printer className="h-3.5 w-3.5" />
          </Button>
        )}
        {step.kind !== 'none' && (
          <Button
            size="sm" className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white"
            onClick={() => runStep(order, step)}
          >
            {t(step.labelKey)}
            <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        )}
        {showUndeliver && (
          <Button
            size="sm" variant="outline" className="h-7 text-xs text-rose-600 border-rose-200 hover:bg-rose-50"
            onClick={() => markUndelivered(order)}
            title={t('markUndeliveredTitle')}
          >
            <RotateCcw className="h-3 w-3 mr-1" />{t('actionUndeliver')}
          </Button>
        )}
        {canRefund && (
          <Button
            size="sm" className="h-7 text-xs bg-orange-500 hover:bg-orange-600 text-white"
            onClick={() => refundOrder(order)}
            title={t('refundTitle')}
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            {t('refund')}
          </Button>
        )}
        {canCancel && (
          <Button
            size="icon" variant="outline" className="h-7 w-7 text-red-600 border-red-200 hover:bg-red-50"
            onClick={() => cancelOrder(order)}
            title={t('cancelOrderTitle')}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
          <p className="text-gray-500">{t('subtitle')}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={() => window.open('/api/admin/orders/export', '_blank')}
          >
            <Download className="h-4 w-4 mr-2" />
            {t('orderList')}
          </Button>
          <Button variant="outline" onClick={handleSyncCargo} disabled={syncLoading}>
            {syncLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            {t('syncCargo')}
          </Button>
        </div>
      </div>

      {/* Okul Teslim Raporu */}
      <Card className="border-emerald-200">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2 text-emerald-700">
            <FileText className="h-5 w-5" />
            <h2 className="text-lg font-semibold text-gray-900">{t('deliveryListTitle')}</h2>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {t('deliveryListSubtitle')}
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">{t('schoolLabel')}</label>
              <Select value={reportSchoolId || "__all__"} onValueChange={(v) => setReportSchoolId(v === "__all__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder={t('allSchools')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">{t('allSchools')}</SelectItem>
                  {reportSchools.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">{t('startLabel')}</label>
              <input
                type="datetime-local"
                value={reportStart}
                onChange={(e) => setReportStart(e.target.value)}
                className="w-full h-9 px-3 border border-gray-200 rounded-md text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">{t('endLabel')}</label>
              <input
                type="datetime-local"
                value={reportEnd}
                onChange={(e) => setReportEnd(e.target.value)}
                className="w-full h-9 px-3 border border-gray-200 rounded-md text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <div className="flex items-end">
              <a
                href={`/api/admin/reports/okul-teslim/export?${[
                  reportSchoolId && `schoolId=${encodeURIComponent(reportSchoolId)}`,
                  reportStart && `start=${encodeURIComponent(reportStart)}`,
                  reportEnd && `end=${encodeURIComponent(reportEnd)}`,
                ].filter(Boolean).join('&')}`}
                className="inline-flex items-center justify-center gap-2 w-full h-9 px-4 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors"
              >
                <Download className="h-4 w-4" />
                {t('downloadExcel')}
              </a>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sekmeler */}
      <div className="border-b border-gray-200">
        <nav className="flex flex-wrap gap-1 -mb-px">
          {TABS.map(tab => {
            const isActive = activeTab === tab.id
            const count = tabCounts[tab.id]
            const tabLabel =
              tab.id === 'tumu' ? t('tabAll')
              : tab.id === 'iptal' ? t('tabCancelRefund')
              : ts(tab.statusKey!)
            return (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setSelectedOrders(new Set()) }}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  isActive
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tabLabel}
                <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                  isActive ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                }`}>
                  {count}
                </span>
              </button>
            )
          })}
        </nav>
      </div>

      {/* Sipariş Tablosu */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[260px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder={t('searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterDelivery || "__all__"} onValueChange={(v) => setFilterDelivery((v === "__all__" ? "" : v) as "" | "CARGO" | "SCHOOL_DELIVERY")}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder={t('deliveryFilter')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">{t('allDelivery')}</SelectItem>
                <SelectItem value="CARGO">{t('cargo')}</SelectItem>
                <SelectItem value="SCHOOL_DELIVERY">{t('schoolDelivery')}</SelectItem>
              </SelectContent>
            </Select>
            {/* Tarih araligi filtresi (sunucu tarafi) */}
            <div className="flex items-center gap-1.5">
              <input
                type="datetime-local"
                value={listStart}
                onChange={(e) => setListStart(e.target.value)}
                title={t('startDate')}
                className="h-9 px-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
              <span className="text-gray-400 text-sm">–</span>
              <input
                type="datetime-local"
                value={listEnd}
                onChange={(e) => setListEnd(e.target.value)}
                title={t('endDate')}
                className="h-9 px-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
              {(listStart || listEnd) && (
                <Button
                  size="icon" variant="ghost" className="h-8 w-8 text-gray-500"
                  onClick={() => { setListStart(""); setListEnd("") }}
                  title={t('clearDateFilter')}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Toplu İşlem Çubuğu — sadece secim varken */}
          {selectedOrders.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <span className="text-sm font-medium text-blue-900">
                {t('selectedCount', { count: selectedOrders.size })}
              </span>
              <span className="text-xs text-blue-700/70">•</span>

              {(Object.keys(BULK_ACTIONS) as BulkActionKey[]).map(key => {
                const def = BULK_ACTIONS[key]
                const Icon = def.icon
                const eligible = bulkEligibility[key]
                const disabled = eligible === 0 || bulkLoading
                return (
                  <Button
                    key={key}
                    size="sm"
                    variant="outline"
                    className="text-xs"
                    disabled={disabled}
                    onClick={() => { setBulkAction(key); setBulkDialogOpen(true); setBulkResult(null) }}
                    title={eligible === 0 ? t('noneEligibleShort') : ''}
                  >
                    <Icon className="h-3 w-3 mr-1" />
                    {t(def.labelKey)}
                    <span className={`ml-1.5 px-1.5 py-0.5 rounded text-[10px] ${
                      eligible > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {eligible}
                    </span>
                  </Button>
                )
              })}

              <Button
                size="sm" variant="outline" className="text-xs"
                onClick={printSelectedBarcodes}
                disabled={bulkLoading}
              >
                <Printer className="h-3 w-3 mr-1" />
                {t('printBarcodes')}
              </Button>

              <Button
                size="sm" variant="outline" className="text-xs"
                onClick={downloadSelectedTeslim}
                disabled={bulkLoading || downloadingSelected}
              >
                {downloadingSelected ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Download className="h-3 w-3 mr-1" />}
                {t('downloadSelected')}
              </Button>

              <Button
                size="sm" variant="ghost" className="text-gray-500 ml-auto"
                onClick={() => setSelectedOrders(new Set())}
                title={t('clearSelection')}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-gray-500">{t('loading')}</div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Inbox className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              {orders.length === 0 ? (
                <>
                  <p className="text-base font-medium text-gray-700">{t('emptyTitle')}</p>
                  <p className="text-sm mt-1">{t('emptySubtitle')}</p>
                </>
              ) : (
                <>
                  <p className="text-base font-medium text-gray-700">{t('emptyTabTitle')}</p>
                  <p className="text-sm mt-1">{t('emptyTabSubtitle')}</p>
                </>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={selectedOrders.size === filteredOrders.length && filteredOrders.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>{t('colOrderNo')}</TableHead>
                  <TableHead>{t('colStudent')}</TableHead>
                  <TableHead>{t('colSchoolClass')}</TableHead>
                  <TableHead>{t('colAmount')}</TableHead>
                  <TableHead>{t('colDelivery')}</TableHead>
                  <TableHead>{t('colStatus')}</TableHead>
                  <TableHead>{t('colDate')}</TableHead>
                  <TableHead className="text-right">{t('colActions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.map((order) => {
                  const studentCount = order.students?.length ?? 0
                  return (
                    <TableRow key={order.id} className={selectedOrders.has(order.id) ? "bg-blue-50" : ""}>
                      <TableCell>
                        <Checkbox
                          checked={selectedOrders.has(order.id)}
                          onCheckedChange={() => toggleSelectOrder(order.id)}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-sm">{order.orderNumber}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">
                            {order.studentName}
                            {studentCount > 1 && (
                              <span className="ml-1.5 text-xs text-blue-600 font-normal">
                                {t('siblings', { count: studentCount - 1 })}
                              </span>
                            )}
                          </p>
                          <p className="text-sm text-gray-500">{order.parentName}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p>{order.class.school.name}</p>
                          <p className="text-sm text-gray-500">{order.class.name}</p>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{Number(order.totalAmount).toFixed(2)} TL</TableCell>
                      <TableCell>
                        <div>
                          <span className="text-sm">{order.deliveryType === "CARGO" ? t('cargo') : t('schoolDelivery')}</span>
                          {order.trackingNo && (
                            <p className="text-xs text-orange-600 font-mono mt-0.5">{order.trackingNo}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <Badge className={ORDER_STATUS_COLORS[order.status] || ""}>
                            {ts.has(order.status) ? ts(order.status) : order.status}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">{formatDateTime(order.createdAt)}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost" size="icon" className="h-7 w-7"
                            onClick={() => { setSelectedOrder(order); setDetailDialogOpen(true) }}
                            title={t('detail')}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {renderActions(order)}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Sipariş Detay Dialog (çoklu öğrenci destekli) */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('orderDetailTitle', { orderNumber: selectedOrder?.orderNumber ?? '' })}</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              {/* Ogrenciler */}
              <div>
                <h4 className="font-medium text-gray-900 mb-2">
                  {t('students')}
                  {selectedOrder.students && selectedOrder.students.length > 0 && (
                    <span className="ml-2 text-sm font-normal text-gray-500">
                      {t('studentCount', { count: selectedOrder.students.length })}
                    </span>
                  )}
                </h4>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium text-gray-600">{t('fullName')}</th>
                        <th className="text-left px-3 py-2 font-medium text-gray-600">{t('classLabel')}</th>
                        <th className="text-left px-3 py-2 font-medium text-gray-600">{t('section')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedOrder.students && selectedOrder.students.length > 0 ? (
                        selectedOrder.students.map(s => (
                          <tr key={s.id} className="border-t border-gray-100">
                            <td className="px-3 py-2">{s.firstName} {s.lastName}</td>
                            <td className="px-3 py-2 text-gray-600">{selectedOrder.class.name}</td>
                            <td className="px-3 py-2 text-gray-600">{s.section || '-'}</td>
                          </tr>
                        ))
                      ) : (
                        <tr className="border-t border-gray-100">
                          <td className="px-3 py-2">{selectedOrder.studentName}</td>
                          <td className="px-3 py-2 text-gray-600">{selectedOrder.class.name}</td>
                          <td className="px-3 py-2 text-gray-600">-</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4 border-t pt-4">
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">{t('parentInfo')}</h4>
                  <div className="text-sm space-y-1">
                    <p><span className="text-gray-500">{t('fullNameLabel')}</span> {selectedOrder.parentName}</p>
                    <p><span className="text-gray-500">{t('phoneLabel')}</span> {selectedOrder.parentPhone}</p>
                    {selectedOrder.parentEmail && (
                      <p><span className="text-gray-500">{t('emailLabel')}</span> {selectedOrder.parentEmail}</p>
                    )}
                  </div>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">{t('schoolHeading')}</h4>
                  <div className="text-sm space-y-1">
                    <p><span className="text-gray-500">{t('schoolFieldLabel')}</span> {selectedOrder.class.school.name}</p>
                    <p><span className="text-gray-500">{t('classFieldLabel')}</span> {selectedOrder.class.name}</p>
                    {selectedOrder.package && (
                      <p><span className="text-gray-500">{t('packageLabel')}</span> {selectedOrder.package.name}</p>
                    )}
                  </div>
                </div>
              </div>

              {(() => {
                const contentItems = selectedOrder.items && selectedOrder.items.length > 0 ? selectedOrder.items : (selectedOrder.package?.items || [])
                return contentItems.length > 0 ? (
                  <div className="border-t pt-4">
                    <h4 className="font-medium text-gray-900 mb-2">{t('packageContent')}</h4>
                    <div className="text-sm space-y-1">
                      {contentItems.map((item) => (
                        <div key={item.id} className="flex justify-between">
                          <span className="text-gray-700">{item.name} <span className="text-gray-400">x{item.quantity}</span></span>
                          <span className="text-gray-600">{formatPrice(item.price)} TL</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null
              })()}

              <div className="border-t pt-4">
                <h4 className="font-medium text-gray-900 mb-2">{t('deliveryHeading')}</h4>
                <div className="text-sm space-y-1">
                  <p><span className="text-gray-500">{t('typeLabel')}</span> {selectedOrder.deliveryType === "CARGO" ? t('cargo') : t('schoolDelivery')}</p>
                  {selectedOrder.deliveryAddress && (
                    <p><span className="text-gray-500">{t('addressLabel')}</span> {selectedOrder.deliveryAddress}</p>
                  )}
                  {selectedOrder.trackingNo && (
                    <p><span className="text-gray-500">{t('trackingNoLabel')}</span> <span className="font-mono">{selectedOrder.trackingNo}</span></p>
                  )}
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-medium text-gray-900 mb-2">{t('paymentHeading')}</h4>
                <div className="text-sm space-y-1">
                  <p><span className="text-gray-500">{t('amountFieldLabel')}</span> <span className="font-medium">{Number(selectedOrder.totalAmount).toFixed(2)} TL</span></p>
                  {selectedOrder.discountCode && (
                    <p><span className="text-gray-500">{t('discountLabel')}</span> <span className="text-green-600">{selectedOrder.discountCode} (-{Number(selectedOrder.discountAmount).toFixed(2)} TL)</span></p>
                  )}
                  <p><span className="text-gray-500">{t('methodLabel')}</span> {selectedOrder.paymentMethod === "CREDIT_CARD" ? t('creditCard') : selectedOrder.paymentMethod || "-"}</p>
                  <p><span className="text-gray-500">{t('statusLabel')}</span> <Badge className={ORDER_STATUS_COLORS[selectedOrder.status] || ""}>{ts.has(selectedOrder.status) ? ts(selectedOrder.status) : selectedOrder.status}</Badge></p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Etiket Önizleme */}
      <Dialog open={labelPreviewOpen} onOpenChange={(open) => { if (!open) closeLabelPreview() }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('cargoLabelTitle', { orderNumber: labelPreviewOrderNumber })}</DialogTitle>
          </DialogHeader>
          {labelPreviewUrl && (
            <iframe src={labelPreviewUrl} className="w-full border rounded" style={{ height: '500px' }} title={t('label')} />
          )}
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" onClick={closeLabelPreview}>{t('close')}</Button>
            <Button onClick={handleDownloadLabel}>
              <Download className="h-4 w-4 mr-2" />{t('download')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Toplu İşlem Onay Dialog */}
      <AlertDialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{bulkAction ? t(BULK_ACTIONS[bulkAction].labelKey) : ''}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                {bulkResult ? (
                  <div className={`p-3 rounded-lg ${bulkResult.failed > 0 ? 'bg-yellow-50 border border-yellow-200' : 'bg-green-50 border border-green-200'}`}>
                    <p className={bulkResult.failed > 0 ? 'text-yellow-800' : 'text-green-800'}>{bulkResult.message}</p>
                    <div className="mt-2 text-sm">
                      <span className="text-green-600">{t('resultSuccess', { count: bulkResult.success })}</span>
                      {bulkResult.failed > 0 && <span className="text-red-600 ml-3">{t('resultFailed', { count: bulkResult.failed })}</span>}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p>
                      <span className="font-semibold">{bulkAction ? bulkEligibility[bulkAction] : 0}</span> {t('bulkWillProcess')}
                      {bulkAction && selectedOrders.size > bulkEligibility[bulkAction] && (
                        <span className="text-amber-600 block mt-1 text-sm">
                          {t('bulkWillSkip', { count: selectedOrders.size - bulkEligibility[bulkAction] })}
                        </span>
                      )}
                    </p>
                    {bulkAction === 'ship' && (
                      <p className="text-amber-600 bg-amber-50 p-2 rounded text-sm">
                        {t('shipNote')}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            {bulkResult ? (
              <AlertDialogAction onClick={() => setBulkDialogOpen(false)}>{t('ok')}</AlertDialogAction>
            ) : (
              <>
                <AlertDialogCancel disabled={bulkLoading}>{t('cancel')}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleBulkAction}
                  disabled={bulkLoading || (bulkAction !== null && bulkEligibility[bulkAction] === 0)}
                >
                  {bulkLoading ? t('processing') : t('confirm')}
                </AlertDialogAction>
              </>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
