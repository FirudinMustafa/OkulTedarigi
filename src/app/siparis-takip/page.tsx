"use client"

import { useState, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import {
  ArrowLeft,
  ArrowRight,
  MagnifyingGlass,
  Package,
  Truck,
  CheckCircle,
  Clock,
  XCircle,
  WarningCircle,
  CircleNotch,
} from "@phosphor-icons/react"
import { formatDateTime, formatPrice } from "@/lib/utils"

interface CancelRequestData {
  status: "PENDING" | "APPROVED" | "REJECTED"
  adminNote: string | null
  processedAt: string | null
  reason: string | null
}

interface OrderData {
  id: string
  orderNumber: string
  accessToken?: string
  status: string
  parentName: string
  studentName: string
  totalAmount: number
  paymentMethod: string
  schoolName: string
  className: string
  packageName: string
  deliveryType: string
  trackingNo: string | null
  invoiceNo: string | null
  invoicedAt: string | null
  discountCode?: string | null
  discountAmount?: number | null
  createdAt: string
  paidAt: string | null
  shippedAt: string | null
  deliveredAt: string | null
  cancelRequest?: CancelRequestData | null
}

const STATUS_LABELS: Record<string, { label: string; tone: string }> = {
  NEW: { label: "Yeni Sipariş", tone: "bg-sky-100 text-sky-700" },
  PAYMENT_PENDING: { label: "Ödeme Bekliyor", tone: "bg-yellow-100 text-yellow-700" },
  PAID: { label: "Ödeme Alındı", tone: "bg-blue-100 text-blue-700" },
  CONFIRMED: { label: "Onaylandı", tone: "bg-cyan-100 text-cyan-700" },
  INVOICED: { label: "Fatura Kesildi", tone: "bg-indigo-100 text-indigo-700" },
  SHIPPED: { label: "Kargoya Verildi", tone: "bg-purple-100 text-purple-700" },
  DELIVERED: { label: "Teslim Edildi", tone: "bg-green-100 text-green-700" },
  COMPLETED: { label: "Tamamlandı", tone: "bg-green-100 text-green-700" },
  CANCELLED: { label: "İptal Edildi", tone: "bg-red-100 text-red-700" },
  REFUNDED: { label: "İade Edildi", tone: "bg-orange-100 text-orange-700" },
}

export default function SiparisTakipPageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-white">
          <CircleNotch className="h-6 w-6 animate-spin text-apple-gray" />
        </div>
      }
    >
      <SiparisTakipPage />
    </Suspense>
  )
}

