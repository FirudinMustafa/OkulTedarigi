'use client'

import FadeIn from '@/components/motion/FadeIn'

// Önceki işbirliklerinde yer alan yayınevleri — yatay marquee olarak akıyor.
// Apple-style: sade, gri tipografi, yumuşak kenar fade, hover'da hafif renk.
const BRANDS = [
  'Oxford',
  'Cambridge',
  'Pearson',
  'Macmillan',
  'National Geographic',
  'Express Publishing',
] as const

export default function BrandScroll() {
  return (
    <section className="py-20 bg-white border-y border-apple-border/60 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <FadeIn>
          <h2 className="text-center text-2xl sm:text-3xl font-semibold tracking-tight text-apple-ink mb-12">
            İş birliklerimiz
          </h2>
        </FadeIn>

        <FadeIn delay={0.05}>
          <div
            className="relative"
            style={{
              maskImage:
                'linear-gradient(to right, transparent 0%, black 10%, black 90%, transparent 100%)',
              WebkitMaskImage:
                'linear-gradient(to right, transparent 0%, black 10%, black 90%, transparent 100%)',
            }}
          >
            <div className="flex gap-16 animate-brand-scroll whitespace-nowrap">
              {[...BRANDS, ...BRANDS].map((brand, index) => (
                <span
                  key={index}
                  className="flex-shrink-0 text-2xl sm:text-3xl font-semibold tracking-tight text-apple-gray/70 hover:text-apple-ink transition-colors cursor-default"
                >
                  {brand}
                </span>
              ))}
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  )
}
