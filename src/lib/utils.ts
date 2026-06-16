import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Arama için metni normalize eder: büyük/küçük harf + Türkçe aksan duyarsız.
// "ALİ", "ali", "ALI" -> "ali"; "Ayşe" -> "ayse"; "Güneş" -> "gunes".
// Admin arama kutularında hem aranan terime hem alanlara uygulanır.
export function normalizeSearch(value: string | null | undefined): string {
  if (!value) return ''
  return value
    .replace(/İ/g, 'i').replace(/I/g, 'i').replace(/ı/g, 'i')
    .replace(/Ş/g, 's').replace(/ş/g, 's')
    .replace(/Ğ/g, 'g').replace(/ğ/g, 'g')
    .replace(/Ü/g, 'u').replace(/ü/g, 'u')
    .replace(/Ö/g, 'o').replace(/ö/g, 'o')
    .replace(/Ç/g, 'c').replace(/ç/g, 'c')
    .toLowerCase()
}

// Uygulama dil kodunu (tr/en/de/ar) Intl BCP-47 etiketine cevirir.
// Para birimi her zaman TRY kalir; yalnizca bicimlendirme diline gore degisir.
const LOCALE_BCP47: Record<string, string> = {
  tr: 'tr-TR',
  en: 'en-US',
  de: 'de-DE',
  ar: 'ar',
}
function bcp47(locale?: string): string {
  return (locale && LOCALE_BCP47[locale]) || 'tr-TR'
}

export function formatCurrency(amount: number | string, locale?: string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  return new Intl.NumberFormat(bcp47(locale), {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 0,
  }).format(num)
}

export function formatNumber(amount: number | string, locale?: string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  return new Intl.NumberFormat(bcp47(locale)).format(num)
}

export function formatPrice(amount: number | string, locale?: string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  return new Intl.NumberFormat(bcp47(locale), { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num)
}

export function formatDate(date: Date | string, locale?: string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat(bcp47(locale), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d)
}

export function formatDateTime(date: Date | string, locale?: string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat(bcp47(locale), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

export function formatDateShort(date: Date | string, locale?: string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat(bcp47(locale), {
    day: '2-digit',
    month: 'short',
  }).format(d)
}

export function formatDateTimeFull(date: Date | string, locale?: string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat(bcp47(locale), {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

export function formatPhone(phone: string): string {
  // 5551234567 -> 0555 123 45 67
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.length === 10) {
    return `0${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6, 8)} ${cleaned.slice(8)}`
  }
  return phone
}

/**
 * TC Kimlik Numarasi dogrulama (checksum)
 *
 * Kurallar:
 * - 11 hane, hepsi 0-9
 * - Ilk hane sifir olamaz
 * - 10. hane: ((1+3+5+7+9. hanelerin toplami)*7 - (2+4+6+8. hanelerin toplami)) mod 10
 * - 11. hane: ilk 10 hanenin toplaminin mod 10'u
 */
export function isValidTCKimlik(value: string): boolean {
  if (typeof value !== 'string') return false
  if (!/^\d{11}$/.test(value)) return false
  if (value[0] === '0') return false

  const digits = value.split('').map(Number)

  const oddSum = digits[0] + digits[2] + digits[4] + digits[6] + digits[8]
  const evenSum = digits[1] + digits[3] + digits[5] + digits[7]

  const tenth = ((oddSum * 7) - evenSum) % 10
  if (((tenth + 10) % 10) !== digits[9]) return false

  const firstTenSum = digits.slice(0, 10).reduce((a, b) => a + b, 0)
  if ((firstTenSum % 10) !== digits[10]) return false

  return true
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}
