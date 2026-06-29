/**
 * PayNKolay Odeme Entegrasyonu — "Ortak Odeme Sayfasi (Form Gondererek)" modeli
 *
 * Model: Kartsiz alanlar + hashDataV2 tarayicidan POST edilir -> Nkolay Ortak Odeme sayfasi acilir.
 *   - Kart bilgisi DOGRUDAN Nkolay'a girilir (bizim sunucuya/loglara dokunmaz; PCI Nkolay'da).
 *   - Taksit secenekleri Nkolay sayfasinda otomatik gosterilir (tek cekim varsayilan).
 *   - 3D ise banka 3DS akisi Nkolay tarafinda yurutulur.
 *   - Sonuc successUrl (basarili) / failUrl (basarisiz) adresimize POST edilir.
 *
 * Istek hash (CANLI SANDBOX ILE DOGRULANDI - E13 testi):
 *   hashStr = sx | clientRefCode | amount | successUrl | failUrl | rnd | customerKey | merchantSecretKey
 *   hashDataV2 = Base64( SHA512_raw( utf8(hashStr) ) )
 *   - cardHolderIP hash'e DAHIL DEGIL (form alani olarak ayrica gonderilir).
 *   - customerKey kullanilmiyorsa "" (ardisik ||). rnd = "dd.MM.yyyy HH:mm:ss".
 *
 * Iade/iptal hash (DOGRULANDI - resmi dokuman, REFUND_SX kullanilir):
 *   hashStr = refundSx | referenceCode | type | amount | trxDate | merchantSecretKey
 *   type = "cancel" (ayni gun iptal) | "refund" (sonraki gunler). trxDate = "yyyy.MM.dd".
 *
 * NOT: Istekler CANLI'da SUNUCUDAN/gercek domain'den gitmeli; localhost guvenlik hatasi verir.
 */

import crypto from 'crypto'

// ---- Config -------------------------------------------------------------

// GUVENLIK: mock odeme sistemi TAMAMEN kaldirildi. Gercek PayNKolay hash dogrulamasi
// her zaman zorunludur; USE_MOCK_PAYMENT env degiskeni artik hicbir etkiye sahip degildir.
// (Sahte bir callback ile siparis asla PAID yapilamaz.)

const SX = process.env.PAYNKOLAY_SX || ''
const SECRET_KEY = process.env.PAYNKOLAY_SECRET_KEY || ''
const REFUND_SX = process.env.PAYNKOLAY_REFUND_SX || ''
// Test:  https://paynkolaytest.nkolayislem.com.tr
// Canli: https://paynkolay.nkolayislem.com.tr
const BASE_URL = (process.env.PAYNKOLAY_BASE_URL || 'https://paynkolaytest.nkolayislem.com.tr').replace(/\/$/, '')

const CURRENCY_CODE = '949' // TRY

/** Ortak Odeme Sayfasi form action'i (tarayici buraya POST eder). */
export const PAYNKOLAY_HOSTED_URL = `${BASE_URL}/Vpos`
/** Iptal/iade servisi (sunucudan POST). */
export const PAYNKOLAY_REFUND_URL = `${BASE_URL}/Vpos/v1/CancelRefundPayment`

export function assertPaynkolayConfig(): void {
  const missing: string[] = []
  if (!SX) missing.push('PAYNKOLAY_SX')
  if (!SECRET_KEY) missing.push('PAYNKOLAY_SECRET_KEY')
  if (missing.length) throw new Error(`PayNKolay konfigurasyonu eksik: ${missing.join(', ')}`)
}

// ---- Yardimcilar --------------------------------------------------------

/** rnd: "dd.MM.yyyy HH:mm:ss" (resmi hosted Node ornegi nokta ayrac kullanir) */
export function formatRnd(date: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(date.getDate())}.${p(date.getMonth() + 1)}.${date.getFullYear()} ${p(date.getHours())}:${p(date.getMinutes())}:${p(date.getSeconds())}`
}

/** tutar: 2 ondalik, nokta. Orn: "1280.10" */
export function formatAmount(amount: number): string {
  return amount.toFixed(2)
}

/** trxDate: "yyyy.MM.dd" */
export function formatTrxDate(date: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}.${p(date.getMonth() + 1)}.${p(date.getDate())}`
}

