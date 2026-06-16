import createMiddleware from 'next-intl/middleware'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { routing } from './i18n/routing'

const intlMiddleware = createMiddleware(routing)

// /tr, /en, /de, /ar onekini yakalar
const LOCALE_RE = /^\/(tr|en|de|ar)(?=\/|$)/

function stripLocale(pathname: string): { locale: string; rest: string } {
  const m = pathname.match(LOCALE_RE)
  if (m) {
    return { locale: m[1], rest: pathname.slice(m[0].length) || '/' }
  }
  return { locale: routing.defaultLocale, rest: pathname }
}

// Edge ortaminda getTranslations cagrilamaz; bu iki mesaj icin kucuk inline harita.
// apiErrors.common.unauthorized ile ayni string'ler (part dosyasinda da tutulur).
const UNAUTHORIZED: Record<string, string> = {
  tr: 'Yetkisiz erişim',
  en: 'Unauthorized access',
  de: 'Nicht autorisierter Zugriff',
  ar: 'وصول غير مصرّح به',
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // --- API rotalari: sadece auth, locale yonlendirmesi yok ---
  if (pathname.startsWith('/api')) {
    // API yolu locale oneki tasimaz; dili NEXT_LOCALE cerezinden al (fallback tr).
    const cookieLocale = request.cookies.get('NEXT_LOCALE')?.value
    const locale = cookieLocale && cookieLocale in UNAUTHORIZED ? cookieLocale : routing.defaultLocale
    if (pathname.startsWith('/api/admin')) {
      if (
        pathname === '/api/admin/auth/login' ||
        pathname === '/api/admin/auth/logout'
      ) {
        return NextResponse.next()
      }
      const token = request.cookies.get('token')?.value
      if (!token) {
        return NextResponse.json({ error: UNAUTHORIZED[locale] ?? UNAUTHORIZED.tr }, { status: 401 })
      }
    }
    if (pathname.startsWith('/api/mudur')) {
      if (
        pathname === '/api/mudur/auth/login' ||
        pathname === '/api/mudur/auth/logout'
      ) {
        return NextResponse.next()
      }
      const mudurToken = request.cookies.get('mudur_token')?.value
      if (!mudurToken) {
        return NextResponse.json({ error: UNAUTHORIZED[locale] ?? UNAUTHORIZED.tr }, { status: 401 })
      }
    }
    return NextResponse.next()
  }

  // --- Sayfa rotalari: once auth (locale onekini soyarak), sonra intl ---
  const { locale, rest } = stripLocale(pathname)

  // Admin panel auth: login sayfasi (/admin, /admin/login) token istemez
  if (rest === '/admin' || rest.startsWith('/admin/')) {
    const isPublic = rest === '/admin' || rest === '/admin/login'
    if (!isPublic) {
      const token = request.cookies.get('token')?.value
      if (!token) {
        return NextResponse.redirect(new URL(`/${locale}/admin`, request.url))
      }
    }
  }

  // Mudur panel auth
  if (rest === '/mudur' || rest.startsWith('/mudur/')) {
    const isPublic = rest === '/mudur' || rest === '/mudur/login'
    if (!isPublic) {
      const mudurToken = request.cookies.get('mudur_token')?.value
      if (!mudurToken) {
        return NextResponse.redirect(new URL(`/${locale}/mudur/login`, request.url))
      }
    }
  }

  return intlMiddleware(request)
}

export const config = {
  // Tum sayfa + api rotalari; _next, _vercel ve uzantili statik dosyalar haric
  matcher: ['/((?!_next|_vercel|.*\\..*).*)'],
}
