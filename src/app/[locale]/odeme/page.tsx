"use client"

import { useState, useEffect } from "react"
import { useTranslations, useLocale } from "next-intl"
import { Link, useRouter } from "@/i18n/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { CreditCard, Lock, Loader2, CheckCircle } from "lucide-react"
import { CHECKOUT_DRAFT_KEY } from "@/lib/constants"

// Checkout draft — /paket/[id] formunda sessionStorage'a yazilir.
interface CheckoutDraft {
  payload: Record<string, unknown> & { classId: string }
  summary: {
    totalAmount: number
    studentName: string
    studentCount: number
    packageName: string
    discountCode: string | null
    discountAmount: number | null
  }
}

export default function OdemePage() {
  const t = useTranslations('payment')
  const locale = useLocale()
  const router = useRouter()

  const [draft, setDraft] = useState<CheckoutDraft | null>(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [orderNumber, setOrderNumber] = useState("")

  const [cardNumber, setCardNumber] = useState("")
  const [cardHolder, setCardHolder] = useState("")
  const [expiry, setExpiry] = useState("")
  const [cvv, setCvv] = useState("")
  const [duplicateTab, setDuplicateTab] = useState(false)

  // Draft'i sessionStorage'dan yukle. Yoksa siparis sayfasina geri don.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(CHECKOUT_DRAFT_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as CheckoutDraft
        if (parsed?.payload?.classId) {
          setDraft(parsed)
          setLoading(false)
          return
        }
      }
    } catch {}
    router.replace('/siparis?reason=session-lost')
  }, [router])

  // Coklu sekme uyarisi (UX; cift odeme denemesini netlestirir)
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return
    const channel = new BroadcastChannel('odeme-checkout')
    const tabId = Math.random().toString(36).slice(2)
    channel.postMessage({ type: 'hello', tabId })
    channel.onmessage = (event) => {
      if (!event.data) return
      if (event.data.type === 'hello' && event.data.tabId !== tabId) {
        channel.postMessage({ type: 'ack', tabId })
        setDuplicateTab(true)
      } else if (event.data.type === 'ack' && event.data.tabId !== tabId) {
        setDuplicateTab(true)
      }
    }
    return () => { channel.close() }
  }, [])

  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, "").replace(/[^0-9]/gi, "")
    const matches = v.match(/\d{4,16}/g)
    const match = (matches && matches[0]) || ""
    const parts = []
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4))
    }
    return parts.length ? parts.join(" ") : value
  }

  const formatExpiry = (value: string) => {
    const v = value.replace(/\s+/g, "").replace(/[^0-9]/gi, "")
    if (v.length >= 2) {
      return v.substring(0, 2) + "/" + v.substring(2, 4)
    }
    return v
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!draft) return

    setProcessing(true)
    try {
      const res = await fetch("/api/veli/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...draft.payload,
          cardNumber: cardNumber.replace(/\s/g, ""),
          cardHolder,
          expiry,
          cvv,
          locale,
        })
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        // Odeme/checkout basarisiz -> siparis OLUSMADI. Veliye hata goster, sayfada kal.
        setError(data.error || t('errors.failed'))
        return
      }

      setOrderNumber(data.orderNumber)
      setSuccess(true)

      // Basarili: draft + form taslagini temizle
      try { sessionStorage.removeItem(CHECKOUT_DRAFT_KEY) } catch {}
      try { localStorage.removeItem(`paket-form-${draft.payload.classId}`) } catch {}

      setTimeout(() => {
        router.push(`/siparis-onay/${data.orderNumber}`)
      }, 2500)

    } catch {
      setError(t('errors.generic'))
    } finally {
      setProcessing(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8 pb-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-green-600 mb-2">{t('success.title')}</h2>
            <p className="text-gray-600 mb-4">
              {t('success.message')}
            </p>
            <p className="text-sm text-gray-500">
              {t('success.orderNoLabel')} <span className="font-mono">{orderNumber}</span>
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="container mx-auto px-4 max-w-lg">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <CreditCard className="h-6 w-6 text-blue-600" />
            </div>
            <CardTitle className="text-2xl">{t('title')}</CardTitle>
            <CardDescription>{t('subtitle')}</CardDescription>
          </CardHeader>
          <CardContent>
            {duplicateTab && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                <strong>{t('duplicateTab.label')}</strong> {t('duplicateTab.message')}
              </div>
            )}

            {/* Siparis Ozeti (draft) */}
            {draft && (
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <div className="flex justify-between mb-2">
                  <span className="text-gray-500">{t('summary.student')}</span>
                  <span>{draft.summary.studentName}{draft.summary.studentCount > 1 ? ` (+${draft.summary.studentCount - 1})` : ''}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-gray-500">{t('summary.package')}</span>
                  <span>{draft.summary.packageName}</span>
                </div>
                {draft.summary.discountCode && draft.summary.discountAmount ? (
                  <div className="flex justify-between mb-2 text-green-600 text-sm">
                    <span>{t('summary.discount', { code: draft.summary.discountCode })}</span>
                    <span>-{draft.summary.discountAmount.toFixed(2)} TL</span>
                  </div>
                ) : null}
                <div className="flex justify-between font-bold text-lg">
                  <span>{t('summary.total')}</span>
                  <span className="text-blue-600">{Number(draft.summary.totalAmount).toFixed(2)} TL</span>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4" autoComplete="on">
              <div className="space-y-2">
                <Label htmlFor="cardNumber">{t('form.cardNumber')}</Label>
                <Input
                  id="cardNumber"
                  name="cardNumber"
                  placeholder={t('form.cardNumberPlaceholder')}
                  value={cardNumber}
                  onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                  maxLength={19}
                  disabled={processing}
                  inputMode="numeric"
                  autoComplete="cc-number"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cardHolder">{t('form.cardHolder')}</Label>
                <Input
                  id="cardHolder"
                  name="cardHolder"
                  placeholder={t('form.cardHolderPlaceholder')}
                  value={cardHolder}
                  onChange={(e) => setCardHolder(e.target.value.toUpperCase())}
                  disabled={processing}
                  autoComplete="cc-name"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="expiry">{t('form.expiry')}</Label>
                  <Input
                    id="expiry"
                    name="expiry"
                    placeholder={t('form.expiryPlaceholder')}
                    value={expiry}
                    onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                    maxLength={5}
                    disabled={processing}
                    inputMode="numeric"
                    autoComplete="cc-exp"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cvv">{t('form.cvv')}</Label>
                  <Input
                    id="cvv"
                    name="cvv"
                    placeholder="000"
                    value={cvv}
                    onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").slice(0, 3))}
                    maxLength={3}
                    type="password"
                    inputMode="numeric"
                    autoComplete="cc-csc"
                    disabled={processing}
                    required
                  />
                </div>
              </div>

              {error && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full" size="lg" disabled={processing}>
                {processing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t('form.processing')}
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4 mr-2" />
                    {t('form.pay', { amount: Number(draft?.summary.totalAmount).toFixed(2) })}
                  </>
                )}
              </Button>

              <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
                <Lock className="h-3 w-3" />
                <span>{t('form.sslBadge')}</span>
              </div>

              <div className="text-center">
                <Link href="/siparis" className="text-sm text-gray-500 hover:text-gray-700 underline">
                  {t('form.back')}
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
