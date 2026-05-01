/**
 * Ortak Zod schema validators
 */

import { z } from 'zod'

// Turkce telefon: 10 (5xx xxx xx xx) ya da 11 (05xx) hane
export const phoneSchema = z.string()
  .transform(s => s.replace(/[\s\-()]/g, ''))
  .pipe(
    z.string().regex(/^0?5[0-9]{9}$/, 'Gecerli bir telefon numarasi giriniz (5xx xxx xx xx)')
  )

export const emailSchema = z.string()
  .trim()
  .toLowerCase()
  .email('Gecerli bir e-posta adresi giriniz')
  .max(254, 'E-posta cok uzun')

export const optionalEmailSchema = z.union([
  z.literal(''),
  emailSchema
]).optional().nullable()

// Genel string limitleri (DoS koruması için)
export const shortText = z.string().trim().min(1).max(200)
export const mediumText = z.string().trim().min(1).max(500)
export const longText = z.string().trim().max(2000).optional().nullable()

// Sınıf şubesi (DB VarChar(4))
export const studentSectionSchema = z.string().trim().max(4).optional().nullable()

// İndirim kodu — admin ve veli endpoint'lerinde
export const discountCodeSchema = z.string()
  .trim()
  .toUpperCase()
  .min(3, 'Indirim kodu en az 3 karakter olmali')
  .max(40, 'Indirim kodu cok uzun')
  .regex(/^[A-Z0-9_-]+$/, 'Indirim kodu sadece harf, rakam, _ ve - icerebilir')

// validFrom: gun basina (00:00:00.000) yuvarla
// validUntil: gun sonuna (23:59:59.999) yuvarla
// Bu sayede admin "2026-05-01 - 2026-05-31" girdiginde son gun aksami da kapsanir.
// JS "YYYY-MM-DD" string'ini UTC midnight olarak parse ettigi icin UTC saat kontrolü yapilir.
function isMidnightUTC(d: Date): boolean {
  return d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0
}

const validFromSchema = z.coerce.date()

const validUntilSchema = z.coerce.date().transform(d => {
  // Sadece tarih (YYYY-MM-DD) girilmis gibi gorunuyorsa gun sonuna ayarla.
  // UTC midnight'a "Date.UTC" ile gun sonu (23:59:59.999) ekle.
  if (isMidnightUTC(d)) {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999))
  }
  return d
})

// Admin discount creation/update body schema
export const adminDiscountBodySchema = z.object({
  code: discountCodeSchema,
  description: z.string().trim().max(500).optional().nullable(),
  type: z.enum(['PERCENTAGE', 'FIXED']),
  value: z.coerce.number().positive('Deger pozitif olmali'),
  minAmount: z.coerce.number().nonnegative().optional().nullable(),
  maxDiscount: z.coerce.number().positive().optional().nullable(),
  validFrom: validFromSchema,
  validUntil: validUntilSchema,
  usageLimit: z.coerce.number().int().positive().optional().nullable(),
}).refine(
  data => data.validFrom < data.validUntil,
  { message: 'Bitis tarihi baslangic tarihinden sonra olmali', path: ['validUntil'] }
).refine(
  data => data.type !== 'PERCENTAGE' || (data.value > 0 && data.value <= 100),
  { message: 'Yuzde indirim 0 ile 100 arasinda olmali', path: ['value'] }
)

export type AdminDiscountBody = z.infer<typeof adminDiscountBodySchema>

// Veli order body — guvenlik kritik (DoS, oversized fields)
export const veliOrderBodySchema = z.object({
  classId: z.string().trim().min(1).max(40),
  parentName: z.string().trim().min(2, 'Veli adi en az 2 karakter olmali').max(100),
  studentName: z.string().trim().min(2, 'Ogrenci adi en az 2 karakter olmali').max(100),
  studentSection: studentSectionSchema,
  phone: phoneSchema,
  email: emailSchema,
  address: z.string().trim().min(5, 'Adres en az 5 karakter olmali').max(1000),
  deliveryAddress: z.string().trim().max(1000).optional().nullable(),
  invoiceAddress: z.string().trim().max(1000).optional().nullable(),
  invoiceAddressSame: z.boolean().optional(),
  isCorporateInvoice: z.boolean().optional(),
  companyTitle: z.string().trim().max(200).optional().nullable(),
  taxNumber: z.string().trim().min(10).max(11).regex(/^\d+$/, 'Vergi/TC No sadece rakam icerebilir'),
  taxOffice: z.string().trim().max(100).optional().nullable(),
  orderNote: z.string().trim().max(500).optional().nullable(),
  discountCode: z.string().trim().max(40).optional().nullable(),
})

export type VeliOrderBody = z.infer<typeof veliOrderBodySchema>

// Veli payment body — accessToken zorunlu (defense-in-depth, F-04)
export const veliPaymentBodySchema = z.object({
  orderId: z.string().trim().max(40).optional().nullable(),
  orderNumber: z.string().trim().max(40).optional().nullable(),
  accessToken: z.string().trim().length(16, 'Gecersiz erisim anahtari'),
  cardNumber: z.string().trim().regex(/^\d{13,19}$/, 'Gecersiz kart numarasi'),
  cardHolder: z.string().trim().min(3).max(50),
  expiry: z.string().trim().regex(/^(0[1-9]|1[0-2])\/?\d{2,4}$/, 'Gecersiz son kullanma tarihi'),
  cvv: z.string().trim().regex(/^\d{3,4}$/, 'Gecersiz CVV'),
}).refine(
  data => data.orderId || data.orderNumber,
  { message: 'Siparis ID veya numarasi gerekli', path: ['orderId'] }
)

// Veli discount validation body
export const veliDiscountBodySchema = z.object({
  code: discountCodeSchema,
  totalAmount: z.coerce.number().nonnegative().optional().nullable(),
})

// Veli verify-password body
export const veliVerifyPasswordBodySchema = z.object({
  password: z.string().trim().min(1).max(100),
})

// Login body (admin & mudur)
export const loginBodySchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(200),
})

// Cancel request body — accessToken zorunlu (defense-in-depth, F-04)
export const veliCancelRequestBodySchema = z.object({
  orderId: z.string().trim().min(1).max(40),
  accessToken: z.string().trim().length(16, 'Gecersiz erisim anahtari'),
  reason: z.string().trim().min(5, 'Iptal nedeni en az 5 karakter olmali').max(1000),
})

/**
 * Hata mesajlarini kullanici dostu sekilde formatla
 */
export function formatZodError(error: z.ZodError): string {
  const first = error.issues[0]
  if (!first) return 'Gecersiz veri'
  return first.message
}
