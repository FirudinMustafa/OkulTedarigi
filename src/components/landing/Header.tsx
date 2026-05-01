'use client'

import { useState } from 'react'
import Link from 'next/link'
import { List, X, Storefront, ArrowRight } from '@phosphor-icons/react'

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const navLinks = [
    { label: 'Nasıl Çalışır', href: '#nasil-calisir' },
    { label: 'Referanslar', href: '#referanslar' },
    { label: 'S.S.S', href: '#sss' },
    { label: 'Sipariş Takibi', href: '/siparis-takip' },
  ]

  // İki ayrı floating pill header: solda logo + nav linkleri,
  // sağda daha küçük Okul Paneli + Sipariş Ver pill'i. Her ikisi de
  // havada asılı gibi — rounded-full, backdrop-blur, hairline border, gölge.
  return (
    <header className="fixed top-0 left-0 right-0 z-50 pointer-events-none">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <div className="flex items-center justify-between gap-3">
          {/* Sol pill — logo + nav */}
          <div
            className="pointer-events-auto flex items-center gap-6 lg:gap-8 h-12 pl-5 pr-6 rounded-full backdrop-blur-xl shadow-[0_8px_24px_-12px_rgba(0,0,0,0.12)]"
          >
            <Link
              href="/"
              className="flex items-center gap-2 shrink-0"
              aria-label="okultedarigim.com ana sayfa"
            >
              <div className="relative w-7 h-7 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-red-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
                </svg>
                <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-amber-400 rounded-full flex items-center justify-center">
                  <svg className="w-1.5 h-1.5 text-amber-900" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                  </svg>
                </div>
              </div>
              <span className="text-[15px] font-semibold tracking-tight text-apple-ink">
                okultedarigim
                <span className="text-apple-blue">.com</span>
              </span>
            </Link>

            {/* Desktop Nav — logonun hemen yanında */}
            <nav className="hidden lg:flex items-center gap-7">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-[13px] font-normal text-apple-ink/80 hover:text-apple-ink transition-colors"
                >
                  {link.label}
                </a>
              ))}
            </nav>
          </div>

          {/* Sağ pill — Okul Paneli + Sipariş Ver (daha küçük) */}
          <div
            className="pointer-events-auto hidden sm:flex items-center gap-2 h-12 pl-4 pr-1.5 rounded-full backdrop-blur-xl shadow-[0_8px_24px_-12px_rgba(0,0,0,0.12)]"
          >
            <Link
              href="/mudur/login"
              className="hidden md:inline-flex items-center gap-1.5 text-[13px] font-normal text-apple-ink/80 hover:text-apple-ink transition-colors pr-1"
            >
              <Storefront weight="regular" className="w-4 h-4" />
              Okul Paneli
            </Link>

            <Link
              href="/siparis"
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-[#10b981] hover:bg-[#059669] text-white text-[13px] font-medium transition-colors"
            >
              Sipariş Ver
              <ArrowRight weight="bold" className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Mobile toggle — kendi küçük pill'inde */}
          <button
            type="button"
            aria-label={mobileMenuOpen ? 'Menüyü kapat' : 'Menüyü aç'}
            onClick={() => setMobileMenuOpen((v) => !v)}
            className="pointer-events-auto sm:hidden flex items-center justify-center w-12 h-12 rounded-full backdrop-blur-xl text-apple-ink hover:text-apple-blue transition-colors shadow-[0_8px_24px_-12px_rgba(0,0,0,0.12)]"
          >
            {mobileMenuOpen ? (
              <X weight="regular" className="w-5 h-5" />
            ) : (
              <List weight="regular" className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Mobile Menu — floating card */}
        <div
          className={`pointer-events-auto sm:hidden overflow-hidden transition-[max-height,opacity,margin] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            mobileMenuOpen ? 'max-h-[500px] opacity-100 mt-3' : 'max-h-0 opacity-0 mt-0'
          }`}
        >
          <div className="bg-white/90 backdrop-blur-xl border border-apple-border/60 rounded-3xl shadow-[0_8px_24px_-12px_rgba(0,0,0,0.12)] p-4">
            <nav className="flex flex-col gap-1">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-3 py-3 text-[15px] font-medium text-apple-ink hover:text-apple-blue transition-colors rounded-xl"
                >
                  {link.label}
                </a>
              ))}
              <Link
                href="/mudur/login"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-3 text-[15px] font-medium text-apple-ink hover:text-apple-blue transition-colors inline-flex items-center gap-2 rounded-xl"
              >
                <Storefront weight="regular" className="w-4 h-4" />
                Okul Paneli
              </Link>
              <div className="pt-3">
                <Link
                  href="/siparis"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-center gap-2 w-full h-11 rounded-full bg-[#10b981] hover:bg-[#059669] text-white text-[14px] font-medium transition-colors"
                >
                  Sipariş Ver
                  <ArrowRight weight="bold" className="w-4 h-4" />
                </Link>
              </div>
            </nav>
          </div>
        </div>
      </div>
    </header>
  )
}
