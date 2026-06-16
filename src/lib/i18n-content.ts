// DB icerigi (admin'in girdigi katalog verisi) icin locale-aware okuma yardimcisi.
//
// Cevrilebilir alanlar icin semada `<field>_en`, `<field>_de`, `<field>_ar`
// nullable kolonlari var. Mevcut/temel alan (`<field>`) = Turkce.
// Bir cevirinin bos olmasi halinde Turkce'ye DUSULUR (fallback).

// Concrete TS interfaces (Package, ClassData vb.) index signature icermedigi icin
// record'u `any` aliyoruz; cagri tarafinda tip dostu, runtime'da guvenli (alan yoksa fallback).
export type Localizable = Record<string, unknown> | null | undefined

/**
 * Bir kaydin cevrilebilir alanini istenen dilde dondurur, bos ise TR tabana duser.
 * Ornek: getLocalized(pkg, 'name', 'en')  ->  pkg.name_en || pkg.name
 *        getLocalized(pkg, 'description', locale)
 */
export function getLocalized(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  record: any,
  field: string,
  locale: string
): string {
  if (!record) return ''
  const base = (record as Record<string, unknown>)[field]
  // TR varsayilan dil: dogrudan temel alan
  if (locale === 'tr') {
    return typeof base === 'string' ? base : base == null ? '' : String(base)
  }
  const translated = (record as Record<string, unknown>)[`${field}_${locale}`]
  if (typeof translated === 'string' && translated.trim().length > 0) {
    return translated
  }
  // Fallback: TR taban
  return typeof base === 'string' ? base : base == null ? '' : String(base)
}

/** Cevrilebilir alanlarin dil son ekleri (admin formlari + API icin) */
export const CONTENT_LOCALES = ['en', 'de', 'ar'] as const
export type ContentLocale = (typeof CONTENT_LOCALES)[number]

/**
 * Admin formundan gelen { en, de, ar } degerlerini Prisma create/update
 * data objesine cevirir: { name_en, name_de, name_ar }.
 * Bos string -> null (fallback'in calismasi icin).
 */
export function buildTranslationData(
  field: string,
  translations: Partial<Record<ContentLocale, string | null | undefined>> | undefined
): Record<string, string | null> {
  const data: Record<string, string | null> = {}
  if (!translations) return data
  for (const loc of CONTENT_LOCALES) {
    const v = translations[loc]
    data[`${field}_${loc}`] = v && v.trim().length > 0 ? v.trim() : null
  }
  return data
}
