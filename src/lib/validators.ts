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

// Cevrilebilir alan (name_en/name_de/name_ar) — opsiyonel, bos olabilir, HTML reddi.
// DB VarChar(191) sinirina uyacak sekilde max 191.
export const translationString = z.string().trim().max(191).regex(NO_HTML_REGEX, NO_HTML_MSG).optional().nullable().or(z.literal(''))
// Uzun cevrilebilir alan (description_*/note_* gibi) — opsiyonel, max 2000.
export const translationLongString = z.string().trim().max(2000).regex(NO_HTML_REGEX, NO_HTML_MSG).optional().nullable().or(z.literal(''))

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
  // Cok dilli okul adi (opsiyonel) — bos ise TR tabana fallback
  name_en: translationString,
  name_de: translationString,
  name_ar: translationString,
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
  // Cok dilli okul adi (opsiyonel)
  name_en: translationString,
  name_de: translationString,
  name_ar: translationString,
})
export type AdminSchoolUpdateBody = z.infer<typeof adminSchoolUpdateSchema>

// Sinif olusturma — POST /api/admin/classes
export const adminClassCreateSchema = z.object({
  name: noHtmlString(1, 100),
  schoolId: z.string().trim().min(1).max(40),
  packageId: z.string().trim().min(1).max(40).optional().nullable(),
  commissionAmount: z.coerce.number().nonnegative('Komisyon negatif olamaz').max(1_000_000).optional(),
  // Cok dilli sinif adi (opsiyonel)
  name_en: translationString,
  name_de: translationString,
  name_ar: translationString,
})

// Sinif guncelleme — PUT /api/admin/classes/[id]
export const adminClassUpdateSchema = z.object({
  name: noHtmlString(1, 100).optional(),
  schoolId: z.string().trim().min(1).max(40).optional(),
  packageId: z.string().trim().max(40).nullable().optional().or(z.literal('')),
  commissionAmount: z.coerce.number().nonnegative().max(1_000_000).optional(),
  isActive: z.boolean().optional(),
  // Cok dilli sinif adi (opsiyonel)
  name_en: translationString,
  name_de: translationString,
  name_ar: translationString,
})

// Paket Item — name HTML reddi
export const adminPackageItemSchema = z.object({
  name: noHtmlString(1, 200),
  // Cok dilli urun adi (opsiyonel)
  name_en: translationString,
  name_de: translationString,
  name_ar: translationString,
  quantity: z.coerce.number().int().min(1).max(1000).optional(),
  unitPrice: z.coerce.number().nonnegative().max(1_000_000).optional(),
  price: z.coerce.number().nonnegative().max(1_000_000).optional(),
})

// Paket olusturma — POST /api/admin/packages
export const adminPackageCreateSchema = z.object({
  name: noHtmlString(1, 200),
  description: noHtmlString(0, 2000).nullable().optional().or(z.literal('')),
  note: noHtmlString(0, 2000).nullable().optional().or(z.literal('')),
  // Cok dilli paket alanlari (opsiyonel)
  name_en: translationString,
  name_de: translationString,
  name_ar: translationString,
  description_en: translationLongString,
  description_de: translationLongString,
  description_ar: translationLongString,
  note_en: translationLongString,
  note_de: translationLongString,
  note_ar: translationLongString,
  basePrice: z.coerce.number().nonnegative().max(1_000_000).optional(),
  price: z.coerce.number().nonnegative().max(1_000_000).optional(),
  items: z.array(adminPackageItemSchema).min(1, 'Pakette en az bir urun olmalidir').max(100),
})

