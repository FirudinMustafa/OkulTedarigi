/**
 * Yurtiçi Kargo SOAP Entegrasyonu (KOPS Web Servisleri)
 *
 * ShipmentData/ShipmentResult/TrackingInfo arayuzlerini ve
 * createShipment/getTrackingInfo/cancelShipment fonksiyonlarini ihrac eder.
 *
 * Ödeme tipi: AÖ (Alici Oder). Bu, wsUserName'deki "A" onekiyle (1149A...) belirlenir;
 * SOAP govdesinde ayri bir alan gonderilmez.
 *
 * Endpoint (prod):
 *   Olustur/Iptal/Sorgu: https://webservices.yurticikargo.com/KOPSWebServices/ShippingOrderDispatcherServices
 *   targetNamespace    : http://yurticikargo.com.tr/ShippingOrderDispatcherServices
 *
 * Auth: her istekte wsUserName + wsPassword govdede gonderilir (createShipment/cancelShipment
 *       icin userLanguage, queryShipment icin wsLanguage alani kullanilir).
 *
 * USE_MOCK_CARGO=true iken gercek cagri yapilmaz; mock simulasyon doner.
 */

import { XMLParser } from 'fast-xml-parser'

export interface ShipmentData {
  orderNumber: string
  receiverName: string
  receiverPhone: string
  receiverAddress: string
  receiverCity?: string
  receiverDistrict?: string
  packageCount: number
  packageWeight?: number
  packageContent: string
  receiverEmail?: string
  studentCount?: number // koli agirligini ogrenci sayisina gore olceklemek icin
}

export interface ShipmentResult {
  success: boolean
  trackingNo?: string
  trackingUrl?: string
  errorMessage?: string
}

export interface TrackingInfo {
  status: string
  statusCode: string
  lastUpdate: string
  location: string
  estimatedDelivery?: string
  events: {
    date: string
    status: string
    location: string
  }[]
}

// =====================================================================
// Config
// =====================================================================

// Default: mock KAPALI. Dev'de USE_MOCK_CARGO=true belirtilmeli.
const USE_MOCK = process.env.USE_MOCK_CARGO === 'true'
const isDev = process.env.NODE_ENV !== 'production'

const WS_USER = process.env.YURTICI_WS_USERNAME || ''
const WS_PASS = process.env.YURTICI_WS_PASSWORD || ''
const DISPATCH_URL = (
  process.env.YURTICI_DISPATCH_URL ||
  'https://webservices.yurticikargo.com/KOPSWebServices/ShippingOrderDispatcherServices'
).replace(/\/$/, '')
// Sorgu operasyonlari da ayni dispatcher servisinde yer alir.
const QUERY_URL = (process.env.YURTICI_QUERY_URL || DISPATCH_URL).replace(/\/$/, '')

const SOAP_NS = 'http://yurticikargo.com.tr/ShippingOrderDispatcherServices'

// Koli agirligi: ogrenci basina kg (AÖ'de alici desi/kg'ye gore oder). Env ile ayarlanabilir.
const KG_PER_STUDENT = Number(process.env.YURTICI_KG_PER_STUDENT || '2') || 2

// Yurtici hata kodlari
const ERR_DUPLICATE_CARGO_KEY = '60020' // ayni cargoKey ile aktif kayit zaten var

function isConfigured(): boolean {
  return !!(WS_USER && WS_PASS)
}

export const yurticiConfig = {
  dispatchUrl: DISPATCH_URL,
  isConfigured: isConfigured(),
}

function trackingUrl(key: string): string {
  return `https://www.yurticikargo.com/tr/online-servisler/gonderi-sorgula?code=${encodeURIComponent(key)}`
}

// =====================================================================
// SOAP yardimcilari
// =====================================================================

