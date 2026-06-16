import { cookies, headers } from 'next/headers'
import { routing } from '@/i18n/routing'

const SUPPORTED = routing.locales as readonly string[]

// API route'lari [locale] segmenti disinda; kullanicinin dilini once next-intl
// cerezinden (NEXT_LOCALE), sonra Referer yolundan (/en/...), sonra Accept-Language'tan,
// en son varsayilan (tr) belirler.
export async function getApiLocale(): Promise<string> {
  try {
    const c = await cookies()
    const fromCookie = c.get('NEXT_LOCALE')?.value
    if (fromCookie && SUPPORTED.includes(fromCookie)) return fromCookie
  } catch {}
  try {
    const h = await headers()
    const referer = h.get('referer') || ''
    const m = referer.match(/\/(tr|en|de|ar)(?:\/|\?|#|$)/)
    if (m && SUPPORTED.includes(m[1])) return m[1]
    const al = h.get('accept-language') || ''
    const first = al.split(',')[0]?.trim().split('-')[0]?.toLowerCase()
    if (first && SUPPORTED.includes(first)) return first
  } catch {}
  return routing.defaultLocale
}
