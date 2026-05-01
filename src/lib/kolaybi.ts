/**
 * KolayBi E-Fatura Entegrasyonu
 *
 * Sandbox: https://ofis-sandbox-api.kolaybi.com/kolaybi/v1
 * Production: https://ofis-api.kolaybi.com/kolaybi/v1
 *
 * Auth flow:
 *   POST /kolaybi/v1/access_token
 *   Headers: Channel: <CHANNEL>, Content-Type: application/json
 *   Body: { "api_key": "<API_KEY>" }
 *   Response: { "data": "JWT" }   (24 saat gecerli)
 *
 * Fatura kesim flow (per order):
 *   1. Access token al (cached, 24h)
 *   2. POST /kolaybi/v1/associates  -> { contact_id, address_id }
 *   3. Her item icin POST /kolaybi/v1/products -> { product_id }
 *   4. POST /kolaybi/v1/invoices -> { document_id, grand_total }
 *
 * Tum istekler: x-www-form-urlencoded (JSON DEGIL — auth disinda)
 *
 * Production'a gecmeden ONCE sandbox'ta tum akis test edilmelidir.
 * Channel bilgisi icin: api.support@kolaybi.com'a yazilmalidir.
 */

import { sanitizeForLog } from './security'

export interface InvoiceData {
  orderNumber: string
  customerName: string
  customerPhone: string
  customerEmail?: string
  customerAddress?: string
  isCorporate: boolean
  taxNumber?: string  // TCKN (11 hane bireysel) veya VKN (10 hane kurumsal)
  taxOffice?: string  // Sadece kurumsal
  items: {
    name: string
    quantity: number
    unitPrice: number
    totalPrice: number
  }[]
  totalAmount: number
}

export interface InvoiceResult {
  success: boolean
  invoiceNo?: string
  invoiceDate?: string
  invoiceUrl?: string
  errorMessage?: string
}

// =====================================================================
// Config
// =====================================================================

const USE_MOCK = process.env.USE_MOCK_INVOICE === 'true'
const isDev = process.env.NODE_ENV !== 'production'

const KOLAYBI_BASE_URL = (process.env.KOLAYBI_BASE_URL || 'https://ofis-sandbox-api.kolaybi.com').replace(/\/$/, '')
const KOLAYBI_API_KEY = process.env.KOLAYBI_API_KEY || ''
const KOLAYBI_CHANNEL = process.env.KOLAYBI_CHANNEL || ''
// Geriye uyumluluk: eski env var'i KOLAYBI_SECRET_KEY olarak da kabul et
const KOLAYBI_SECRET_KEY = process.env.KOLAYBI_SECRET_KEY || KOLAYBI_CHANNEL || ''

// Dahili: KolayBi tum API call'lar /kolaybi/v1 prefix'iyle
function url(path: string): string {
  const p = path.startsWith('/') ? path : '/' + path
  // Eger base URL zaten /kolaybi/v1 ile bitiyorsa duplicate eklememe
  if (KOLAYBI_BASE_URL.endsWith('/kolaybi/v1')) return KOLAYBI_BASE_URL + p
  return KOLAYBI_BASE_URL + '/kolaybi/v1' + p
}

function isConfigured(): boolean {
  return !!(KOLAYBI_API_KEY && (KOLAYBI_CHANNEL || KOLAYBI_SECRET_KEY))
}

export const kolayBiConfig = {
  baseUrl: KOLAYBI_BASE_URL,
  isSandbox: KOLAYBI_BASE_URL.includes('sandbox'),
  isConfigured: isConfigured(),
}

// =====================================================================
// Access Token cache (24 saat - token endpoint icin)
// =====================================================================

let _accessToken: string | null = null
let _accessTokenExpiry: number = 0
const TOKEN_TTL_MS = 23 * 60 * 60 * 1000 // 23 saat (1 saat margin)