function xmlEscape(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** Turk cep tel: rakam disini at, bastaki 90/0'i sok, son 10 haneyi al. */
function normalizePhone(phone: string): string {
  let d = (phone || '').replace(/\D/g, '')
  if (d.startsWith('90')) d = d.slice(2)
  if (d.startsWith('0')) d = d.slice(1)
  return d.slice(-10)
}

const parser = new XMLParser({
  ignoreAttributes: true,
  removeNSPrefix: true, // ns1:outFlag -> outFlag (wrapper isminden bagimsiz erisim)
  parseTagValue: false, // her seyi string tut (outFlag "0" gibi)
  trimValues: true,
})

/** Parse edilmis objede ic ice herhangi bir derinlikte ilk `key` degerini bulur. */
function findFirst(obj: unknown, key: string): unknown {
  if (obj == null || typeof obj !== 'object') return undefined
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const r = findFirst(item, key)
      if (r !== undefined) return r
    }
    return undefined
  }
  const rec = obj as Record<string, unknown>
  if (key in rec) return rec[key]
  for (const v of Object.values(rec)) {
    const r = findFirst(v, key)
    if (r !== undefined) return r
  }
  return undefined
}

/** Parse edilmis objede ic ice tum `key` dugumlerini (array'e duzlestirerek) toplar. */
function findAll(obj: unknown, key: string, acc: unknown[] = []): unknown[] {
  if (obj == null || typeof obj !== 'object') return acc
  if (Array.isArray(obj)) {
    for (const item of obj) findAll(item, key, acc)
    return acc
  }
  const rec = obj as Record<string, unknown>
  for (const [k, v] of Object.entries(rec)) {
    if (k === key) {
      if (Array.isArray(v)) acc.push(...v)
      else acc.push(v)
    }
    findAll(v, key, acc)
  }
  return acc
}

function str(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'object') return ''
  return String(v).trim()
}

/**
 * Merkezi SOAP cagrisi: zarfi POST eder, HTTP/SOAP-fault kontrolu yapar,
 * parse edilmis govdeyi (Envelope -> Body altindaki ilk dugum) doner.
 */