// Paket guncelleme — PUT /api/admin/packages/[id]
export const adminPackageUpdateSchema = z.object({
  name: noHtmlString(1, 200).optional(),
  description: noHtmlString(0, 2000).nullable().optional(),
  note: noHtmlString(0, 2000).nullable().optional(),
  // Cok dilli paket alanlari (opsiyonel)
  name_en: translationString,
  name_de: translationString,
  name_ar: translationString,
  description_en: translationLongString,
  description_de: translationLongString,
  description_ar: translationLongString,
  note_en: translationLongString,
  note_de: translationLongString,
  note_ar: translationLongString,
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
  // Sube zorunlu — tek harf (A, B, C...)
  section: z.string().trim().min(1, 'Sube zorunlu').max(1, 'Sube tek harf olmali').regex(NO_HTML_REGEX, NO_HTML_MSG),
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
  city: z.string().trim().max(100).regex(NO_HTML_REGEX, NO_HTML_MSG).optional().nullable(),
  district: z.string().trim().max(100).regex(NO_HTML_REGEX, NO_HTML_MSG).optional().nullable(),
  isCorporateInvoice: z.boolean().optional(),
  companyTitle: z.string().trim().max(200).regex(NO_HTML_REGEX, NO_HTML_MSG).optional().nullable(),
  taxNumber: z.string().trim().min(10).max(11).regex(/^\d+$/, 'Vergi/TC No sadece rakam icerebilir'),
  taxOffice: z.string().trim().max(100).regex(NO_HTML_REGEX, NO_HTML_MSG).optional().nullable(),
  orderNote: z.string().trim().max(500).regex(NO_HTML_REGEX, NO_HTML_MSG).optional().nullable(),
  // Taksit (opsiyonel). Bos/null ise PayNKolay sayfasi tum secenekleri kendisi gosterir.
  installments: z.coerce.number().int().min(1).max(12).optional().nullable(),
  discountCode: z.string().trim().max(40).optional().nullable(),
  selectedItemIds: z.array(z.string().trim().min(1).max(40)).max(100).optional().nullable(),
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

// Veli checkout body — siparis + kart tek istekte (siparis SADECE odeme basariliysa olusur)
// veliOrderBodySchema alanlari + kart bilgileri. accessToken/orderId YOK (henuz order yok).
export const veliCheckoutBodySchema = veliOrderBodySchema.extend({
  cardNumber: z.string().trim().regex(/^\d{13,19}$/, 'Gecersiz kart numarasi'),
  cardHolder: z.string().trim().min(3).max(50),
  expiry: z.string().trim().regex(/^(0[1-9]|1[0-2])\/?\d{2,4}$/, 'Gecersiz son kullanma tarihi'),
  cvv: z.string().trim().regex(/^\d{3,4}$/, 'Gecersiz CVV'),
})

export type VeliCheckoutBody = z.infer<typeof veliCheckoutBodySchema>

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
 * Sunucu tarafi dogrulama mesajlarinin cok dilli karsiliklari (tr kaynaktir).
 * Anahtarlar, schema'larda/zod-tr.ts'de gecen TURKCE mesajin TAM string'idir
 * (diakritiksiz hali nasil yazildiysa aynen) — boylece issue.message lookup eslesir.
 *
 * NOT: Schema'lar (z.object/z.string ve .min/.max/.email custom mesajlari)
 * DEGISTIRILMEDI. Ceviri SADECE bu lookup ile, formatZodError icinde yapilir.
 */
type ValidationLocale = 'en' | 'de' | 'ar'

export const VALIDATION_I18N: Record<ValidationLocale, Record<string, string>> = {
  en: {
    // --- validators.ts custom mesajlari ---
    'Gecersiz veri': 'Invalid data',
    'Gecerli bir telefon numarasi giriniz (5xx xxx xx xx)': 'Enter a valid phone number (5xx xxx xx xx)',
    'Gecerli bir e-posta adresi giriniz': 'Enter a valid email address',
    'E-posta cok uzun': 'Email is too long',
    'Gecersiz karakter (< veya > kullanilamaz)': 'Invalid character (< or > cannot be used)',
    'Mudur sifresi en az 8 karakter olmali': 'Director password must be at least 8 characters',
    'Indirim kodu en az 3 karakter olmali': 'Discount code must be at least 3 characters',
    'Indirim kodu cok uzun': 'Discount code is too long',
    'Indirim kodu sadece harf, rakam, _ ve - icerebilir': 'Discount code may only contain letters, numbers, _ and -',
    'Deger pozitif olmali': 'Value must be positive',
    'Bitis tarihi baslangic tarihinden sonra olmali': 'End date must be after the start date',
    'Yuzde indirim 0 ile 100 arasinda olmali': 'Percentage discount must be between 0 and 100',
    'Komisyon negatif olamaz': 'Commission cannot be negative',
    'Pakette en az bir urun olmalidir': 'The package must contain at least one item',
    'Ogrenci adi en az 2 karakter olmali': 'Student first name must be at least 2 characters',
    'Ogrenci soyadi en az 2 karakter olmali': 'Student last name must be at least 2 characters',
    'Sube zorunlu': 'Section is required',
    'Sube tek harf olmali': 'Section must be a single letter',
    'Veli adi en az 2 karakter olmali': 'Parent name must be at least 2 characters',
    'En az bir ogrenci eklenmelidir': 'At least one student must be added',
    'Adres en az 5 karakter olmali': 'Address must be at least 5 characters',
    'Vergi/TC No sadece rakam icerebilir': 'Tax/ID number may only contain digits',
    'Gecersiz erisim anahtari': 'Invalid access key',
    'Gecersiz kart numarasi': 'Invalid card number',
    'Gecersiz son kullanma tarihi': 'Invalid expiry date',
    'Gecersiz CVV': 'Invalid CVV',
    'Siparis ID veya numarasi gerekli': 'Order ID or number is required',
    'Sepet tutari pozitif olmalidir': 'Cart total must be positive',
    'Telefon son 4 hane 4 rakam olmalidir': 'Phone last 4 digits must be 4 numbers',
    'Iptal nedeni en az 5 karakter olmali': 'Cancellation reason must be at least 5 characters',
    'Kimlik dogrulamasi gerekli (telefon son 4 hane)': 'Identity verification required (last 4 phone digits)',
    // En az/En fazla {n} sablonlari (noHtmlString helper + dinamik ogrenci limiti)
    'En az 1 karakter olmali': 'Must be at least 1 character',
    'En az 2 karakter olmali': 'Must be at least 2 characters',
    'En fazla 100 karakter olabilir': 'Must be at most 100 characters',
    'En fazla 200 karakter olabilir': 'Must be at most 200 characters',
    'En fazla 500 karakter olabilir': 'Must be at most 500 characters',
    'En fazla 2000 karakter olabilir': 'Must be at most 2000 characters',
    'En fazla 5 ogrenci eklenebilir': 'At most 5 students can be added',
    // --- zod-tr.ts generic defaults ---
    'Bu alan zorunludur': 'This field is required',
    'Gecersiz deger': 'Invalid value',
    'En az 1 oge gerekli': 'At least 1 item is required',
    'Deger cok kucuk': 'Value is too small',
    'Deger cok buyuk': 'Value is too large',
    'Gecerli bir e-posta giriniz': 'Enter a valid email',
    'Gecerli bir URL giriniz': 'Enter a valid URL',
    'Gecerli bir kimlik degeri giriniz': 'Enter a valid identifier',
    'Gecersiz format': 'Invalid format',
    'Gecersiz secim': 'Invalid selection',
    'Bilinmeyen alan(lar)': 'Unknown field(s)',
    'Gecersiz tarih': 'Invalid date',
  },
  de: {
    'Gecersiz veri': 'Ungültige Daten',
    'Gecerli bir telefon numarasi giriniz (5xx xxx xx xx)': 'Geben Sie eine gültige Telefonnummer ein (5xx xxx xx xx)',
    'Gecerli bir e-posta adresi giriniz': 'Geben Sie eine gültige E-Mail-Adresse ein',
    'E-posta cok uzun': 'E-Mail ist zu lang',
    'Gecersiz karakter (< veya > kullanilamaz)': 'Ungültiges Zeichen (< oder > ist nicht erlaubt)',
    'Mudur sifresi en az 8 karakter olmali': 'Das Direktor-Passwort muss mindestens 8 Zeichen lang sein',
    'Indirim kodu en az 3 karakter olmali': 'Der Rabattcode muss mindestens 3 Zeichen lang sein',
    'Indirim kodu cok uzun': 'Der Rabattcode ist zu lang',
    'Indirim kodu sadece harf, rakam, _ ve - icerebilir': 'Der Rabattcode darf nur Buchstaben, Zahlen, _ und - enthalten',
    'Deger pozitif olmali': 'Der Wert muss positiv sein',
    'Bitis tarihi baslangic tarihinden sonra olmali': 'Das Enddatum muss nach dem Startdatum liegen',
    'Yuzde indirim 0 ile 100 arasinda olmali': 'Der Prozentrabatt muss zwischen 0 und 100 liegen',
    'Komisyon negatif olamaz': 'Die Provision darf nicht negativ sein',
    'Pakette en az bir urun olmalidir': 'Das Paket muss mindestens einen Artikel enthalten',
    'Ogrenci adi en az 2 karakter olmali': 'Der Vorname des Schülers muss mindestens 2 Zeichen lang sein',
    'Ogrenci soyadi en az 2 karakter olmali': 'Der Nachname des Schülers muss mindestens 2 Zeichen lang sein',
    'Sube zorunlu': 'Die Klasse ist erforderlich',
    'Sube tek harf olmali': 'Die Klasse muss ein einzelner Buchstabe sein',
    'Veli adi en az 2 karakter olmali': 'Der Name des Erziehungsberechtigten muss mindestens 2 Zeichen lang sein',
    'En az bir ogrenci eklenmelidir': 'Es muss mindestens ein Schüler hinzugefügt werden',
    'Adres en az 5 karakter olmali': 'Die Adresse muss mindestens 5 Zeichen lang sein',
    'Vergi/TC No sadece rakam icerebilir': 'Die Steuer-/ID-Nummer darf nur Ziffern enthalten',
    'Gecersiz erisim anahtari': 'Ungültiger Zugriffsschlüssel',
    'Gecersiz kart numarasi': 'Ungültige Kartennummer',
    'Gecersiz son kullanma tarihi': 'Ungültiges Ablaufdatum',
    'Gecersiz CVV': 'Ungültiger CVV',
    'Siparis ID veya numarasi gerekli': 'Bestell-ID oder -nummer ist erforderlich',
    'Sepet tutari pozitif olmalidir': 'Der Warenkorbbetrag muss positiv sein',
    'Telefon son 4 hane 4 rakam olmalidir': 'Die letzten 4 Telefonziffern müssen 4 Zahlen sein',
    'Iptal nedeni en az 5 karakter olmali': 'Der Stornierungsgrund muss mindestens 5 Zeichen lang sein',
    'Kimlik dogrulamasi gerekli (telefon son 4 hane)': 'Identitätsprüfung erforderlich (letzte 4 Telefonziffern)',
    'En az 1 karakter olmali': 'Muss mindestens 1 Zeichen lang sein',
    'En az 2 karakter olmali': 'Muss mindestens 2 Zeichen lang sein',
    'En fazla 100 karakter olabilir': 'Darf höchstens 100 Zeichen lang sein',
    'En fazla 200 karakter olabilir': 'Darf höchstens 200 Zeichen lang sein',
    'En fazla 500 karakter olabilir': 'Darf höchstens 500 Zeichen lang sein',
    'En fazla 2000 karakter olabilir': 'Darf höchstens 2000 Zeichen lang sein',
    'En fazla 5 ogrenci eklenebilir': 'Es können höchstens 5 Schüler hinzugefügt werden',
    'Bu alan zorunludur': 'Dieses Feld ist erforderlich',
    'Gecersiz deger': 'Ungültiger Wert',
    'En az 1 oge gerekli': 'Mindestens 1 Element ist erforderlich',
    'Deger cok kucuk': 'Der Wert ist zu klein',
    'Deger cok buyuk': 'Der Wert ist zu groß',
    'Gecerli bir e-posta giriniz': 'Geben Sie eine gültige E-Mail ein',
    'Gecerli bir URL giriniz': 'Geben Sie eine gültige URL ein',
    'Gecerli bir kimlik degeri giriniz': 'Geben Sie eine gültige Kennung ein',
    'Gecersiz format': 'Ungültiges Format',
    'Gecersiz secim': 'Ungültige Auswahl',
    'Bilinmeyen alan(lar)': 'Unbekannte(s) Feld(er)',
    'Gecersiz tarih': 'Ungültiges Datum',
  },
  ar: {
    'Gecersiz veri': 'بيانات غير صالحة',
    'Gecerli bir telefon numarasi giriniz (5xx xxx xx xx)': 'أدخل رقم هاتف صالح (5xx xxx xx xx)',
    'Gecerli bir e-posta adresi giriniz': 'أدخل عنوان بريد إلكتروني صالح',
    'E-posta cok uzun': 'البريد الإلكتروني طويل جدًا',
    'Gecersiz karakter (< veya > kullanilamaz)': 'حرف غير صالح (لا يمكن استخدام < أو >)',
    'Mudur sifresi en az 8 karakter olmali': 'يجب أن تتكون كلمة مرور المدير من 8 أحرف على الأقل',
    'Indirim kodu en az 3 karakter olmali': 'يجب أن يتكون رمز الخصم من 3 أحرف على الأقل',
    'Indirim kodu cok uzun': 'رمز الخصم طويل جدًا',
    'Indirim kodu sadece harf, rakam, _ ve - icerebilir': 'يمكن أن يحتوي رمز الخصم على أحرف وأرقام و _ و - فقط',
    'Deger pozitif olmali': 'يجب أن تكون القيمة موجبة',
    'Bitis tarihi baslangic tarihinden sonra olmali': 'يجب أن يكون تاريخ الانتهاء بعد تاريخ البدء',
    'Yuzde indirim 0 ile 100 arasinda olmali': 'يجب أن تكون نسبة الخصم بين 0 و 100',
    'Komisyon negatif olamaz': 'لا يمكن أن تكون العمولة سالبة',
    'Pakette en az bir urun olmalidir': 'يجب أن تحتوي الحزمة على عنصر واحد على الأقل',
    'Ogrenci adi en az 2 karakter olmali': 'يجب أن يتكون الاسم الأول للطالب من حرفين على الأقل',
    'Ogrenci soyadi en az 2 karakter olmali': 'يجب أن يتكون اسم عائلة الطالب من حرفين على الأقل',
    'Sube zorunlu': 'الشعبة مطلوبة',
    'Sube tek harf olmali': 'يجب أن تكون الشعبة حرفًا واحدًا',
    'Veli adi en az 2 karakter olmali': 'يجب أن يتكون اسم ولي الأمر من حرفين على الأقل',
    'En az bir ogrenci eklenmelidir': 'يجب إضافة طالب واحد على الأقل',
    'Adres en az 5 karakter olmali': 'يجب أن يتكون العنوان من 5 أحرف على الأقل',
    'Vergi/TC No sadece rakam icerebilir': 'يمكن أن يحتوي الرقم الضريبي/الهوية على أرقام فقط',
    'Gecersiz erisim anahtari': 'مفتاح وصول غير صالح',
    'Gecersiz kart numarasi': 'رقم بطاقة غير صالح',
    'Gecersiz son kullanma tarihi': 'تاريخ انتهاء صلاحية غير صالح',
    'Gecersiz CVV': 'رمز CVV غير صالح',
    'Siparis ID veya numarasi gerekli': 'معرّف الطلب أو رقمه مطلوب',
    'Sepet tutari pozitif olmalidir': 'يجب أن يكون مبلغ السلة موجبًا',
    'Telefon son 4 hane 4 rakam olmalidir': 'يجب أن تكون آخر 4 أرقام من الهاتف 4 أرقام',
    'Iptal nedeni en az 5 karakter olmali': 'يجب أن يتكون سبب الإلغاء من 5 أحرف على الأقل',
    'Kimlik dogrulamasi gerekli (telefon son 4 hane)': 'التحقق من الهوية مطلوب (آخر 4 أرقام من الهاتف)',
    'En az 1 karakter olmali': 'يجب أن يتكون من حرف واحد على الأقل',
    'En az 2 karakter olmali': 'يجب أن يتكون من حرفين على الأقل',
    'En fazla 100 karakter olabilir': 'يجب ألا يزيد عن 100 حرف',
    'En fazla 200 karakter olabilir': 'يجب ألا يزيد عن 200 حرف',
    'En fazla 500 karakter olabilir': 'يجب ألا يزيد عن 500 حرف',
    'En fazla 2000 karakter olabilir': 'يجب ألا يزيد عن 2000 حرف',
    'En fazla 5 ogrenci eklenebilir': 'يمكن إضافة 5 طلاب كحد أقصى',
    'Bu alan zorunludur': 'هذا الحقل مطلوب',
    'Gecersiz deger': 'قيمة غير صالحة',
    'En az 1 oge gerekli': 'مطلوب عنصر واحد على الأقل',
    'Deger cok kucuk': 'القيمة صغيرة جدًا',
    'Deger cok buyuk': 'القيمة كبيرة جدًا',
    'Gecerli bir e-posta giriniz': 'أدخل بريدًا إلكترونيًا صالحًا',
    'Gecerli bir URL giriniz': 'أدخل عنوان URL صالحًا',
    'Gecerli bir kimlik degeri giriniz': 'أدخل معرّفًا صالحًا',
    'Gecersiz format': 'تنسيق غير صالح',
    'Gecersiz secim': 'اختيار غير صالح',
    'Bilinmeyen alan(lar)': 'حقل (حقول) غير معروف',
    'Gecersiz tarih': 'تاريخ غير صالح',
  },
}

/**
 * Tek bir TR mesaji verili locale'e cevir. Eslesme yoksa TR'yi aynen dondur.
 */
function translateValidationMessage(message: string, locale: string): string {
  if (locale === 'tr') return message
  const table = VALIDATION_I18N[locale as ValidationLocale]
  if (!table) return message
  return table[message] ?? message
}

/**
 * Hata mesajlarini kullanici dostu sekilde formatla.
 * locale (tr/en/de/ar) verilirse mesaj cevrilir; eslesme yoksa TR'ye duser.
 * Varsayilan 'tr' — geriye donuk uyumlu (eski davranis).
 */
export function formatZodError(error: z.ZodError, locale: string = 'tr'): string {
  const first = error.issues[0]
  if (!first) return translateValidationMessage('Gecersiz veri', locale)
  return translateValidationMessage(first.message, locale)
}
