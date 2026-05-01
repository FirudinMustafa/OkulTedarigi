import Link from 'next/link'
import { ShoppingBagOpen, MagnifyingGlass, ArrowRight } from '@phosphor-icons/react/dist/ssr'
import FadeIn from '@/components/motion/FadeIn'

// Apple-style "ready to get started": sade beyaz canvas, centered headline,
// tek gradient accent, primary pill + secondary text-link.
// AI tropes (kırmızı full-bleed gradient, floating books, glassmorphism) kaldırıldı.
export default function CTA() {
  return (
    <section id="basla" className="py-32 lg:py-40 bg-apple-panel">
      <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center">
        <FadeIn>
          <p className="text-[13px] font-medium text-[#10b981] mb-5 tracking-wide uppercase">
            Başla
          </p>
        </FadeIn>

        <FadeIn delay={0.05}>
          <h2 className="text-5xl sm:text-6xl lg:text-7xl font-semibold tracking-tight text-apple-ink leading-[1.02]">
            Siparişine
            <br />
            <span className="text-gradient-green">hazır mısın?</span>
          </h2>
        </FadeIn>

        <FadeIn delay={0.1}>
          <p className="mt-8 text-xl md:text-2xl text-apple-gray max-w-2xl mx-auto leading-snug">
            Okulundan aldığın şifreyi gir, paketini gör, ödemeyi tamamla.
            Üyelik gerekmiyor.
          </p>
        </FadeIn>

        <FadeIn delay={0.15}>
          <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-6">
            <Link
              href="/siparis"
              className="group inline-flex items-center gap-2 h-12 px-8 rounded-full bg-[#10b981] hover:bg-[#059669] text-white text-[15px] font-medium transition-colors"
            >
              <ShoppingBagOpen weight="regular" className="w-5 h-5" />
              Sipariş Ver
              <ArrowRight
                weight="bold"
                className="w-4 h-4 transition-transform group-hover:translate-x-0.5"
              />
            </Link>
            <Link
              href="/siparis-takip"
              className="group inline-flex items-center gap-1.5 h-12 px-6 rounded-full border border-apple-border bg-white text-apple-ink hover:border-apple-ink text-[15px] font-medium transition-colors"
            >
              <MagnifyingGlass weight="regular" className="w-4 h-4" />
              Sipariş Takip
            </Link>
          </div>
        </FadeIn>
      </div>
    </section>
  )
}
