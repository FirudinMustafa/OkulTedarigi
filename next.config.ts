import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const isProduction = process.env.NODE_ENV === 'production'

// Content Security Policy
// - Next.js inline script/style icin 'unsafe-inline' geriye uyumluluk gerekiyor (App Router runtime)
// - PayNKolay, KolayBi, Yurtici Kargo, Twilio, Resend, Gemini API'leri icin connect-src whitelist
// - PayNKolay 3D formu banka domain'lerine yonlenebildiginden form-action/frame-src genis tutulur
// - frame-ancestors 'none' (X-Frame-Options DENY ile birlikte clickjacking korumasi)
const cspDirectives = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  // PayNKolay'in 3D formu bankanin 3DS sayfasina POST eder; banka domain'leri onceden bilinemez.
  "form-action 'self' https://paynkolay.nkolayislem.com.tr https://paynkolaytest.nkolayislem.com.tr https:",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "worker-src 'self' blob:",
  "connect-src 'self' blob: https://paynkolay.nkolayislem.com.tr https://paynkolaytest.nkolayislem.com.tr https://api.kolaybi.com https://ofis-api.kolaybi.com https://ofis-sandbox-api.kolaybi.com https://webservices.yurticikargo.com https://api.twilio.com https://api.resend.com https://generativelanguage.googleapis.com",
  // 3DS banka pencereleri farkli domain'lerde acilir.
  "frame-src 'self' blob: https://paynkolay.nkolayislem.com.tr https://paynkolaytest.nkolayislem.com.tr https:",
].join('; ')

const securityHeaders = [
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
  },
  {
    key: 'Content-Security-Policy',
    value: cspDirectives,
  },
  ...(isProduction ? [
    {
      key: 'Strict-Transport-Security',
      value: 'max-age=63072000; includeSubDomains; preload',
    },
  ] : []),
]

const nextConfig: NextConfig = {
  // DEV-ONLY: cloudflared tunnel domaininden gelen /_next/* dev kaynaklarina izin ver
  // (sandbox testinde tarayici tunel uzerinden eristiginde hydration icin gerekli).
  // Prod'u etkilemez.
  allowedDevOrigins: ['*.trycloudflare.com', 'laugh-fabrics-cedar-organizational.trycloudflare.com'],
  turbopack: {
    root: __dirname,
  },
  poweredByHeader: false,
  compress: true,
  images: {
    remotePatterns: [],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
};

export default withNextIntl(nextConfig);
