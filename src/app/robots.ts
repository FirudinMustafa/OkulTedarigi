import type { MetadataRoute } from 'next'

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://okultedarigim.com'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/'],
        // Locale onekli ve oneksiz korunan/teknik yollar (tr/en/de/ar tum dillerde)
        disallow: [
          '/*/admin/',
          '/*/mudur/',
          '/*/odeme',
          '/*/paket/',
          '/*/siparis-onay/',
          '/admin/',
          '/mudur/',
          '/api/',
          '/odeme',
          '/paket/',
          '/siparis-onay/',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