function sha512Base64(input: string): string {
  return crypto.createHash('sha512').update(input, 'utf8').digest('base64')
}

// ---- Istek hash + hosted form alanlari ----------------------------------

export interface BuildHostedInput {
  clientRefCode: string   // = orderNumber (Turkce karakter icermez, <=1024)
  amount: number
  successUrl: string
  failUrl: string
  cardHolderIP: string
  locale?: 'tr' | 'en' | 'de' | 'ar'
  /** Taksit zorlamak icin (1=tek cekim). Bos birakilirsa Nkolay tum secenekleri gosterir. */
  installments?: number
  customerKey?: string
}

export interface HostedPaymentForm {
  actionUrl: string
  fields: Record<string, string>
}

/** Ortak Odeme Sayfasi icin form alanlarini + hashDataV2'yi uretir. Kart alani YOKTUR. */
export function buildHostedPaymentForm(input: BuildHostedInput): HostedPaymentForm {
  const rnd = formatRnd()
  const amountStr = formatAmount(input.amount)
  const customerKey = input.customerKey ?? ''

  // Nkolay dil destegi: tr (varsayilan), en, ru. de/ar icin en'e dus.
  const language = input.locale && input.locale !== 'tr' ? 'en' : ''

  assertPaynkolayConfig()
  // CANLI SANDBOX ILE DOGRULANDI: hash'e cardHolderIP DAHIL DEGIL (cardHolderIP form alani olarak ayrica gonderilir).
  // Dogru formul: sx|clientRefCode|amount|successUrl|failUrl|rnd|customerKey|secret
  const hashDataV2 = sha512Base64(
    [SX, input.clientRefCode, amountStr, input.successUrl, input.failUrl, rnd, customerKey, SECRET_KEY].join('|')
  )

  const fields: Record<string, string> = {
    sx: SX,
    clientRefCode: input.clientRefCode,
    amount: amountStr,
    successUrl: input.successUrl,
    failUrl: input.failUrl,
    rnd,
    hashDataV2,
    use3D: 'true',
    transactionType: 'SALES',
    cardHolderIP: input.cardHolderIP,
    currencyCode: CURRENCY_CODE,
  }
  if (language) fields.language = language
  if (input.installments && input.installments > 0) fields.instalments = String(input.installments)
  if (customerKey) fields.customerKey = customerKey

  return { actionUrl: PAYNKOLAY_HOSTED_URL, fields }
}

// ---- Callback (sonuc) degerlendirme -------------------------------------
// TODO(doc): successUrl/failUrl'e donen ALAN ADLARI + response dogrulama hash'i resmi
// "Sonuc Donus Parametreleri / Hash response" dokumanindan KESINLESTIRILMELI.

export interface CallbackVerdict {
  verified: boolean           // response hash dogrulandi mi
  success: boolean            // odeme basarili mi (responseCode==2)
  clientRefCode?: string      // = orderNumber
  paynkolayReference?: string // IKSIRPF... (iade icin saklanir)
  authCode?: string
  authorizationAmount?: number
  installment?: number
  errorMessage?: string
}

/** Nkolay'in callback'e POST ettigi alanlari degerlendirir. Mock'ta her zaman dogrulanmis sayilir. */
export function evaluateCallback(body: Record<string, string>): CallbackVerdict {
  const clientRefCode = body.CLIENT_REFERENCE_CODE || body.clientRefCode || body.CLIENT_REF_CODE
  const responseCode = body.RESPONSE_CODE || body.responseCode
  const authCode = body.AUTH_CODE || body.authCode
  const paynkolayReference = body.REFERENCE_CODE || body.referenceCode
  const authorizationAmount = body.AUTHORIZATION_AMOUNT ? Number(body.AUTHORIZATION_AMOUNT) : undefined
  const installment = body.INSTALLMENT ? Number(body.INSTALLMENT) : undefined

  const verified = verifyResponseHash(body)
  const success = verified && responseCode === '2'
  return {
    verified,
    success,
    clientRefCode,
    paynkolayReference,
    authCode,
    authorizationAmount,
    installment,
    errorMessage: success ? undefined : (body.RESPONSE_DATA || body.responseMessage || 'Odeme dogrulanamadi'),
  }
}