function SiparisTakipPage() {
  const searchParams = useSearchParams()
  const [orderNumber, setOrderNumber] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [order, setOrder] = useState<OrderData | null>(null)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState("")
  const [cancelLoading, setCancelLoading] = useState(false)
  const [cancelSuccess, setCancelSuccess] = useState(false)

  useEffect(() => {
    const urlOrderNumber = searchParams.get("orderNumber")
    if (urlOrderNumber) {
      const normalized = urlOrderNumber.toUpperCase()
      setOrderNumber(normalized)
      searchOrder(normalized)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const searchOrder = async (searchNumber: string) => {
    setError("")
    setOrder(null)
    setLoading(true)

    try {
      const res = await fetch(`/api/veli/order?orderNumber=${encodeURIComponent(searchNumber)}`)
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Sipariş bulunamadı")
        return
      }

      setOrder(data)
    } catch {
      setError("Sipariş sorgulanırken hata oluştu")
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!orderNumber.trim()) {
      setError("Sipariş numarası gerekli")
      return
    }
    await searchOrder(orderNumber.trim().toUpperCase())
  }

  const formatDateOrDash = (dateString: string | null) => {
    if (!dateString) return "—"
    return formatDateTime(dateString)
  }

  const statusInfo = order
    ? STATUS_LABELS[order.status] || { label: order.status, tone: "bg-gray-100 text-gray-700" }
    : null

  const handleCancelRequest = async () => {
    if (!order || !cancelReason.trim()) return

    if (!order.accessToken) {
      setError("Erisim anahtari alinamadi. Lutfen siparis numarasini tekrar arayin.")
      return
    }

    setCancelLoading(true)
    try {
      const res = await fetch("/api/veli/cancel-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          accessToken: order.accessToken,
          reason: cancelReason.trim(),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "İptal talebi gönderilemedi")
        return
      }

      setCancelSuccess(true)
      setCancelDialogOpen(false)
      setCancelReason("")
      setOrder({
        ...order,
        cancelRequest: {
          status: "PENDING",
          adminNote: null,
          processedAt: null,
          reason: cancelReason.trim(),
        },
      })
    } catch {
      setError("İptal talebi gönderilirken hata oluştu")
    } finally {
      setCancelLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white overflow-x-clip">
      <TrackHeader />
      <main className="relative min-h-screen flex items-start justify-center pt-36 pb-24 px-6 lg:px-8 bg-apple-bg">
        <div className="w-full max-w-xl flex flex-col items-center">
          {/* 3D Takip ikonu — kutunun üstünde, ortada, büyükçe */}
          <div className="relative w-56 h-56 lg:w-64 lg:h-64 mb-10">
            <Image
              src="/images/takip.png"
              alt="Sipariş Takibi"
              fill
              sizes="256px"
              className="object-contain drop-shadow-[0_30px_60px_rgba(0,0,0,0.18)]"
              priority
            />
          </div>

          {/* Baslik */}
          <div className="text-center mb-10 max-w-md">
            <p className="text-[13px] font-medium text-[#10b981] mb-4 tracking-wide uppercase">
              Sipariş Takibi
            </p>
            <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-apple-ink leading-[1.05]">
              Siparişini <span className="text-gradient-green">sorgula.</span>
            </h1>
            <p className="mt-5 text-[17px] text-apple-gray leading-relaxed">
              Sipariş numaranı gir, durumunu ve teslimat detaylarını anında gör.
            </p>
          </div>

          {/* Arama kutusu — çerçevesiz, sadece bg + yumuşak gölge */}
          <form
            onSubmit={handleSearch}
            className="w-full max-w-md bg-white rounded-[28px] shadow-[0_24px_60px_-24px_rgba(0,0,0,0.18)] p-8 space-y-4"
          >
            <div>
              <label htmlFor="orderNumber" className="block text-[13px] font-medium text-apple-ink mb-2">
                Sipariş Numarası
              </label>
              <input
                id="orderNumber"
                type="text"
                placeholder="Örn: ORD-2026-A8K3M9P2"
                value={orderNumber}
                onChange={(e) => {
                  setOrderNumber(e.target.value.toUpperCase())
                  setError("")
                }}
                disabled={loading}
                className="w-full h-14 px-5 text-[15px] bg-white border border-apple-border rounded-2xl transition-all outline-none font-mono tracking-wider placeholder:text-apple-gray/60 placeholder:font-sans placeholder:tracking-normal focus:border-apple-ink disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-600">
                <WarningCircle weight="fill" className="w-4 h-4 flex-shrink-0" />
                <span className="text-[13px] font-medium">{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !orderNumber.trim()}
              className="w-full h-14 rounded-2xl bg-[#10b981] hover:bg-[#059669] text-white text-[15px] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <CircleNotch weight="bold" className="w-5 h-5 animate-spin" />
                  Sorgulanıyor…
                </>
              ) : (
                <>
                  <MagnifyingGlass weight="bold" className="w-4 h-4" />
                  Sorgula
                </>
              )}
            </button>
          </form>

          {/* Siparis detayi */}
          {order && statusInfo && (
            <div className="w-full mt-6 bg-white rounded-[28px] border border-apple-border/60 shadow-[0_12px_32px_-20px_rgba(0,0,0,0.15)] p-8 animate-fade-in">
              <div className="flex items-start justify-between gap-4 mb-8">
                <div>
                  <p className="text-[12px] text-apple-gray uppercase tracking-wide">Sipariş No</p>
                  <p className="text-xl font-semibold text-apple-ink font-mono tracking-tight mt-1">
                    {order.orderNumber}
                  </p>
                </div>
                <span className={`inline-flex items-center px-3 h-7 rounded-full text-[12px] font-medium ${statusInfo.tone}`}>
                  {statusInfo.label}
                </span>
              </div>

              {/* Durum zaman cizgisi */}
              <div className="relative pl-6 mb-8">
                <div className="absolute left-[7px] top-2 bottom-2 w-px bg-apple-border" />
                <TimelineItem
                  active={!!order.createdAt}
                  icon={<CheckCircle weight="fill" className="w-4 h-4" />}
                  title="Sipariş Oluşturuldu"
                  date={formatDateOrDash(order.createdAt)}
                />
                <TimelineItem
                  active={!!order.paidAt}
                  icon={<CheckCircle weight="fill" className="w-4 h-4" />}
                  title="Ödeme Alındı"
                  date={formatDateOrDash(order.paidAt)}
                />
                <TimelineItem
                  active={!!order.invoicedAt}
                  icon={<CheckCircle weight="fill" className="w-4 h-4" />}
                  title="Fatura Kesildi"
                  date={formatDateOrDash(order.invoicedAt)}
                  extra={
                    order.invoiceNo ? (
                      <p className="text-[12px] text-apple-gray mt-1">
                        Fatura No: <span className="font-mono font-medium text-apple-ink">{order.invoiceNo}</span>
                      </p>
                    ) : null
                  }
                />
                {order.deliveryType === "CARGO" ? (
                  <>
                    <TimelineItem
                      active={!!order.shippedAt}
                      icon={<Truck weight="fill" className="w-4 h-4" />}
                      title="Kargoya Verildi"
                      date={formatDateOrDash(order.shippedAt)}
                      extra={
                        order.trackingNo ? (
                          <p className="text-[12px] text-apple-gray mt-1">
                            Takip No: <span className="font-mono font-medium text-apple-ink">{order.trackingNo}</span>
                          </p>
                        ) : null
                      }
                    />
                    <TimelineItem
                      active={!!order.deliveredAt}
                      icon={<Package weight="fill" className="w-4 h-4" />}
                      title="Teslim Edildi"
                      date={formatDateOrDash(order.deliveredAt)}
                      last
                    />
                  </>
                ) : (
                  <TimelineItem
                    active={!!order.deliveredAt}
                    icon={<Package weight="fill" className="w-4 h-4" />}
                    title="Okula Teslim Edildi"
                    date={formatDateOrDash(order.deliveredAt)}
                    last
                  />
                )}
              </div>

              <div className="pt-6 border-t border-apple-border/60 grid sm:grid-cols-2 gap-5 text-[14px]">
                <DetailRow label="Veli" value={order.parentName} />
                <DetailRow label="Öğrenci" value={order.studentName} />
                <DetailRow label="Okul / Sınıf" value={`${order.schoolName} · ${order.className}`} />
                <DetailRow label="Paket" value={order.packageName} />
                <DetailRow
                  label="Ödeme Yöntemi"
                  value={order.paymentMethod === "CREDIT_CARD" ? "Kredi Kartı" : order.paymentMethod || "—"}
                />
                {order.invoiceNo && (
                  <DetailRow label="Fatura No" value={order.invoiceNo} mono />
                )}
                <div>
                  <p className="text-apple-gray text-[12px] uppercase tracking-wide mb-1">Toplam Tutar</p>
                  <p className="font-semibold text-[#10b981]">{formatPrice(order.totalAmount)} ₺</p>
                  {order.discountCode && order.discountAmount && (
                    <p className="text-[12px] text-apple-gray mt-0.5">
                      İndirim: −{formatPrice(order.discountAmount)} ₺ ({order.discountCode})
                    </p>
                  )}
                </div>
              </div>

              {/* Iptal talebi durumu */}
              {order.cancelRequest && (
                <div className="mt-6">
                  {order.cancelRequest.status === "PENDING" && (
                    <InfoBox
                      tone="yellow"
                      icon={<Clock weight="fill" className="w-5 h-5 text-yellow-600" />}
                      title="İptal Talebiniz İnceleniyor"
                      body="Talebiniz admin tarafından değerlendiriliyor. Sonuç hakkında bilgilendirileceksiniz."
                    />
                  )}
                  {order.cancelRequest.status === "REJECTED" && (
                    <InfoBox
                      tone="red"
                      icon={<XCircle weight="fill" className="w-5 h-5 text-red-600" />}
                      title="İptal Talebiniz Reddedildi"
                      body={
                        <>
                          {order.cancelRequest.adminNote && (
                            <p className="text-[13px] text-red-700 mt-1">
                              <span className="font-medium">Gerekçe:</span> {order.cancelRequest.adminNote}
                            </p>
                          )}
                          {order.cancelRequest.processedAt && (
                            <p className="text-[12px] text-red-500 mt-1">
                              {formatDateTime(order.cancelRequest.processedAt)}
                            </p>
                          )}
                          <p className="text-[13px] text-red-600 mt-2">
                            İsterseniz yeni bir iptal talebi oluşturabilirsiniz.
                          </p>
                        </>
                      }
                    />
                  )}
                  {order.cancelRequest.status === "APPROVED" && (
                    <InfoBox
                      tone="green"
                      icon={<CheckCircle weight="fill" className="w-5 h-5 text-green-600" />}
                      title="İptal Talebiniz Onaylandı"
                      body={
                        <>
                          <p className="text-[13px] text-green-700 mt-1">
                            Siparişiniz iptal edilmiştir. İade işlemi başlatılmıştır.
                          </p>
                          {order.cancelRequest.processedAt && (
                            <p className="text-[12px] text-green-500 mt-1">
                              {formatDateTime(order.cancelRequest.processedAt)}
                            </p>
                          )}
                        </>
                      }
                    />
                  )}
                </div>
              )}

              <div className="mt-8 flex items-center justify-between gap-3">
                <button
                  onClick={() => setOrder(null)}
                  className="text-[13px] font-medium text-apple-gray hover:text-apple-ink transition-colors"
                >
                  Yeni sorgulama
                </button>
                {["NEW", "PAYMENT_PENDING", "PAID", "CONFIRMED"].includes(order.status) &&
                  (!order.cancelRequest || order.cancelRequest.status === "REJECTED") &&
                  !cancelSuccess && (
                    <button
                      onClick={() => setCancelDialogOpen(true)}
                      className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full border border-red-200 text-red-600 hover:bg-red-50 text-[13px] font-medium transition-colors"
                    >
                      {order.cancelRequest?.status === "REJECTED" ? "Tekrar iptal talebi" : "İptal talebi"}
                    </button>
                  )}
              </div>
            </div>
          )}
        </div>

        {/* Iptal talebi modal */}
        {cancelDialogOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm overflow-y-auto">
            <div className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-white rounded-[28px] border border-apple-border/60 shadow-2xl p-8">
              <h3 className="text-xl font-semibold text-apple-ink tracking-tight">Sipariş İptal Talebi</h3>
              <p className="mt-2 text-[14px] text-apple-gray">
                İptal talebiniz admin tarafından incelenecektir.
              </p>
              <p className="mt-4 text-[13px] text-apple-gray">
                Sipariş No: <span className="font-mono font-medium text-apple-ink">{order?.orderNumber}</span>
              </p>
              <textarea
                placeholder="İptal nedeninizi yazın…"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={4}
                className="mt-4 w-full px-4 py-3 text-[14px] bg-white border border-apple-border rounded-2xl outline-none focus:border-apple-ink resize-none"
              />
              <div className="mt-6 flex items-center justify-end gap-2">
                <button
                  onClick={() => setCancelDialogOpen(false)}
                  disabled={cancelLoading}
                  className="h-10 px-4 rounded-full border border-apple-border text-apple-ink text-[13px] font-medium hover:border-apple-ink transition-colors disabled:opacity-50"
                >
                  Vazgeç
                </button>
                <button
                  onClick={handleCancelRequest}
                  disabled={cancelLoading || !cancelReason.trim()}
                  className="h-10 px-5 rounded-full bg-red-600 hover:bg-red-700 text-white text-[13px] font-medium transition-colors disabled:opacity-50 inline-flex items-center gap-2"
                >
                  {cancelLoading && <CircleNotch weight="bold" className="w-4 h-4 animate-spin" />}
                  İptal talebi gönder
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

// ==================== TRACK HEADER ====================
function TrackHeader() {
  const navLinks = [
    { label: "Nasıl Çalışır", href: "/#nasil-calisir" },
    { label: "Referanslar", href: "/#referanslar" },
    { label: "S.S.S", href: "/#sss" },
    { label: "Sipariş Takibi", href: "/siparis-takip" },
  ]

  return (
    <header className="fixed top-0 left-0 right-0 z-50 pointer-events-none">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <div className="flex items-center justify-between gap-3">
          <div className="pointer-events-auto flex items-center gap-6 lg:gap-8 h-12 pl-5 pr-6 rounded-full backdrop-blur-xl shadow-[0_8px_24px_-12px_rgba(0,0,0,0.12)]">
            <Link href="/" className="flex items-center gap-2 shrink-0" aria-label="okultedarigim.com ana sayfa">
              <span className="text-[15px] font-semibold tracking-tight text-apple-ink">
                okultedarigim
                <span className="text-apple-blue">.com</span>
              </span>
            </Link>
            <nav className="hidden lg:flex items-center gap-7">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-[13px] font-normal text-apple-ink/80 hover:text-apple-ink transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="pointer-events-auto flex items-center h-12 pl-1.5 pr-1.5 rounded-full backdrop-blur-xl shadow-[0_8px_24px_-12px_rgba(0,0,0,0.12)]">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full text-apple-ink/80 hover:text-apple-ink text-[13px] font-medium transition-colors"
            >
              <ArrowLeft weight="regular" className="w-4 h-4" />
              Ana Sayfaya Dön
            </Link>
          </div>
        </div>
      </div>
    </header>
  )
}

// ==================== TIMELINE ITEM ====================
function TimelineItem({
  active,
  icon,
  title,
  date,
  extra,
  last,
}: {
  active: boolean
  icon: React.ReactNode
  title: string
  date: string
  extra?: React.ReactNode
  last?: boolean
}) {
  return (
    <div className={`relative ${last ? "" : "pb-5"}`}>
      <div
        className={`absolute -left-6 top-0 w-4 h-4 rounded-full flex items-center justify-center ${
          active ? "bg-[#10b981] text-white" : "bg-apple-border text-white"
        }`}
      >
        {icon}
      </div>
      <p className={`text-[14px] font-medium ${active ? "text-apple-ink" : "text-apple-gray"}`}>{title}</p>
      <p className="text-[12px] text-apple-gray mt-0.5">{date}</p>
      {extra}
    </div>
  )
}

// ==================== DETAIL ROW ====================
function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-apple-gray text-[12px] uppercase tracking-wide mb-1">{label}</p>
      <p className={`font-medium text-apple-ink ${mono ? "font-mono tracking-tight" : ""}`}>{value}</p>
    </div>
  )
}

// ==================== INFO BOX ====================
function InfoBox({
  tone,
  icon,
  title,
  body,
}: {
  tone: "yellow" | "red" | "green"
  icon: React.ReactNode
  title: string
  body: React.ReactNode
}) {
  const toneClasses = {
    yellow: "bg-yellow-50 border-yellow-200 text-yellow-800",
    red: "bg-red-50 border-red-200 text-red-800",
    green: "bg-green-50 border-green-200 text-green-800",
  }[tone]

  return (
    <div className={`border rounded-2xl p-4 ${toneClasses}`}>
      <div className="flex items-start gap-3">
        {icon}
        <div className="flex-1">
          <p className="font-medium text-[14px]">{title}</p>
          {typeof body === "string" ? <p className="text-[13px] mt-1 opacity-80">{body}</p> : body}
        </div>
      </div>
    </div>
  )
}
