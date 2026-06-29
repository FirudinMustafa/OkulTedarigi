"use client"

import { useState, useEffect, Suspense } from "react"
import { useTranslations, useLocale } from "next-intl"
import { useSearchParams } from "next/navigation"
import { Link, useRouter } from "@/i18n/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Lock, Loader2, ShieldCheck } from "lucide-react"
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

function OdemeInner() {
  const t = useTranslations('payment')
  const locale = useLocale()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [draft, setDraft] = useState<CheckoutDraft | null>(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState("")
  const [duplicateTab, setDuplicateTab] = useState(false)

  // PayNKolay'dan basarisiz/iptal donusu (callback failUrl -> ?reason=failed)
  useEffect(() => {
    if (searchParams.get('reason') === 'failed') {
      setError(t('errors.failed'))
    }
  }, [searchParams, t])

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

  // Coklu sekme uyarisi (UX)
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

  // PayNKolay'a otomatik POST eden gizli form olusturup gonderir (tarayici Nkolay'a yonlenir).
  const submitToPaynkolay = (actionUrl: string, fields: Record<string, string>) => {
    const form = document.createElement('form')
    form.method = 'POST'
    form.action = actionUrl
    form.style.display = 'none'
    for (const [k, v] of Object.entries(fields)) {
      const input = document.createElement('input')
      input.type = 'hidden'
      input.name = k
      input.value = String(v ?? '')
      form.appendChild(input)
    }
    document.body.appendChild(form)
    form.submit()
  }

  const handlePay = async () => {
    setError("")
    if (!draft) return
    setProcessing(true)
    try {
      const res = await fetch("/api/veli/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft.payload, locale }),
      })
      const data = await res.json()

      if (!res.ok || !data.success || !data.actionUrl || !data.fields) {
        setError(data.error || t('errors.failed'))
        setProcessing(false)
        return
      }

      // Siparis sunucuda PAYMENT_PENDING olarak yazildi; taslak artik gereksiz.
      try { sessionStorage.removeItem(CHECKOUT_DRAFT_KEY) } catch {}
      try { localStorage.removeItem(`paket-form-${draft.payload.classId}`) } catch {}

      // PayNKolay Ortak Odeme sayfasina yonlendir (kart + taksit orada alinir).
      submitToPaynkolay(data.actionUrl, data.fields)
      // Not: processing true kalir; sayfa PayNKolay'a gider.
    } catch {
      setError(t('errors.generic'))
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

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="container mx-auto px-4 max-w-lg">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <ShieldCheck className="h-6 w-6 text-blue-600" />
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

            {error && (
              <div className="mb-4 bg-red-50 text-red-600 p-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <Button onClick={handlePay} className="w-full" size="lg" disabled={processing}>
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

            <div className="mt-3 flex items-center justify-center gap-2 text-xs text-gray-500">
              <Lock className="h-3 w-3" />
              <span>{t('form.sslBadge')}</span>
            </div>

            <div className="mt-2 text-center">
              <Link href="/siparis" className="text-sm text-gray-500 hover:text-gray-700 underline">
                {t('form.back')}
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// useSearchParams() prerender sirasinda Suspense gerektirir (Next.js statik export).
export default function OdemePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    }>
      <OdemeInner />
    </Suspense>
  )
}
