/**
 * Security Helpers
 *
 * - getClientIp: Vercel/proxy uyumlu IP cikarimi (XFF spoofing'e dirençli)
 * - escapeHtml: HTML injection engelleme (email template'leri için)
 * - escapeCsvValue: Excel/CSV formula injection engelleme (export'lar için)
 */

/**
 * Gercek client IP'sini cikarir.
 *
 * Vercel `x-forwarded-for` baslığını her zaman kendisi ekler ve `<client>, <proxy1>, <proxy2>...` formatinda
 * SOLDAN saga (en eski → en yeni) tutar. Saldirgan kendi XFF baslığını eklerse o değer en SOLDA kalır
 * (Vercel onu önüne push'lar). Bu nedenle "en sağdaki" IP gercek client değil — Vercel'in proxy IP'si olur.
 *
 * Vercel'de en güvenilir kaynak: `x-real-ip` (Vercel kendisi set eder, override edilemez).
 * Fallback: `x-forwarded-for`'un EN SOLDAKI degeri (Vercel doc).
 *
 * Saldırgan tarafından kontrol edilebilir bir IP rate-limit identifier'i olarak kullanılırsa,
 * her istekte farklı IP göndererek limit bypass edilebilir. Bu yüzden `x-real-ip` öncelikli.
 */
export function getClientIp(request: Request): string {
  // Vercel'in set ettiği header — override edilemez
  const realIp = request.headers.get('x-real-ip')
  if (realIp && realIp.trim()) return realIp.trim()

  // Cloudflare
  const cfIp = request.headers.get('cf-connecting-ip')
  if (cfIp && cfIp.trim()) return cfIp.trim()

  // x-forwarded-for: en SOLDAKİ IP gercek client (Vercel format)
  const xff = request.headers.get('x-forwarded-for')
  if (xff) {
    const first = xff.split(',')[0]?.trim()
    if (first) return first
  }

  return 'unknown'
}

/**
 * HTML special karakterleri escape eder.
 * Email template'lerinde kullanici girdisinin HTML olarak yorumlanmasini engeller.
 */
export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\//g, '&#x2F;')
}

/**
 * Excel/CSV formula injection engelleme.
 * Excel `=`, `+`, `-`, `@` ile baslayan hucreleri formula olarak yorumlar.
 * `=cmd|'/c calc'!A0` gibi payload'lar admin/mudur Excel'i actiginda komut calistirabilir.
 *
 * Cozum: Bu karakterlerle baslayan stringlerin basina apostrof (') ekle. Bu Excel'de
 * "bu hucre text" anlamına gelir, formula calismaz, görünüm normal kalır.
 */
export function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str.length === 0) return ''
  // Tehlikeli prefix karakterler
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`
  }
  return str
}

/**
 * Numerik değer içeren bir hücre için (totalAmount gibi).
 * Number ise olduğu gibi döner (Excel onu sayı olarak yorumlar), string ise sanitize.
 */
export function safeCellValue(value: unknown): string | number | Date | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') return value
  if (value instanceof Date) return value
  return escapeCsvValue(value)
}

/**
 * Sensitive data sanitization for logging.
 * Production'da PAN, CVV, password, token, secret gibi alanlar log'a yazilirsa
 * bu fonksiyon onlari MASKED olarak gosterir.
 */
const SENSITIVE_KEY_PATTERNS = [
  /password/i,
  /^pwd$/i,
  /token/i,
  /secret/i,
  /api[_-]?key/i,
  /authorization/i,
  /^cvv$/i,
  /^cvc$/i,
  /^pan$/i,
  /cardnumber/i,
  /card[_-]?holder/i,
  /^expir/i,
  /^cookie$/i,
]

export function sanitizeForLog(value: unknown, depth: number = 0): unknown {
  if (depth > 5) return '[max-depth]'
  if (value === null || value === undefined) return value
  if (typeof value === 'string') {
    // Kart numarasi gorunumlu stringleri maskele (13-19 hane)
    if (/^\d{13,19}$/.test(value)) return '****'
    return value
  }
  if (typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map(v => sanitizeForLog(v, depth + 1))

  const sanitized: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    const isSensitive = SENSITIVE_KEY_PATTERNS.some(p => p.test(key))
    if (isSensitive) {
      sanitized[key] = typeof val === 'string' && val.length > 0 ? '[REDACTED]' : val
    } else {
      sanitized[key] = sanitizeForLog(val, depth + 1)
    }
  }
  return sanitized
}

/**
 * HMAC-imzali order access token.
 * URL'de ek koruma katmani: orderNumber'a sahip olmak yetmez, ayrica imzali token gerekir.
 * Defense-in-depth: orderNumber sizmasi durumunda saldirgan ek olarak access token'a da ihtiyaci olur.
 *
 * Algorithma: HMAC-SHA256(orderId, JWT_SECRET) -> base64url, ilk 16 karakter
 * (16 karakter = 96 bit -> brute-force imkansiz)
 */
import { createHmac, timingSafeEqual } from 'crypto'

function getHmacSecret(): string {
  const secret = process.env.JWT_SECRET
  if (process.env.NODE_ENV === 'production' && process.env.NEXT_PHASE !== 'phase-production-build') {
    if (!secret || secret.length < 16) {
      throw new Error('JWT_SECRET production icin yeterince guvenli degil')
    }
  }
  return secret || 'dev-secret-do-not-use-in-production-change-me'
}

export function generateOrderAccessToken(orderId: string): string {
  return createHmac('sha256', getHmacSecret())
    .update(`order:${orderId}`)
    .digest('base64url')
    .slice(0, 16)
}

export function verifyOrderAccessToken(orderId: string, token: string): boolean {
  if (!token || typeof token !== 'string' || token.length !== 16) return false
  const expected = generateOrderAccessToken(orderId)
  // Timing-safe karsilastirma (length kontrolu yukarida yapildi)
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(token))
  } catch {
    return false
  }
}
