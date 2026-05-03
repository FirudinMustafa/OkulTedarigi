import Link from 'next/link'
import {
  Phone,
  EnvelopeSimple,
  Storefront,
  InstagramLogo,
  XLogo,
  ShieldCheck,
  ArrowRight,
} from '@phosphor-icons/react/dist/ssr'

// Apple-style footer: açık gri panel (apple-panel), sade hairline borders,
// tutarlı Phosphor ikon seti. Slate-900 koyu arka plan kaldırıldı.
export default function Footer() {
  return (
    <footer className="bg-white border-t border-apple-border/60">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-20">
        <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-12 mb-16">
          {/* Brand */}
          <div className="lg:col-span-2">
            <Link href="/" className="inline-flex items-center gap-2 mb-5">
              <div className="relative w-8 h-8 flex items-center justify-center flex-shrink-0">
                <svg className="w-7 h-7 text-red-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
                </svg>
                <div className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-amber-400 rounded-full flex items-center justify-center">
                  <svg className="w-2 h-2 text-amber-900" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                  </svg>
                </div>
              </div>
              <span className="text-xl font-semibold tracking-tight text-apple-ink">
                okultedarigim
                <span className="text-apple-blue">.com</span>
              </span>
            </Link>
            <p className="text-[15px] text-apple-gray max-w-md leading-relaxed mb-8">
              Okulların belirlediği, velilerin güvenle kullandığı kurumsal okul tedarik sistemi.
            </p>
            <div className="flex gap-3">
              <a
                href="#"
                aria-label="Instagram"
                className="w-10 h-10 rounded-full border border-apple-border/60 flex items-center justify-center text-apple-gray hover:text-apple-ink hover:border-apple-ink transition-colors"
              >
                <InstagramLogo weight="regular" className="w-4 h-4" />
              </a>
              <a
                href="#"
                aria-label="X"
                className="w-10 h-10 rounded-full border border-apple-border/60 flex items-center justify-center text-apple-gray hover:text-apple-ink hover:border-apple-ink transition-colors"
              >
                <XLogo weight="regular" className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Nav links */}
          <div>
            <h4 className="text-[13px] font-semibold text-apple-ink mb-6 tracking-wide uppercase">
              Bağlantılar
            </h4>
            <ul className="space-y-3 text-[14px]">
              <li>
                <Link
                  href="/#nasil-calisir"
                  className="group inline-flex items-center gap-1 text-apple-gray hover:text-apple-ink transition-colors"
                >
                  Nasıl Çalışır
                  <ArrowRight
                    weight="bold"
                    className="w-3 h-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all"
                  />
                </Link>
              </li>
              <li>
                <Link
                  href="/#referanslar"
                  className="group inline-flex items-center gap-1 text-apple-gray hover:text-apple-ink transition-colors"
                >
                  Referanslar
                  <ArrowRight
                    weight="bold"
                    className="w-3 h-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all"
                  />
                </Link>
              </li>
              <li>
                <Link
                  href="/#sss"
                  className="group inline-flex items-center gap-1 text-apple-gray hover:text-apple-ink transition-colors"
                >
                  S.S.S
                  <ArrowRight
                    weight="bold"
                    className="w-3 h-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all"
                  />
                </Link>
              </li>
              <li>
                <Link
                  href="/siparis"
                  className="group inline-flex items-center gap-1 text-apple-gray hover:text-apple-ink transition-colors"
                >
                  Sipariş Ver
                  <ArrowRight
                    weight="bold"
                    className="w-3 h-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all"
                  />
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-[13px] font-semibold text-apple-ink mb-6 tracking-wide uppercase">
              İletişim
            </h4>
            <ul className="space-y-4 text-[14px]">
              <li>
                <a
                  href="tel:+905497747137"
                  className="inline-flex items-center gap-2.5 text-apple-gray hover:text-apple-ink transition-colors"
                >
                  <Phone weight="regular" className="w-4 h-4" />
                  +90 549 774 71 37
                </a>
              </li>
              <li>
                <a
                  href="mailto:destek@okultedarigim.com"
                  className="inline-flex items-center gap-2.5 text-apple-gray hover:text-apple-ink transition-colors"
                >
                  <EnvelopeSimple weight="regular" className="w-4 h-4" />
                  destek@okultedarigim.com
                </a>
              </li>
            </ul>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-[13px] font-semibold text-apple-ink mb-6 tracking-wide uppercase">
              Hızlı Erişim
            </h4>
            <ul className="space-y-3 text-[14px]">
              <li>
                <Link
                  href="/siparis-takip"
                  className="group inline-flex items-center gap-1 text-apple-gray hover:text-apple-ink transition-colors"
                >
                  Sipariş Takip
                  <ArrowRight
                    weight="bold"
                    className="w-3 h-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all"
                  />
                </Link>
              </li>
              <li>
                <Link
                  href="/kvkk"
                  className="group inline-flex items-center gap-1 text-apple-gray hover:text-apple-ink transition-colors"
                >
                  KVKK Aydınlatma
                  <ArrowRight
                    weight="bold"
                    className="w-3 h-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all"
                  />
                </Link>
              </li>
              <li>
                <Link
                  href="/mesafeli-satis"
                  className="group inline-flex items-center gap-1 text-apple-gray hover:text-apple-ink transition-colors"
                >
                  Mesafeli Satış
                  <ArrowRight
                    weight="bold"
                    className="w-3 h-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all"
                  />
                </Link>
              </li>
              <li className="pt-4 mt-4 border-t border-apple-border/60">
                <Link
                  href="/mudur/login"
                  className="inline-flex items-center gap-1.5 text-apple-blue hover:underline underline-offset-4 font-medium"
                >
                  <Storefront weight="regular" className="w-4 h-4" />
                  Okul Paneli
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="pt-8 border-t border-apple-border/60 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-[12px] text-apple-gray">
            © 2026 okultedarigim.com — Tüm hakları saklıdır.
          </p>
          <div className="inline-flex items-center gap-1.5 text-[12px] text-apple-gray">
            <ShieldCheck weight="regular" className="w-4 h-4" />
            3D Secure • SSL şifreli ödeme
          </div>
        </div>
      </div>
    </footer>
  )
}
