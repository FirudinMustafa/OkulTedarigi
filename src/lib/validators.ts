/**
 * Ortak Zod schema validators
 */

import { z } from 'zod'
import './zod-tr'

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

// HTML tag karakterleri ('<', '>') iceren stringi reddeden regex.
// XSS hardening: PDF/Excel/email render'inda escape unutulursa stored XSS riskini onler.
export const NO_HTML_REGEX = /^[^<>]*$/
export const NO_HTML_MSG = 'Gecersiz karakter (< veya > kullanilamaz)'

// Admin tarafi text alanlari icin reusable helper (HTML/script enjeksiyonu reddeder).
export const noHtmlString = (min: number, max: number) =>
  z.string().trim().min(min, `En az ${min} karakter olmali`).max(max, `En fazla ${max} karakter olabilir`)
    .regex(NO_HTML_REGEX, NO_HTML_MSG)

// Mudur sifresi - admin tarafi okul olusturma/guncellemede minimum guvenlik
export const directorPasswordSchema = z.string().min(8, 'Mudur sifresi en az 8 karakter olmali').max(200)

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
  description: z.string().trim().max(500).regex(NO_HTML_REGEX, NO_HTML_MSG).optional().nullable(),
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

// === Admin tarafi schema'lari (XSS hardening + sifre policy) ===

// Okul olusturma — POST /api/admin/schools
export const adminSchoolCreateSchema = z.object({
  name: noHtmlString(2, 200),
  address: noHtmlString(0, 500).optional().nullable().or(z.literal('')),
  phone: z.string().trim().max(30).optional().nullable().or(z.literal('')),
  email: z.union([z.literal(''), emailSchema]).optional().nullable(),
  deliveryType: z.enum(['CARGO', 'SCHOOL_DELIVERY']).optional(),
  directorName: noHtmlString(0, 200).optional().nullable().or(z.literal('')),
  directorEmail: emailSchema,
  directorPassword: directorPasswordSchema,
  password: z.string().trim().max(40).optional().nullable(), // veli sifresi (opsiyonel)
})
export type AdminSchoolCreateBody = z.infer<typeof adminSchoolCreateSchema>

// Okul guncelleme — PUT /api/admin/schools/[id]. directorPassword opsiyonel ama varsa min 8.
export const adminSchoolUpdateSchema = z.object({
  name: noHtmlString(2, 200).optional(),
  address: noHtmlString(0, 500).nullable().optional(),
  phone: z.string().trim().max(30).nullable().optional(),
  email: z.union([z.literal(''), emailSchema]).nullable().optional(),
  deliveryType: z.enum(['CARGO', 'SCHOOL_DELIVERY']).optional(),
  directorName: noHtmlString(0, 200).nullable().optional(),
  directorEmail: emailSchema.optional(),
  directorPassword: directorPasswordSchema.optional(),
  password: z.string().trim().max(40).nullable().optional(),
  isActive: z.boolean().optional(),
})
export type AdminSchoolUpdateBody = z.infer<typeof adminSchoolUpdateSchema>

// Sinif olusturma — POST /api/admin/classes
export const adminClassCreateSchema = z.object({
  name: noHtmlString(1, 100),
  schoolId: z.string().trim().min(1).max(40),
  packageId: z.string().trim().min(1).max(40).optional().nullable(),
  commissionAmount: z.coerce.number().nonnegative('Komisyon negatif olamaz').max(1_000_000).optional(),
})

// Sinif guncelleme — PUT /api/admin/classes/[id]
export const adminClassUpdateSchema = z.object({
  name: noHtmlString(1, 100).optional(),
  schoolId: z.string().trim().min(1).max(40).optional(),
  packageId: z.string().trim().max(40).nullable().optional().or(z.literal('')),
  commissionAmount: z.coerce.number().nonnegative().max(1_000_000).optional(),
  isActive: z.boolean().optional(),
})

// Paket Item — name HTML reddi
export const adminPackageItemSchema = z.object({
  name: noHtmlString(1, 200),
  quantity: z.coerce.number().int().min(1).max(1000).optional(),
  unitPrice: z.coerce.number().nonnegative().max(1_000_000).optional(),
  price: z.coerce.number().nonnegative().max(1_000_000).optional(),
})

