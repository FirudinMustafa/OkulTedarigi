"use client"

import { useState, useEffect } from "react"
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
  Search, ShoppingCart, Eye, FileText, Truck, X, Clock,
  CheckCircle, CheckCheck, RefreshCw, Loader2, Printer, Download
} from "lucide-react"
import { formatDateTime } from "@/lib/utils"
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from "@/lib/constants"
import {
  previewShippingLabel, previewBulkLabels,
  downloadShippingLabel, downloadBulkLabels,
  type LabelOrder
} from "@/lib/shipping-label"

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
  package: { name: string } | null
}

const statusLabels = ORDER_STATUS_LABELS
const statusColors = ORDER_STATUS_COLORS

export default function SiparislerPage() {
  const [orders, setOrders] = useState<OrderType[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterStatus, setFilterStatus] = useState("")
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<OrderType | null>(null)

  // Toplu islem
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set())
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false)
  const [bulkAction, setBulkAction] = useState<string | null>(null)
  const [bulkLoading, setBulkLoading] = useState(false)
  const [bulkResult, setBulkResult] = useState<{ message: string; success: number; failed: number } | null>(null)

  const [processingId, setProcessingId] = useState<string | null>(null)
  const [syncLoading, setSyncLoading] = useState(false)
  const [statusUpdateLoading, setStatusUpdateLoading] = useState<string | null>(null)

  // Etiket onizleme
  const [labelPreviewUrl, setLabelPreviewUrl] = useState<string | null>(null)
  const [labelPreviewOpen, setLabelPreviewOpen] = useState(false)
  const [labelLoading, setLabelLoading] = useState(false)
  const [labelPreviewOrderNumber, setLabelPreviewOrderNumber] = useState<string>("")

  useEffect(() => { fetchOrders() }, [])

  const fetchOrders = async () => {
    try {
      const res = await fetch("/api/admin/orders", { credentials: 'include' })
      const data = await res.json()
      setOrders(data.orders || [])
    } catch (error) {
      console.error("Siparisler yuklenemedi:", error)
    } finally {
      setLoading(false)
    }
  }

  // --- TEKIL ISLEMLER ---

  const prepareOrder = async (orderId: string) => {
    setProcessingId(orderId)
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/invoice`, {
        method: "POST", credentials: 'include'
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error || "Fatura olusturulamadi")
      } else {
        alert(`✓ Fatura basariyla kesildi\n\nFatura No: ${data.invoiceNo || '(yok)'}`)
      }
      fetchOrders()
    } finally { setProcessingId(null) }
  }

  const cancelInvoice = async (orderId: string) => {
    if (!confirm('Bu siparisin faturasini iptal etmek istediginize emin misiniz?')) return
    setProcessingId(orderId)
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/invoice-cancel`, {
        method: "POST", credentials: 'include'
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error || "Fatura iptal edilemedi")
      } else {
        alert("Fatura basariyla iptal edildi")
      }
      fetchOrders()
    } finally { setProcessingId(null) }
  }

  const createShipment = async (orderId: string) => {
    setProcessingId(orderId)
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/shipment`, {
        method: "POST", credentials: 'include'
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error || "Kargo olusturulamadi")
      } else {
        const msg = data.autoInvoiced
          ? `✓ Kargo olusturuldu\n\nFatura No: ${data.invoiceNo}\nTakip No: ${data.trackingNo}`
          : `✓ Kargo olusturuldu\n\nTakip No: ${data.trackingNo}`
        alert(msg)
      }
      fetchOrders()
    } finally { setProcessingId(null) }
  }

  const markDelivered = async (orderId: string) => {
    setProcessingId(orderId)
    try {
      const res = await fetch('/api/admin/deliveries/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ orderIds: [orderId], action: 'DELIVERED' })
      })
      const data = await res.json()
      if (!res.ok || (data.summary?.success ?? 0) === 0) {
        alert(data.results?.[0]?.error || data.error || 'Teslim isaretlenemedi')
      } else {
        alert('✓ Siparis teslim edildi olarak isaretlendi')
      }
      fetchOrders()
    } finally { setProcessingId(null) }
  }

  const markCompleted = async (orderId: string) => {
    setProcessingId(orderId)
    try {
      const res = await fetch('/api/admin/deliveries/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ orderIds: [orderId], action: 'COMPLETED' })
      })
      const data = await res.json()
      if (!res.ok || (data.summary?.success ?? 0) === 0) {
        alert(data.results?.[0]?.error || data.error || 'Tamamlanamadi')
      } else {
        alert('✓ Siparis tamamlandi')
      }
      fetchOrders()
    } finally { setProcessingId(null) }
  }

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    setStatusUpdateLoading(orderId)
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus })
      })
      if (!res.ok) {
        const data = await res.json()
        alert(data.error || 'Durum guncellenemedi')
      }
      fetchOrders()
    } finally { setStatusUpdateLoading(null) }
  }

  // --- TOPLU ISLEMLER ---

  const handleBulkAction = async () => {
    if (!bulkAction) return
    setBulkLoading(true)
    setBulkResult(null)
    const ids = Array.from(selectedOrders)

    try {
      let res: Response

      if (bulkAction === 'invoice') {
        res = await fetch('/api/admin/orders/batch/invoices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ orderIds: ids })
        })
        const data = await res.json()
        setBulkResult({ message: data.message || 'Tamamlandi', success: data.summary?.success || 0, failed: data.summary?.failed || 0 })
      } else if (bulkAction === 'shipment') {
        res = await fetch('/api/admin/orders/batch/shipments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ orderIds: ids })
        })
        const data = await res.json()
        setBulkResult({ message: data.message || 'Tamamlandi', success: data.summary?.success || 0, failed: data.summary?.failed || 0 })
      } else if (bulkAction === 'deliver') {
        res = await fetch('/api/admin/deliveries/batch', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
          body: JSON.stringify({ orderIds: ids, action: 'DELIVERED' })
        })
        const data = await res.json()
        setBulkResult({ message: data.message || 'Tamamlandi', success: data.summary?.success || 0, failed: data.summary?.failed || 0 })
      } else if (bulkAction === 'complete') {
        res = await fetch('/api/admin/deliveries/batch', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
          body: JSON.stringify({ orderIds: ids, action: 'COMPLETED' })
        })
        const data = await res.json()
        setBulkResult({ message: data.message || 'Tamamlandi', success: data.summary?.success || 0, failed: data.summary?.failed || 0 })
      }

      fetchOrders()
      setSelectedOrders(new Set())
    } catch (error) {
      console.error("Toplu islem hatasi:", error)
      setBulkResult({ message: 'Bir hata olustu', success: 0, failed: ids.length })
    } finally {
      setBulkLoading(false)
    }
  }

  // Kargo senkronizasyonu
  const handleSyncCargo = async () => {
    setSyncLoading(true)
    try {
      const res = await fetch('/api/admin/deliveries/sync-cargo', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify({})
      })
      const data = await res.json()
      if (data.success) {
        alert(`${data.summary.total} kargo sorgulandı, ${data.summary.updated} güncellendi`)
        fetchOrders()
      }
    } catch (error) { console.error('Kargo sync hatasi:', error) }
    finally { setSyncLoading(false) }
  }

  // Etiket onizleme/indirme
  const toLabelOrder = (order: OrderType): LabelOrder => ({
    orderNumber: order.orderNumber,
    parentName: order.parentName,
    phone: order.parentPhone,
    deliveryAddress: order.deliveryAddress,
    trackingNo: order.trackingNo || '',
    totalAmount: order.totalAmount,
    shippedAt: order.shippedAt,
    class: order.class,
    package: order.package || undefined
  })

  const openLabelPreview = async (order: OrderType) => {
    if (!order.trackingNo) {
      alert('Bu sipari\u015fte takip numaras\u0131 yok')
      return
    }
    setLabelLoading(true)
    setLabelPreviewOrderNumber(order.orderNumber)
    try {
      const url = await previewShippingLabel(toLabelOrder(order))
      setLabelPreviewUrl(url)
      setLabelPreviewOpen(true)
    } catch (e) {
      console.error('Etiket olusturulamadi:', e)
      alert('Etiket olu\u015fturulamad\u0131')
    } finally {
      setLabelLoading(false)
    }
  }

  const openBulkLabelPreview = async () => {
    const labelOrders = filteredOrders
      .filter(o => selectedOrders.has(o.id) && o.trackingNo)
      .map(toLabelOrder)
    if (labelOrders.length === 0) {
      alert('Se\u00e7ilen sipari\u015flerde takip numaras\u0131 bulunamad\u0131')
      return
    }
    setLabelLoading(true)
    setLabelPreviewOrderNumber(`${labelOrders.length} adet`)
    try {
      const url = await previewBulkLabels(labelOrders)
      setLabelPreviewUrl(url)
      setLabelPreviewOpen(true)
    } catch (e) {
      console.error('Toplu etiket olusturulamadi:', e)
      alert('Toplu etiket olu\u015fturulamad\u0131')
    } finally {
      setLabelLoading(false)
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

  const filteredOrders = orders.filter(o => {
    const matchesSearch =
      o.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.parentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.class.school.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (o.trackingNo?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false)
    const matchesStatus = !filterStatus || o.status === filterStatus
    return matchesSearch && matchesStatus
  })

  const bulkLabels: Record<string, string> = {
    invoice: 'Toplu Hazirla',
    shipment: 'Toplu Kargo',
    deliver: 'Toplu Teslim',
    complete: 'Toplu Tamamla'
  }

  // Siparisin durumuna gore gosterilecek butonlar
  const renderActions = (order: OrderType) => {
    const isProcessing = processingId === order.id
    const isCargo = order.deliveryType === "CARGO"

    if (isProcessing) {
      return <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
    }

    switch (order.status) {
      case "NEW":
        return (
          <div className="flex gap-1">
            <Button size="sm" className="text-xs h-7 bg-yellow-600 hover:bg-yellow-700 text-white"
              onClick={() => updateOrderStatus(order.id, 'PAYMENT_PENDING')}
              disabled={statusUpdateLoading === order.id}
            >
              {statusUpdateLoading === order.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Clock className="h-3 w-3 mr-1" />}
              Odeme Bekle
            </Button>
            <Button size="sm" className="text-xs h-7 bg-green-600 hover:bg-green-700 text-white"
              onClick={() => updateOrderStatus(order.id, 'PAID')}
              disabled={statusUpdateLoading === order.id}
            >
              {statusUpdateLoading === order.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <CheckCircle className="h-3 w-3 mr-1" />}
              Odendi
            </Button>
          </div>
        )
      case "PAYMENT_PENDING":
        return (
          <div className="flex gap-1">
            <Button size="sm" className="text-xs h-7 bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => updateOrderStatus(order.id, 'PAID')}
              disabled={statusUpdateLoading === order.id}
            >
              {statusUpdateLoading === order.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <CheckCircle className="h-3 w-3 mr-1" />}
              Odendi Isaretle
            </Button>
          </div>
        )
      case "PAID":
        return (
          <div className="flex gap-1">
            <Button size="sm" className="text-xs h-7 bg-cyan-600 hover:bg-cyan-700 text-white"
              onClick={() => updateOrderStatus(order.id, 'CONFIRMED')}
              disabled={statusUpdateLoading === order.id}
            >
              {statusUpdateLoading === order.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <CheckCircle className="h-3 w-3 mr-1" />}
              Onayla
            </Button>
          </div>
        )
      case "CONFIRMED":
        return (
          <div className="flex gap-1">
            <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => prepareOrder(order.id)}>
              <FileText className="h-3 w-3 mr-1" />Fatura Kes
            </Button>
          </div>
        )
      case "INVOICED":
        return (
          <div className="flex gap-1">
            <Button size="sm" variant="outline" className="text-xs h-7 text-red-600 border-red-200 hover:bg-red-50" onClick={() => cancelInvoice(order.id)}>
              <X className="h-3 w-3 mr-1" />Fatura Iptal
            </Button>
            {isCargo ? (
              <Button size="sm" className="text-xs h-7 bg-orange-500 hover:bg-orange-600 text-white" onClick={() => createShipment(order.id)}>
                <Truck className="h-3 w-3 mr-1" />Kargola
              </Button>
            ) : (
              <Button size="sm" className="text-xs h-7 bg-teal-500 hover:bg-teal-600 text-white" onClick={() => markDelivered(order.id)}>
                <CheckCircle className="h-3 w-3 mr-1" />Teslim Et
              </Button>
            )}
          </div>
        )
      case "PREPARING":
        return isCargo ? (
          <Button size="sm" className="text-xs h-7 bg-orange-500 hover:bg-orange-600 text-white" onClick={() => createShipment(order.id)}>
            <Truck className="h-3 w-3 mr-1" />Kargola
          </Button>
        ) : (
          <Button size="sm" className="text-xs h-7 bg-teal-500 hover:bg-teal-600 text-white" onClick={() => markDelivered(order.id)}>
            <CheckCircle className="h-3 w-3 mr-1" />Teslim Et
          </Button>
        )
      case "SHIPPED":
        return (
          <div className="flex gap-1">
            <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => openLabelPreview(order)} disabled={labelLoading} title="Kargo Etiketi">
              {labelLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Printer className="h-3 w-3" />}
            </Button>
            <Button size="sm" className="text-xs h-7 bg-teal-500 hover:bg-teal-600 text-white" onClick={() => markDelivered(order.id)}>
              <CheckCircle className="h-3 w-3 mr-1" />Teslim Edildi
            </Button>
          </div>
        )
      case "DELIVERED":
        return (
          <div className="flex gap-1">
            <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => openLabelPreview(order)} disabled={labelLoading} title="Kargo Etiketi">
              {labelLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Printer className="h-3 w-3" />}
            </Button>
            <Button size="sm" className="text-xs h-7 bg-green-500 hover:bg-green-600 text-white" onClick={() => markCompleted(order.id)}>
              <CheckCheck className="h-3 w-3 mr-1" />Tamamla
            </Button>
          </div>
        )
      default:
        return null
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Siparisler</h1>
          <p className="text-gray-500">Siparis yonetimi ve takibi</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => window.open('/api/admin/students/export', '_blank')}
          >
            <Download className="h-4 w-4 mr-2" />
            Ogrenci Listesi
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              const params = new URLSearchParams()
              if (filterStatus) params.set('status', filterStatus)
              window.open(`/api/admin/orders/export?${params.toString()}`, '_blank')
            }}
          >
            <Download className="h-4 w-4 mr-2" />
            Siparis Listesi
          </Button>
          <Button variant="outline" onClick={handleSyncCargo} disabled={syncLoading}>
            {syncLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Kargo Durumlarini Sorgula
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Siparis no, ogrenci, veli, okul veya takip no ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterStatus || "__all__"} onValueChange={(val) => setFilterStatus(val === "__all__" ? "" : val)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Tum durumlar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Tum durumlar</SelectItem>
                {Object.entries(statusLabels).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Toplu Islem Cubugu */}
          {selectedOrders.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <span className="text-sm font-medium text-blue-800">
                {selectedOrders.size} siparis secildi
              </span>
              <div className="flex-1" />
              {(['invoice', 'shipment', 'deliver', 'complete'] as const).map((action) => (
                <Button
                  key={action}
                  size="sm"
                  variant="outline"
                  className="text-xs"
                  onClick={() => { setBulkAction(action); setBulkDialogOpen(true); setBulkResult(null) }}
                  disabled={bulkLoading}
                >
                  {action === 'invoice' && <FileText className="h-3 w-3 mr-1" />}
                  {action === 'shipment' && <Truck className="h-3 w-3 mr-1" />}
                  {action === 'deliver' && <CheckCircle className="h-3 w-3 mr-1" />}
                  {action === 'complete' && <CheckCheck className="h-3 w-3 mr-1" />}
                  {bulkLabels[action]}
                </Button>
              ))}
              <Button
                size="sm"
                variant="outline"
                className="text-xs"
                onClick={openBulkLabelPreview}
                disabled={labelLoading}
              >
                {labelLoading ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Printer className="h-3 w-3 mr-1" />}
                Toplu Etiket
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelectedOrders(new Set())} className="text-gray-500">
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-gray-500">Yukleniyor...</div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <ShoppingCart className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              {orders.length === 0 ? (
                <>
                  <p className="text-base font-medium text-gray-700">Henuz hic siparis yok</p>
                  <p className="text-sm mt-1">Yeni veli siparisleri burada gorunecek</p>
                </>
              ) : (
                <>
                  <p className="text-base font-medium text-gray-700">Filtre sonucuna uyan siparis bulunamadi</p>
                  <p className="text-sm mt-1">Arama veya filtreleri temizleyip tekrar deneyin</p>
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
                  <TableHead>Siparis No</TableHead>
                  <TableHead>Ogrenci</TableHead>
                  <TableHead>Okul / Sinif</TableHead>
                  <TableHead>Tutar</TableHead>
                  <TableHead>Teslimat</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead>Tarih</TableHead>
                  <TableHead>Islemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.map((order) => (
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
                        <p className="font-medium">{order.studentName}</p>
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
                        <span className="text-sm">{order.deliveryType === "CARGO" ? "Kargo" : "Okula Teslim"}</span>
                        {order.trackingNo && (
                          <p className="text-xs text-orange-600 font-mono mt-0.5">{order.trackingNo}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <Badge className={statusColors[order.status] || ""}>
                          {statusLabels[order.status] || order.status}
                        </Badge>
                        {order.invoiceNo && (
                          <p className="text-[10px] text-indigo-600 font-mono mt-1">
                            #{order.invoiceNo}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">{formatDateTime(order.createdAt)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7"
                          onClick={() => { setSelectedOrder(order); setDetailDialogOpen(true) }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {renderActions(order)}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Siparis Detay Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Siparis Detayi - {selectedOrder?.orderNumber}</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                  <h4 className="font-medium text-gray-900">Ogrenci Bilgileri</h4>
                  <div className="text-sm space-y-1">
                    <p><span className="text-gray-500">Ogrenci:</span> {selectedOrder.studentName}</p>
                    <p><span className="text-gray-500">Okul:</span> {selectedOrder.class.school.name}</p>
                    <p><span className="text-gray-500">Sinif:</span> {selectedOrder.class.name}</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <h4 className="font-medium text-gray-900">Veli Bilgileri</h4>
                  <div className="text-sm space-y-1">
                    <p><span className="text-gray-500">Ad Soyad:</span> {selectedOrder.parentName}</p>
                    <p><span className="text-gray-500">Telefon:</span> {selectedOrder.parentPhone}</p>
                    {selectedOrder.parentEmail && (
                      <p><span className="text-gray-500">E-posta:</span> {selectedOrder.parentEmail}</p>
                    )}
                  </div>
                </div>
              </div>
              <div className="border-t pt-4">
                <h4 className="font-medium text-gray-900 mb-3">Teslimat Bilgileri</h4>
                <div className="text-sm space-y-1">
                  <p><span className="text-gray-500">Teslimat Tipi:</span> {selectedOrder.deliveryType === "CARGO" ? "Kargo" : "Okula Teslim"}</p>
                  {selectedOrder.deliveryAddress && (
                    <p><span className="text-gray-500">Adres:</span> {selectedOrder.deliveryAddress}</p>
                  )}
                  {selectedOrder.trackingNo && (
                    <p><span className="text-gray-500">Takip No:</span> <span className="font-mono">{selectedOrder.trackingNo}</span></p>
                  )}
                </div>
              </div>
              <div className="border-t pt-4">
                <h4 className="font-medium text-gray-900 mb-3">Odeme Bilgileri</h4>
                <div className="text-sm space-y-1">
                  <p><span className="text-gray-500">Tutar:</span> <span className="font-medium">{Number(selectedOrder.totalAmount).toFixed(2)} TL</span></p>
                  {selectedOrder.discountCode && (
                    <p><span className="text-gray-500">Indirim:</span> <span className="text-green-600">{selectedOrder.discountCode} (-{Number(selectedOrder.discountAmount).toFixed(2)} TL)</span></p>
                  )}
                  <p><span className="text-gray-500">Odeme:</span> {selectedOrder.paymentMethod === "CREDIT_CARD" ? "Kredi Karti" : selectedOrder.paymentMethod || "-"}</p>
                  <p><span className="text-gray-500">Durum:</span> <Badge className={statusColors[selectedOrder.status] || ""}>{statusLabels[selectedOrder.status] || selectedOrder.status}</Badge></p>
                  {selectedOrder.invoiceNo && (
                    <p><span className="text-gray-500">Fatura No:</span> <span className="font-mono">{selectedOrder.invoiceNo}</span></p>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Etiket Onizleme Dialog */}
      <Dialog open={labelPreviewOpen} onOpenChange={(open) => { if (!open) closeLabelPreview() }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Kargo Etiketi - {labelPreviewOrderNumber}</DialogTitle>
          </DialogHeader>
          {labelPreviewUrl && (
            <iframe
              src={labelPreviewUrl}
              className="w-full border rounded"
              style={{ height: '500px' }}
              title="Etiket Onizleme"
            />
          )}
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" onClick={closeLabelPreview}>Kapat</Button>
            <Button onClick={handleDownloadLabel}>
              <Download className="h-4 w-4 mr-2" />
              İndir
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Toplu Islem Dialog */}
      <AlertDialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{bulkAction ? bulkLabels[bulkAction] : ''}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                {bulkResult ? (
                  <div className={`p-3 rounded-lg ${bulkResult.failed > 0 ? 'bg-yellow-50 border border-yellow-200' : 'bg-green-50 border border-green-200'}`}>
                    <p className={bulkResult.failed > 0 ? 'text-yellow-800' : 'text-green-800'}>{bulkResult.message}</p>
                    <div className="mt-2 text-sm">
                      <span className="text-green-600">Basarili: {bulkResult.success}</span>
                      {bulkResult.failed > 0 && <span className="text-red-600 ml-3">Hatali: {bulkResult.failed}</span>}
                    </div>
                  </div>
                ) : (
                  <div>
                    <p><span className="font-semibold">{selectedOrders.size}</span> siparis icin islem yapilacak.</p>
                    {bulkAction === 'shipment' && (
                      <p className="text-amber-600 bg-amber-50 p-2 rounded text-sm mt-2">
                        Not: Faturalanmamis siparisler icin otomatik fatura kesilecektir.
                      </p>
                    )}
                    <p className="text-gray-500 text-sm mt-2">
                      Uygun olmayan durumdaki siparisler atlanacaktir.
                    </p>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            {bulkResult ? (
              <AlertDialogAction onClick={() => setBulkDialogOpen(false)}>Tamam</AlertDialogAction>
            ) : (
              <>
                <AlertDialogCancel disabled={bulkLoading}>Iptal</AlertDialogCancel>
                <AlertDialogAction onClick={handleBulkAction} disabled={bulkLoading}>
                  {bulkLoading ? 'Isleniyor...' : 'Onayla'}
                </AlertDialogAction>
              </>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
