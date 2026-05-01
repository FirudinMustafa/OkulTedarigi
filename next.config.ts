import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === 'production'

// Content Security Policy
// - Next.js inline script/style icin 'unsafe-inline' geriye uyumluluk gerekiyor (App Router runtime)
// - Iyzico, KolayBi, Aras Kargo, Twilio, Resend, Gemini API'leri icin connect-src whitelist
// - frame-ancestors 'none' (X-Frame-Options DENY ile birlikte clickjacking korumasi)
const cspDirectives = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "worker-src 'self' blob:",
  "connect-src 'self' blob: https://api.iyzipay.com https://sandbox-api.iyzipay.com https://api.kolaybi.com https://api.araskargo.com.tr https://api.twilio.com https://api.resend.com https://generativelanguage.googleapis.com",
  "frame-src 'self' blob: https://sandbox-api.iyzipay.com https://api.iyzipay.com",
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

export default nextConfig;
