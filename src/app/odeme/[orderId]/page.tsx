"use client"

import { useState, useEffect, use } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { CreditCard, Lock, Loader2, CheckCircle } from "lucide-react"

interface Order {
  id: string
  orderNumber: string
  studentName: string
  totalAmount: number
  status: string
  accessToken?: string
}

export default function OdemePage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = use(params)
  const router = useRouter()
  const searchParams = useSearchParams()
  const urlToken = searchParams.get("t") || ""

  const [order, setOrder] = useState<Order | null>(null)
  const [accessToken, setAccessToken] = useState<string>(urlToken)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  const [cardNumber, setCardNumber] = useState("")
  const [cardHolder, setCardHolder] = useState("")
  const [expiry, setExpiry] = useState("")
  const [cvv, setCvv] = useState("")
  const [duplicateTab, setDuplicateTab] = useState(false)

  useEffect(() => {
    fetchOrder()
  }, [orderId])

  // Coklu sekme uyarisi: ayni siparisi 2 sekmede acmaya calisirsak BroadcastChannel
  // ile haberlesip kullaniciyi uyaralim. Bu IDOR/race onlemez (server tarafinda
  // accessToken ve status check zaten var) ama UX'i netlestirir.
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return
    const channel = new BroadcastChannel(`odeme-${orderId}`)
    const tabId = Math.random().toString(36).slice(2)

    channel.postMessage({ type: 'hello', tabId })

    channel.onmessage = (event) => {
      if (!event.data) return
      if (event.data.type === 'hello' && event.data.tabId !== tabId) {
        // Baska bir sekme ayni siparisi acti -> ona ack yolla, kendine uyari goster
        channel.postMessage({ type: 'ack', tabId })
        setDuplicateTab(true)
      } else if (event.data.type === 'ack' && event.data.tabId !== tabId) {
        // Once acilmis sekme bize ack gonderdi -> bu sekme 2.si demektir
        setDuplicateTab(true)
      }
    }
    return () => {
      channel.close()
    }
  }, [orderId])

  const fetchOrder = async () => {
    try {
      const res = await fetch(`/api/veli/order?id=${encodeURIComponent(orderId)}`)
      const data = await res.json()

      if (res.ok && data.id) {
        setOrder(data)
        // URL'de token yoksa GET response'undan al (defense-in-depth icin yine de gerekli)
        if (!accessToken && data.accessToken) {
          setAccessToken(data.accessToken)
        }
      } else if (data.error) {
        setError(data.error)
      } else {
        setError("Siparis bulunamadi")
      }
    } catch {
      setError("Siparis yuklenemedi")
    } finally {
      setLoading(false)
    }
  }

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

    if (!accessToken) {
      setError("Erisim anahtari eksik. Lutfen siparis sayfasindan tekrar gelin.")
      return
    }

    setProcessing(true)

    try {
      const res = await fetch("/api/veli/payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          accessToken,
          cardNumber: cardNumber.replace(/\s/g, ""),
          cardHolder,
          expiry,
          cvv
        })
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Odeme islemi basarisiz")
        return
      }

      setSuccess(true)

      // 3 saniye sonra siparis onay sayfasina yonlendir
      setTimeout(() => {
        router.push(`/siparis-onay/${order?.orderNumber}`)
      }, 3000)

    } catch {
      setError("Odeme islemi sirasinda bir hata olustu")
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
            <h2 className="text-2xl font-bold text-green-600 mb-2">Odeme Basarili!</h2>
            <p className="text-gray-600 mb-4">
              Siparisini aldik. Siparis takip sayfasina yonlendiriliyorsunuz...
            </p>
            <p className="text-sm text-gray-500">
              Siparis No: <span className="font-mono">{order?.orderNumber}</span>
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
            <CardTitle className="text-2xl">Odeme</CardTitle>
            <CardDescription>
              Guvenli odeme islemi
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Coklu sekme uyarisi */}
            {duplicateTab && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                <strong>Dikkat:</strong> Bu siparis baska bir sekmede de acilmis. Cift odeme yapmamak icin lutfen sadece bir sekmeden devam edin.
              </div>
            )}

            {/* Siparis Ozeti */}
            {order && (
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <div className="flex justify-between mb-2">
                  <span className="text-gray-500">Siparis No:</span>
                  <span className="font-mono">{order.orderNumber}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-gray-500">Ogrenci:</span>
                  <span>{order.studentName}</span>
                </div>
                <div className="flex justify-between font-bold text-lg">
                  <span>Toplam:</span>
                  <span className="text-blue-600">{Number(order.totalAmount).toFixed(2)} TL</span>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4" autoComplete="on">
              <div className="space-y-2">
                <Label htmlFor="cardNumber">Kart Numarasi</Label>
                <Input
                  id="cardNumber"
                  name="cardNumber"
                  placeholder="0000 0000 0000 0000"
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
                <Label htmlFor="cardHolder">Kart Uzerindeki Isim</Label>
                <Input
                  id="cardHolder"
                  name="cardHolder"
                  placeholder="AD SOYAD"
                  value={cardHolder}
                  onChange={(e) => setCardHolder(e.target.value.toUpperCase())}
                  disabled={processing}
                  autoComplete="cc-name"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="expiry">Son Kullanma</Label>
                  <Input
                    id="expiry"
                    name="expiry"
                    placeholder="AA/YY"
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
                  <Label htmlFor="cvv">CVV</Label>
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

              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={processing}
              >
                {processing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Islem Yapiliyor...
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4 mr-2" />
                    {Number(order?.totalAmount).toFixed(2)} TL Ode
                  </>
                )}
              </Button>

              <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
                <Lock className="h-3 w-3" />
                <span>256-bit SSL ile guvenli odeme</span>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