async function getAccessToken(): Promise<string> {
  const now = Date.now()
  if (_accessToken && now < _accessTokenExpiry) {
    return _accessToken
  }

  if (!isConfigured()) {
    throw new Error('KolayBi yapilandirilmadi: KOLAYBI_API_KEY ve KOLAYBI_CHANNEL gerekli')
  }

  const channel = KOLAYBI_CHANNEL || KOLAYBI_SECRET_KEY

  const res = await fetch(url('/access_token'), {
    method: 'POST',
    headers: {
      'Channel': channel,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({ api_key: KOLAYBI_API_KEY }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '<no body>')
    throw new Error(`KolayBi access_token failed (${res.status}): ${text.slice(0, 300)}`)
  }

  const json = await res.json().catch(() => null) as { data?: string } | null
  const token = json?.data
  if (!token || typeof token !== 'string') {
    throw new Error('KolayBi access_token invalid response')
  }

  _accessToken = token
  _accessTokenExpiry = now + TOKEN_TTL_MS
  if (isDev) console.log('[KOLAYBI] Access token alindi (24h)')

  return token
}

/** Test/debug: token cache'i temizle (jest/test'lerde kullanilabilir) */
export function _clearKolayBiTokenCache(): void {
  _accessToken = null
  _accessTokenExpiry = 0
}

// =====================================================================
// Authenticated API helpers
// =====================================================================

interface KolayBiResponse<T = unknown> {
  data?: T
  message?: string
  description?: string
  success?: boolean
  code?: number
}

async function kolayBiCall<T = unknown>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  body?: Record<string, unknown>,
  retryOn401: boolean = true,
): Promise<T> {
  const token = await getAccessToken()
  const channel = KOLAYBI_CHANNEL || KOLAYBI_SECRET_KEY

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${token}`,
    'Channel': channel,
    'Accept': 'application/json',
  }

  let bodyStr: string | undefined
  if (body && method !== 'GET') {
    headers['Content-Type'] = 'application/x-www-form-urlencoded'
    bodyStr = encodeFormBody(body)
  }

  const res = await fetch(url(path), { method, headers, body: bodyStr })

  // Token expired -> bir kez yenile + tekrar dene
  if (res.status === 401 && retryOn401) {
    if (isDev) console.log('[KOLAYBI] Token expired, yenileniyor')
    _clearKolayBiTokenCache()
    return kolayBiCall<T>(method, path, body, false)
  }

  const text = await res.text()
  let json: KolayBiResponse<T> | null = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = null
  }

  if (!res.ok) {
    const errMsg = json?.message || json?.description || text.slice(0, 300) || `HTTP ${res.status}`
    throw new Error(`KolayBi ${method} ${path} failed (${res.status}): ${errMsg}`)
  }

  if (!json) throw new Error(`KolayBi ${method} ${path}: response not JSON`)
  return (json.data as T) ?? (json as unknown as T)
}

/**
 * x-www-form-urlencoded body builder.
 * Nested objects/arrays icin PHP-style brackets: items[0][product_id]=1
 */
function encodeFormBody(obj: Record<string, unknown>, prefix?: string): string {
  const parts: string[] = []
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) continue
    const fullKey = prefix ? `${prefix}[${key}]` : key

    if (Array.isArray(value)) {
      value.forEach((item, idx) => {
        const itemKey = `${fullKey}[${idx}]`
        if (item !== null && typeof item === 'object') {
          parts.push(encodeFormBody(item as Record<string, unknown>, itemKey))
        } else {
          parts.push(`${encodeURIComponent(itemKey)}=${encodeURIComponent(String(item))}`)
        }
      })
    } else if (value !== null && typeof value === 'object') {
      parts.push(encodeFormBody(value as Record<string, unknown>, fullKey))
    } else {
      parts.push(`${encodeURIComponent(fullKey)}=${encodeURIComponent(String(value))}`)
    }
  }
  return parts.join('&')
}

// =====================================================================
// Domain helpers: Associate, Product, Invoice
// =====================================================================

interface AssociateResponse {
  id: number
  addresses?: Array<{ id: number; address_type?: string }>
}

interface ProductResponse {
  id: number
}

interface InvoiceResponse {
  document_id: number
  grand_total?: number
  grand_currency?: string
}

/**
 * Veli adini ad+soyad olarak ayir.
 * "Ahmet Mehmet Yilmaz" -> name=Ahmet Mehmet, surname=Yilmaz
 */
function splitName(fullName: string): { name: string; surname: string } {
  const trimmed = (fullName || '').trim()
  if (!trimmed) return { name: 'Musteri', surname: '-' }
  const parts = trimmed.split(/\s+/)
  if (parts.length === 1) return { name: parts[0], surname: '-' }
  const surname = parts.pop() as string
  return { name: parts.join(' '), surname }
}

async function createAssociateForOrder(data: InvoiceData): Promise<{ contactId: number; addressId: number }> {
  const { name, surname } = splitName(data.customerName)

  const associateBody: Record<string, unknown> = {
    name: data.isCorporate ? (data.customerName || name) : name,
    surname: data.isCorporate ? '-' : surname,
    identity_no: data.taxNumber || '',
    is_corporate: data.isCorporate,
    associate_type: 'customer',
    code: `OT-${data.orderNumber}`,
    phone: data.customerPhone || undefined,
    email: data.customerEmail || undefined,
  }
  if (data.isCorporate && data.taxOffice) {
    associateBody.tax_office = data.taxOffice
  }
  if (data.customerAddress) {
    associateBody.addresses = {
      address: data.customerAddress.slice(0, 500),
      city: '-',
      district: '-',
      country: 'Turkiye',
    }
  }

  const associate = await kolayBiCall<AssociateResponse>('POST', '/associates', associateBody)
  const contactId = associate?.id
  if (!contactId) throw new Error('KolayBi associate olusturuldu ama id donmedi')

  // Adres id'si: response icindeki addresses[0].id veya billing/shipping
  const addressId = associate.addresses?.[0]?.id
  if (!addressId) {
    throw new Error('KolayBi associate olustu ama address_id alinamadi')
  }

  return { contactId, addressId }
}

async function createProduct(item: InvoiceData['items'][number]): Promise<number> {
  const product = await kolayBiCall<ProductResponse>('POST', '/products', {
    name: item.name.slice(0, 200),
    code: undefined,
    product_type: 'good',
    vat_rate: 20,
    price: item.unitPrice.toFixed(2),
    price_currency: 'try',
    sale_price_vat_included: true,
  })
  if (!product?.id) throw new Error('KolayBi product olusturuldu ama id donmedi')
  return product.id
}

async function createInvoiceReal(data: InvoiceData): Promise<InvoiceResponse> {
  // 1. Associate (musteri) olustur
  const { contactId, addressId } = await createAssociateForOrder(data)

  // 2. Her item icin product olustur (paralel)
  const productIds = await Promise.all(data.items.map(item => createProduct(item)))

  // 3. Invoice olustur
  const invoiceBody: Record<string, unknown> = {
    contact_id: contactId,
    address_id: addressId,
    order_date: new Date().toISOString().slice(0, 10),
    currency: 'try',
    description: `Siparis No: ${data.orderNumber}`,
    document_scenario: data.isCorporate ? 'TICARIFATURA' : 'EARSIVFATURA',
    document_type: 'SATIS',
    receiver_email: data.customerEmail,
    items: data.items.map((item, idx) => ({
      product_id: productIds[idx],
      quantity: String(item.quantity),
      unit_price: item.unitPrice.toFixed(2),
      vat_rate: 20,
    })),
  }

  const invoice = await kolayBiCall<InvoiceResponse>('POST', '/invoices', invoiceBody)
  if (!invoice?.document_id) throw new Error('KolayBi fatura olusturuldu ama document_id donmedi')

  return invoice
}

// =====================================================================
// Public API
// =====================================================================

/**
 * E-Fatura olustur
 * Mock=true ise simulasyon. Aksi halde gercek KolayBi cagrisi.
 */
export async function createInvoice(data: InvoiceData): Promise<InvoiceResult> {
  if (USE_MOCK) {
    if (isDev) {
      console.log('[MOCK KOLAYBI] E-Fatura olusturuluyor:', data.orderNumber)
      console.log('  - Musteri:', data.customerName)
      console.log('  - Tutar:', data.totalAmount, 'TL')
      console.log('  - Kurumsal:', data.isCorporate)
    }
    await new Promise(resolve => setTimeout(resolve, 500))
    const invoiceNo = `INV-${Date.now().toString().slice(-8)}`
    return {
      success: true,
      invoiceNo,
      invoiceDate: new Date().toISOString(),
      // Mock'ta gercek bir PDF URL'i set etmiyoruz — tiklamak istenirse 404 olur.
      // Gercek KolayBi entegrasyonunda invoice PDF ayri bir endpoint'ten cekilir.
      invoiceUrl: undefined,
    }
  }

  if (!isConfigured()) {
    return {
      success: false,
      errorMessage: 'KolayBi API yapilandirilmadi (KOLAYBI_API_KEY, KOLAYBI_CHANNEL eksik)',
    }
  }

  try {
    const invoice = await createInvoiceReal(data)
    return {
      success: true,
      invoiceNo: String(invoice.document_id),
      invoiceDate: new Date().toISOString(),
      invoiceUrl: undefined, // KolayBi PDF URL'i ayri endpoint'te
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Bilinmeyen hata'
    console.error('[KOLAYBI] createInvoice error:', sanitizeForLog({ orderNumber: data.orderNumber, error: errMsg }))
    return {
      success: false,
      errorMessage: `Fatura olusturulamadi: ${errMsg}`,
    }
  }
}

/**
 * E-Fatura iptal
 * Endpoint: DELETE /v1/invoices/{id} (KolayBi REST patternine gore tahmin)
 * Production'da KolayBi destek ekibinden tam endpoint dogrulanmali.
 */
export async function cancelInvoice(invoiceNo: string): Promise<{ success: boolean; message?: string }> {
  if (USE_MOCK) {
    if (isDev) console.log('[MOCK KOLAYBI] E-Fatura iptal ediliyor:', invoiceNo)
    await new Promise(resolve => setTimeout(resolve, 500))
    return { success: true, message: 'Fatura iptali basarili (Mock)' }
  }

  if (!isConfigured()) {
    return { success: false, message: 'KolayBi yapilandirilmadi' }
  }

  try {
    // KolayBi'de fatura iptali genelde DELETE veya POST /cancel olarak yapilir.
    // Doc: tam endpoint belirtilmemis. REST pattern'ine gore DELETE deniyoruz.
    await kolayBiCall<unknown>('DELETE', `/invoices/${encodeURIComponent(invoiceNo)}`)
    return { success: true, message: 'Fatura iptal edildi' }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Bilinmeyen hata'
    // 404/405 gelirse alternatif endpoint dene
    if (errMsg.includes('404') || errMsg.includes('405')) {
      try {
        await kolayBiCall<unknown>('POST', `/invoices/${encodeURIComponent(invoiceNo)}/cancel`)
        return { success: true, message: 'Fatura iptal edildi' }
      } catch (err2) {
        const err2Msg = err2 instanceof Error ? err2.message : 'Bilinmeyen hata'
        console.error('[KOLAYBI] cancelInvoice both endpoints failed:', err2Msg)
        return { success: false, message: `Fatura iptal edilemedi: ${err2Msg}` }
      }
    }
    console.error('[KOLAYBI] cancelInvoice error:', errMsg)
    return { success: false, message: `Fatura iptal edilemedi: ${errMsg}` }
  }
}

/**
 * Fatura durumu sorgula
 * Endpoint: GET /v1/invoices/{id}
 */
export async function getInvoiceStatus(invoiceNo: string): Promise<{ status: string; message?: string }> {
  if (USE_MOCK) {
    if (isDev) console.log('[MOCK KOLAYBI] Fatura durumu sorgusu:', invoiceNo)
    return { status: 'APPROVED', message: 'Fatura onaylandi (Mock)' }
  }

  if (!isConfigured()) {
    return { status: 'UNKNOWN', message: 'KolayBi yapilandirilmadi' }
  }

  try {
    const invoice = await kolayBiCall<{ status?: string; document_status?: string }>(
      'GET',
      `/invoices/${encodeURIComponent(invoiceNo)}`,
    )
    const status = invoice?.status || invoice?.document_status || 'UNKNOWN'
    return { status: String(status).toUpperCase() }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Bilinmeyen hata'
    return { status: 'ERROR', message: errMsg }
  }
}