// Paket olusturma — POST /api/admin/packages
export const adminPackageCreateSchema = z.object({
  name: noHtmlString(1, 200),
  description: noHtmlString(0, 2000).nullable().optional().or(z.literal('')),
  note: noHtmlString(0, 2000).nullable().optional().or(z.literal('')),
  basePrice: z.coerce.number().nonnegative().max(1_000_000).optional(),
  price: z.coerce.number().nonnegative().max(1_000_000).optional(),
  items: z.array(adminPackageItemSchema).min(1, 'Pakette en az bir urun olmalidir').max(100),
})

// Paket guncelleme — PUT /api/admin/packages/[id]
export const adminPackageUpdateSchema = z.object({
  name: noHtmlString(1, 200).optional(),
  description: noHtmlString(0, 2000).nullable().optional(),
  note: noHtmlString(0, 2000).nullable().optional(),
  basePrice: z.coerce.number().nonnegative().max(1_000_000).optional(),
  isActive: z.boolean().optional(),
  items: z.array(adminPackageItemSchema).max(100).optional(),
})

// Maksimum ogrenci sayisi (1 siparis basina) - kotuye kullanim ve ozet ekraninin sismesi icin sinir
export const MAX_STUDENTS_PER_ORDER = 5

// Tek bir ogrenci girdisi (cogul ogrenci destegi)
export const orderStudentSchema = z.object({
  firstName: z.string().trim().min(2, 'Ogrenci adi en az 2 karakter olmali').max(100).regex(NO_HTML_REGEX, NO_HTML_MSG),
  lastName: z.string().trim().min(2, 'Ogrenci soyadi en az 2 karakter olmali').max(100).regex(NO_HTML_REGEX, NO_HTML_MSG),
  section: studentSectionSchema,
})

// Veli order body — guvenlik kritik (DoS, oversized fields)
export const veliOrderBodySchema = z.object({
  classId: z.string().trim().min(1).max(40),
  parentName: z.string().trim().min(2, 'Veli adi en az 2 karakter olmali').max(100).regex(NO_HTML_REGEX, NO_HTML_MSG),
  students: z.array(orderStudentSchema)
    .min(1, 'En az bir ogrenci eklenmelidir')
    .max(MAX_STUDENTS_PER_ORDER, `En fazla ${MAX_STUDENTS_PER_ORDER} ogrenci eklenebilir`),
  phone: phoneSchema,
  email: emailSchema,
  address: z.string().trim().min(5, 'Adres en az 5 karakter olmali').max(1000).regex(NO_HTML_REGEX, NO_HTML_MSG),
  deliveryAddress: z.string().trim().max(1000).regex(NO_HTML_REGEX, NO_HTML_MSG).optional().nullable(),
  invoiceAddress: z.string().trim().max(1000).regex(NO_HTML_REGEX, NO_HTML_MSG).optional().nullable(),
  invoiceAddressSame: z.boolean().optional(),
  isCorporateInvoice: z.boolean().optional(),
  companyTitle: z.string().trim().max(200).regex(NO_HTML_REGEX, NO_HTML_MSG).optional().nullable(),
  taxNumber: z.string().trim().min(10).max(11).regex(/^\d+$/, 'Vergi/TC No sadece rakam icerebilir'),
  taxOffice: z.string().trim().max(100).regex(NO_HTML_REGEX, NO_HTML_MSG).optional().nullable(),
  orderNote: z.string().trim().max(500).regex(NO_HTML_REGEX, NO_HTML_MSG).optional().nullable(),
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
  totalAmount: z.coerce.number().positive('Sepet tutari pozitif olmalidir'),
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

// Cancel request body — kimlik dogrulama: accessToken VEYA phoneLast4
//   accessToken: order POST response'undan gelir (siparis olusturan veli)
//   phoneLast4: /siparis-takip uzerinden gelen veliler icin (telefon son 4 hane confirm)
export const veliCancelRequestBodySchema = z.object({
  orderId: z.string().trim().min(1).max(40),
  accessToken: z.string().trim().length(16, 'Gecersiz erisim anahtari').optional(),
  phoneLast4: z.string().trim().regex(/^\d{4}$/, 'Telefon son 4 hane 4 rakam olmalidir').optional(),
  reason: z.string().trim().min(5, 'Iptal nedeni en az 5 karakter olmali').max(1000),
}).refine(
  data => !!data.accessToken || !!data.phoneLast4,
  { message: 'Kimlik dogrulamasi gerekli (telefon son 4 hane)', path: ['phoneLast4'] }
)

/**
 * Hata mesajlarini kullanici dostu sekilde formatla
 */
export function formatZodError(error: z.ZodError): string {
  const first = error.issues[0]
  if (!first) return 'Gecersiz veri'
  return first.message
}