/**
 * Response hash dogrulama (resmi "hash-response" dokumani):
 *   MERCHANT_NO|REFERENCE_CODE|AUTH_CODE|RESPONSE_CODE|USE_3D|RND|INSTALLMENT|AUTHORIZATION_AMOUNT|CURRENCY_CODE|SECRET
 *   -> Base64(SHA512). Gelen hashDataV2 ile timing-safe karsilastir.
 *
 * DOGRULANDI (2026-06-29): prod'da gercek 1 TL odemesi bu formulle PAID oldu (response hash gecti).
 */
export function verifyResponseHash(body: Record<string, string>): boolean {
  assertPaynkolayConfig() // Config eksikse hemen patla (sessizce false donup PAID yapma)
  const received = body.hashDataV2 || body.hashDatav2
  if (!received || !SECRET_KEY) {
    console.error('[PAYNKOLAY] Hash dogrulamasi REDDEDILDI - hash veya secret eksik')
    return false
  }
  const parts = [
    body.MERCHANT_NO, body.REFERENCE_CODE, body.AUTH_CODE, body.RESPONSE_CODE,
    body.USE_3D, body.RND, body.INSTALLMENT, body.AUTHORIZATION_AMOUNT, body.CURRENCY_CODE,
  ].map(v => v ?? '')
  const expected = sha512Base64([...parts, SECRET_KEY].join('|'))
  try {
    const a = Buffer.from(expected)
    const b = Buffer.from(received)
    const ok = a.length === b.length && crypto.timingSafeEqual(a, b)
    if (!ok) {
      console.error('[PAYNKOLAY] response hash uyusmadi', {
        keys: Object.keys(body), responseCode: body.RESPONSE_CODE, expectedLen: a.length, recvLen: b.length,
      })
    }
    return ok
  } catch {
    return false
  }
}

// ---- Iade / iptal (TAM - dokuman dogrulandi) ----------------------------

export interface RefundInput {
  referenceCode: string       // Nkolay referansi (IKSIRPF...) = order.paymentId
  amount: number
  trxDate: Date               // odemenin cekildigi tarih (paidAt)
  type?: 'cancel' | 'refund'  // ayni gun => cancel, sonra => refund
}

export interface RefundResult {
  success: boolean
  refundId?: string
  message?: string
}

export function computeRefundHash(input: { referenceCode: string; type: string; amount: string; trxDate: string }): string {
  return sha512Base64(
    [REFUND_SX, input.referenceCode, input.type, input.amount, input.trxDate, SECRET_KEY].join('|')
  )
}

export async function processRefund(input: RefundInput): Promise<RefundResult> {
  if (!REFUND_SX || !SECRET_KEY) {
    return { success: false, message: 'PayNKolay iade konfigurasyonu eksik (PAYNKOLAY_REFUND_SX/SECRET_KEY)' }
  }

  const type = input.type || 'refund'
  const amountStr = formatAmount(input.amount)
  const trxDate = formatTrxDate(input.trxDate)
  const hashDataV2 = computeRefundHash({ referenceCode: input.referenceCode, type, amount: amountStr, trxDate })

  const form = new FormData()
  form.append('sx', REFUND_SX)
  form.append('referenceCode', input.referenceCode)
  form.append('type', type)
  form.append('amount', amountStr)
  form.append('trxDate', trxDate)
  form.append('hashDatav2', hashDataV2)

  try {
    const res = await fetch(PAYNKOLAY_REFUND_URL, { method: 'POST', body: form })
    const text = await res.text()
    let json: any = null
    try { json = JSON.parse(text) } catch { /* ignore */ }
    const responseCode = json?.responseCode ?? json?.RESPONSE_CODE
    if (res.ok && String(responseCode) === '2') {
      return {
        success: true,
        refundId: json?.REFERENCE_CODE || json?.referenceCode || input.referenceCode,
        message: json?.RESPONSE_DATA || 'Iade basarili',
      }
    }
    return { success: false, message: json?.RESPONSE_DATA || json?.responseMessage || `Iade basarisiz (HTTP ${res.status})` }
  } catch (err) {
    return { success: false, message: `Iade istegi hatasi: ${(err as Error).message}` }
  }
}
