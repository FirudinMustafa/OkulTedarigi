import { defineRouting } from 'next-intl/routing'

// Desteklenen diller. 'tr' varsayilan, 'ar' RTL (sagdan sola).
export const locales = ['tr', 'en', 'de', 'ar'] as const
export type AppLocale = (typeof locales)[number]

export const defaultLocale: AppLocale = 'tr'

// RTL (sagdan sola) diller
export const rtlLocales: AppLocale[] = ['ar']

export function isRtl(locale: string): boolean {
  return rtlLocales.includes(locale as AppLocale)
}

export const routing = defineRouting({
  locales,
  defaultLocale,
  // Tum diller URL'de onek alir: /tr, /en, /de, /ar
  localePrefix: 'always',
  // Ilk ziyarette tarayici diline gore otomatik secim
  localeDetection: true,
})
