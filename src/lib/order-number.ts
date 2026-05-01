import { randomBytes } from 'crypto'
import { prisma } from './prisma'

// Karistirilabilir karakterler haric (0/O, 1/I) — 32 karakterli alfabe
// 32^8 = ~1.1 trilyon kombinasyon -> sirali tarama imkansiz
const RANDOM_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
const RANDOM_CODE_LENGTH = 8

function generateRandomCode(length: number = RANDOM_CODE_LENGTH): string {
  const bytes = randomBytes(length)
  let result = ''
  for (let i = 0; i < length; i++) {
    result += RANDOM_ALPHABET[bytes[i] % RANDOM_ALPHABET.length]
  }
  return result
}

/**
 * Eszamanli siparis kosullarinda olusabilecek UNIQUE violation'lara karsi
 * generateOrderNumber + create akisini retry ile sarmalayan helper.
 *
 * Cagiranin verdigi callback orderNumber'i alir; eger Prisma P2002 (unique constraint)
 * hatasi firlatirsa yeni bir orderNumber uretip tekrar dener.
 */
export async function withOrderNumberRetry<T>(
  fn: (orderNumber: string) => Promise<T>,
  maxAttempts: number = 5
): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const orderNumber = await generateOrderNumber()
    try {
      return await fn(orderNumber)
    } catch (err: unknown) {
      lastError = err
      const code = (err as { code?: string })?.code
      if (code === 'P2002' && attempt < maxAttempts - 1) {
        // UNIQUE violation: yeni numara ile tekrar dene
        continue
      }
      throw err
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error('Siparis numarasi uretilemedi')
}

/**
 * Siparis numarasi uretici
 * Format: ORD-YYYY-XXXXXXXX (cryptographic random)
 * Ornek: ORD-2026-A8K3M9P2
 *
 * - Yil bilgisi siparis senesini gosterir (sirali degil)
 * - 8 karakter cryptographic random (32 karakterli alfabe -> 32^8 ~= 1.1T kombinasyon)
 * - Sirali tarama (IDOR) saldirisina karsi unguessable
 * - Async (crypto.randomBytes synchronous'tur ama imzayi korumak icin async)
 *
 * NOT: Bu fonksiyon esit ihtimalle UNIQUE violation uretebilir (cok dusuk olasilik).
 * Cagiranlar `withOrderNumberRetry` helper'i ile sarmalamalidir.
 */
export async function generateOrderNumber(): Promise<string> {
  const year = new Date().getFullYear()
  return `ORD-${year}-${generateRandomCode()}`
}

/**
 * Senkron siparis numarasi uretici (fallback - kullanilmamali)
 * Benzersizlik garanti edilemez, sadece acil durumlar icin
 */
export function generateOrderNumberSync(): string {
  const year = new Date().getFullYear()
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = Math.random().toString(36).substring(2, 5).toUpperCase()
  return `ORD-${year}-${timestamp}${random}`.substring(0, 16)
}

/**
 * Teslim tutanagi numarasi uretici
 * Format: TT-YYYY-XXXXX
 * Ornek: TT-2026-00001
 */
export async function generateDeliveryDocumentNumber(): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `TT-${year}-`

  // Bu yıla ait son tutanağı bul
  const lastDoc = await prisma.deliveryDocument.findFirst({
    where: {
      documentNo: {
        startsWith: prefix
      }
    },
    orderBy: {
      documentNo: 'desc'
    },
    select: {
      documentNo: true
    }
  })

  let nextNumber = 1

  if (lastDoc) {
    const lastNumberStr = lastDoc.documentNo.replace(prefix, '')
    const lastNumber = parseInt(lastNumberStr, 10)
    if (!isNaN(lastNumber)) {
      nextNumber = lastNumber + 1
    }
  }

  const sequentialNumber = String(nextNumber).padStart(5, '0')

  return `${prefix}${sequentialNumber}`
}

/**
 * Fatura numarasi uretici
 * Format: INV-YYYY-XXXXXX
 */
export async function generateInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `INV-${year}-`

  // Bu yıla ait son faturayı bul
  const lastOrder = await prisma.order.findFirst({
    where: {
      invoiceNo: {
        startsWith: prefix,
        not: null
      }
    },
    orderBy: {
      invoiceNo: 'desc'
    },
    select: {
      invoiceNo: true
    }
  })

  let nextNumber = 1

  if (lastOrder && lastOrder.invoiceNo) {
    const lastNumberStr = lastOrder.invoiceNo.replace(prefix, '')
    const lastNumber = parseInt(lastNumberStr, 10)
    if (!isNaN(lastNumber)) {
      nextNumber = lastNumber + 1
    }
  }

  const sequentialNumber = String(nextNumber).padStart(6, '0')

  return `${prefix}${sequentialNumber}`
}