async function soapCall(endpoint: string, operation: string, innerXml: string): Promise<Record<string, unknown>> {
  const envelope =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ser="${SOAP_NS}">` +
    `<soapenv:Header/>` +
    `<soapenv:Body><ser:${operation}>${innerXml}</ser:${operation}></soapenv:Body>` +
    `</soapenv:Envelope>`

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      SOAPAction: '', // Yurtici tum operasyonlarda bos SOAPAction kullanir
    },
    body: envelope,
  })

  const text = await res.text().catch(() => '')

  if (!res.ok) {
    throw new Error(`Yurtici ${operation} HTTP ${res.status}: ${text.slice(0, 300)}`)
  }

  const parsed = parser.parse(text) as Record<string, unknown>

  // SOAP fault?
  const faultString = findFirst(parsed, 'faultstring') ?? findFirst(parsed, 'faultString')
  if (faultString) {
    throw new Error(`Yurtici ${operation} SOAP fault: ${str(faultString)}`)
  }

  const body = findFirst(parsed, 'Body')
  return (body && typeof body === 'object' ? (body as Record<string, unknown>) : parsed)
}

// =====================================================================
// createShipment
// =====================================================================

export async function createShipment(data: ShipmentData): Promise<ShipmentResult> {
  if (USE_MOCK) {
    if (isDev) {
      console.log('[MOCK YURTICI KARGO] Kargo kaydi olusturuluyor:', data.orderNumber)
      console.log('  - Alici:', data.receiverName)
      console.log('  - Adres:', data.receiverAddress)
    }
    await new Promise(resolve => setTimeout(resolve, 1000))
    const trackingNo = `YK${Date.now().toString().slice(-10)}`
    return { success: true, trackingNo, trackingUrl: trackingUrl(trackingNo) }
  }

  if (!isConfigured()) {
    throw new Error('Yurtici Kargo yapilandirilmadi: YURTICI_WS_USERNAME ve YURTICI_WS_PASSWORD gerekli')
  }

  const phone = normalizePhone(data.receiverPhone)

  // ShippingOrderVO.
  // ÖNEMLİ: tt* (Tahsilatlı Teslimat / kapıda tahsilat) alanlari HIC gonderilmez.
  // Canli testte bunlari 0 olarak gondermek bile errCode 82505/82507 ("TT_INVOICE_AMOUNT
  // / TT_DOCUMENT_ID parametresi hatali yada eksik") hatasi veriyor. Urun bedeli online
  // tahsil edildigi icin kapida tahsilat YOK; AÖ (kargo ucretini alici oder) hesap
  // tanimindan gelir, govdede ayri alan gerekmez. dcSelectedCredit/dcCreditRule=0 sorunsuz.
  const vo: Record<string, string | number> = {
    cargoKey: data.orderNumber,
    invoiceKey: data.orderNumber,
    receiverCustName: data.receiverName,
    receiverAddress: data.receiverAddress,
    cityName: data.receiverCity || '',
    townName: data.receiverDistrict || '',
    receiverPhone1: phone,
    emailAddress: data.receiverEmail || '',
    taxOfficeId: 0,
    desi: '',
    kg: data.packageWeight ?? Math.max(1, (data.studentCount && data.studentCount > 0 ? data.studentCount : 1) * KG_PER_STUDENT),
    cargoCount: data.packageCount || 1,
    dcSelectedCredit: 0,
    dcCreditRule: 0,
    description: data.packageContent || '',
  }
  // NOT: bos il/ilce Yurtici tarafindan KABUL edilir (canli test); blok yok.

  const voXml = Object.entries(vo)
    .map(([k, v]) => `<${k}>${xmlEscape(v)}</${k}>`)
    .join('')

  const inner =
    `<wsUserName>${xmlEscape(WS_USER)}</wsUserName>` +
    `<wsPassword>${xmlEscape(WS_PASS)}</wsPassword>` +
    `<userLanguage>TR</userLanguage>` +
    `<ShippingOrderVO>${voXml}</ShippingOrderVO>`

  const body = await soapCall(DISPATCH_URL, 'createShipment', inner)

  // Basari: outFlag === "0". Detayda errCode/errMessage olabilir.
  const outFlag = str(findFirst(body, 'outFlag'))
  const outResult = str(findFirst(body, 'outResult'))
  const errMessage = str(findFirst(body, 'errMessage'))
  const errCode = str(findFirst(body, 'errCode'))

  const ok = outFlag === '0' && (errCode === '' || errCode === '0')

  if (!ok) {
    let msg = errMessage || outResult || `Yurtici hata (outFlag=${outFlag}, errCode=${errCode})`
    // 60020: bu cargoKey (siparis no) icin Yurtici'de zaten aktif kayit var.
    // Cozum: once kargoyu iptal et (cancelShipment) -> sonra tekrar kargola.
    if (errCode === ERR_DUPLICATE_CARGO_KEY) {
      msg = 'Bu siparis icin Yurtici sisteminde zaten aktif bir kargo kaydi mevcut. Once mevcut kargoyu iptal edip tekrar deneyin.'
    }
    if (isDev) console.error('[YURTICI] createShipment basarisiz:', errCode, msg)
    return { success: false, errorMessage: msg }
  }

  // Yurtici createShipment'ta takip anahtari bizim gonderdigimiz cargoKey'dir.
  return {
    success: true,
    trackingNo: data.orderNumber,
    trackingUrl: trackingUrl(data.orderNumber),
  }
}

// =====================================================================
// getTrackingInfo (queryShipment)
// =====================================================================

export async function getTrackingInfo(trackingNo: string): Promise<TrackingInfo> {
  if (USE_MOCK) {
    if (isDev) console.log('[MOCK YURTICI KARGO] Kargo takip sorgusu:', trackingNo)
    const now = new Date()
    const estimatedDelivery = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000)
    return {
      status: 'DAGITIMDA',
      statusCode: 'IN_TRANSIT',
      lastUpdate: now.toISOString(),
      location: 'Transfer Merkezi',
      estimatedDelivery: estimatedDelivery.toISOString(),
      events: [
        { date: now.toISOString(), status: 'Kargo dagitim subesine ulasti', location: 'Transfer Merkezi' },
      ],
    }
  }

  if (!isConfigured()) {
    throw new Error('Yurtici Kargo yapilandirilmadi: YURTICI_WS_USERNAME ve YURTICI_WS_PASSWORD gerekli')
  }

  // keyType=0 -> cargoKey ile sorgula. addHistoricalData=true -> hareket gecmisi gelir.
  const inner =
    `<wsUserName>${xmlEscape(WS_USER)}</wsUserName>` +
    `<wsPassword>${xmlEscape(WS_PASS)}</wsPassword>` +
    `<wsLanguage>TR</wsLanguage>` +
    `<keys>${xmlEscape(trackingNo)}</keys>` +
    `<keyType>0</keyType>` +
    `<addHistoricalData>true</addHistoricalData>` +
    `<onlyTracking>false</onlyTracking>`

  const body = await soapCall(QUERY_URL, 'queryShipment', inner)

  const deliveryDate = str(findFirst(body, 'deliveryDate'))
  const cargoEvent = str(findFirst(body, 'cargoEventExplanation'))
  const operationMessage = str(findFirst(body, 'operationMessage'))

  const delivered = !!deliveryDate || /teslim edildi/i.test(cargoEvent) || /teslim edildi/i.test(operationMessage)

  // invDocCargoVOArray: hareket gecmisi (eventDate/eventTime/eventName/cityName/townName)
  const rawEvents = findAll(body, 'invDocCargoVOArray')
  const events = rawEvents
    .map(e => {
      const date = `${str(findFirst(e, 'eventDate'))} ${str(findFirst(e, 'eventTime'))}`.trim()
      const status = str(findFirst(e, 'eventName')) || str(findFirst(e, 'reasonName'))
      const city = str(findFirst(e, 'cityName'))
      const town = str(findFirst(e, 'townName'))
      const location = [city, town].filter(Boolean).join(' / ')
      return { date, status, location }
    })
    .filter(e => e.status || e.date)

  const lastEvent = events[events.length - 1]

  return {
    status: delivered ? 'TESLIM EDILDI' : (cargoEvent || operationMessage || 'DAGITIMDA'),
    statusCode: delivered ? 'TESLIM_EDILDI' : 'IN_TRANSIT',
    lastUpdate: deliveryDate || lastEvent?.date || new Date().toISOString(),
    location: lastEvent?.location || '',
    events,
  }
}

// =====================================================================
// cancelShipment
// =====================================================================

export async function cancelShipment(trackingNo: string): Promise<{ success: boolean; message?: string }> {
  if (USE_MOCK) {
    if (isDev) console.log('[MOCK YURTICI KARGO] Kargo iptali:', trackingNo)
    await new Promise(resolve => setTimeout(resolve, 500))
    return { success: true, message: 'Kargo iptali basarili (Mock)' }
  }

  if (!isConfigured()) {
    throw new Error('Yurtici Kargo yapilandirilmadi: YURTICI_WS_USERNAME ve YURTICI_WS_PASSWORD gerekli')
  }

  const inner =
    `<wsUserName>${xmlEscape(WS_USER)}</wsUserName>` +
    `<wsPassword>${xmlEscape(WS_PASS)}</wsPassword>` +
    `<userLanguage>TR</userLanguage>` +
    `<cargoKeys>${xmlEscape(trackingNo)}</cargoKeys>`

  const body = await soapCall(DISPATCH_URL, 'cancelShipment', inner)

  const outFlag = str(findFirst(body, 'outFlag'))
  const outResult = str(findFirst(body, 'outResult'))
  const errMessage = str(findFirst(body, 'errMessage'))

  const ok = outFlag === '0'
  return {
    success: ok,
    message: ok ? (outResult || 'Kargo iptali basarili') : (errMessage || outResult || 'Kargo iptali basarisiz'),
  }
}
