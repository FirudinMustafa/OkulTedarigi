import type { MetadataRoute } from 'next'
import { locales, defaultLocale } from '@/i18n/routing'

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://okultedarigim.com'

// Indekslenebilir herkese acik sayfalar (robots ile tutarli)
const PUBLIC_PATHS: { path: string; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency']; priority: number }[] = [
  { path: '', changeFrequency: 'weekly', priority: 1 },
  { path: '/siparis', changeFrequency: 'monthly', priority: 0.9 },
  { path: '/siparis-takip', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/kvkk', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/mesafeli-satis', changeFrequency: 'yearly', priority: 0.3 },
]

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date()
  const entries: MetadataRoute.Sitemap = []

  for (const { path, changeFrequency, priority } of PUBLIC_PATHS) {
    // Her sayfa icin tum diller; hreflang alternatifleri + x-default
    const languages: Record<string, string> = {}
    for (const loc of locales) {
      languages[loc] = `${SITE_URL}/${loc}${path}`
    }
    languages['x-default'] = `${SITE_URL}/${defaultLocale}${path}`

    for (const loc of locales) {
      entries.push({
        url: `${SITE_URL}/${loc}${path}`,
        lastModified,
        changeFrequency,
        priority,
        alternates: { languages },
      })
    }
  }

  return entries
}
