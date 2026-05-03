import Link from 'next/link'
import Image from 'next/image'
import { ShoppingBagOpen, ArrowRight, ShieldCheck } from '@phosphor-icons/react/dist/ssr'
import FadeIn from '@/components/motion/FadeIn'

// Desktop (lg+): 9 kolon × 6 satır = 54 hücrelik tam ızgara. 20 benzersiz ikondan
// 14 tanesi 3 kez, 6 tanesi 2 kez tekrarlanıyor → 14*3 + 6*2 = 54.
const ICON_SEQUENCE_DESKTOP: readonly number[] = [
  1, 2, 3, 4, 5, 6, 7, 8, 9,
  10, 11, 12, 13, 14, 15, 16, 17, 18,
  19, 20, 1, 2, 3, 4, 5, 6, 7,
  8, 9, 10, 11, 12, 13, 14, 15, 16,
  17, 18, 19, 20, 1, 2, 3, 4, 5,
  6, 7, 8, 9, 10, 11, 12, 13, 14,
]

// Tablet (md): 6 kolon × 6 satır = 36 hücre
const ICON_SEQUENCE_TABLET: readonly number[] = [
  1, 2, 3, 4, 5, 6,
  7, 8, 9, 10, 11, 12,
  13, 14, 15, 16, 17, 18,
  19, 20, 1, 2, 3, 4,
  5, 6, 7, 8, 9, 10,
  11, 12, 13, 14, 15, 16,
]

// Mobile: 4 kolon × 6 satır = 24 hücre
const ICON_SEQUENCE_MOBILE: readonly number[] = [
  1, 2, 3, 4,
  5, 6, 7, 8,
  9, 10, 11, 12,
  13, 14, 15, 16,
  17, 18, 19, 20,
  1, 5, 9, 13,
]

export default function Hero() {
  return (
    <section className="relative block h-screen min-h-[640px] md:min-h-[780px] w-full overflow-hidden bg-apple-bg">
      {/* 3D ikon arka planı — breakpoint'e göre farklı grid yoğunluğu.
          Mobile 4×6, tablet 6×6, desktop 9×6. Her hücre bir ikonla uçtan uca
          dolu (object-cover). Radial mask kenarlardaki koyu halo'yu yumuşatıyor. */}

      {/* Mobile grid */}
      <div
        className="absolute inset-0 z-0 grid grid-cols-4 grid-rows-6 md:hidden"
        aria-hidden="true"
      >
        {ICON_SEQUENCE_MOBILE.map((iconId, idx) => (
          <div key={idx} className="relative">
            <Image
              src={`/images/3dicons/icon-${iconId.toString().padStart(2, '0')}.png`}
              alt=""
              fill
              sizes="25vw"
              className="select-none object-cover"
              draggable={false}
            />
          </div>
        ))}
      </div>

      {/* Tablet grid */}
      <div
        className="absolute inset-0 z-0 hidden md:grid lg:hidden grid-cols-6 grid-rows-6"
        aria-hidden="true"
      >
        {ICON_SEQUENCE_TABLET.map((iconId, idx) => (
          <div key={idx} className="relative">
            <Image
              src={`/images/3dicons/icon-${iconId.toString().padStart(2, '0')}.png`}
              alt=""
              fill
              sizes="16vw"
              className="select-none object-cover"
              draggable={false}
            />
          </div>
        ))}
      </div>

      {/* Desktop grid — masaüstü tasarımı aynen korunuyor */}
      <div
        className="absolute inset-0 z-0 hidden lg:grid grid-cols-9 grid-rows-6"
        aria-hidden="true"
      >
        {ICON_SEQUENCE_DESKTOP.map((iconId, idx) => (
          <div key={idx} className="relative">
            <Image
              src={`/images/3dicons/icon-${iconId.toString().padStart(2, '0')}.png`}
              alt=""
              fill
              sizes="15vw"
              className="select-none object-cover"
              draggable={false}
            />
          </div>
        ))}
      </div>

      {/* Merkezde küçük, yumuşak spotlight — sadece headline/CTA bölgesini
          hafifçe aydınlatıyor, ikonları tamamen silmiyor. */}
      <div className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(ellipse_55%_42%_at_50%_50%,_rgba(251,251,253,0.95)_0%,_rgba(251,251,253,0.55)_55%,_transparent_92%)]" />

      {/* Content layer — section'ı full kaplıyor, flex ile dikey+yatay ortalama. */}
      <div className="relative z-10 flex h-full w-full items-center justify-center px-6 lg:px-8">
        <div className="w-full max-w-5xl text-center">
          <FadeIn delay={0.05}>
            <h1 className="text-gradient-green text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-semibold tracking-tight leading-[1.15] pb-2">
              Kaliteli hizmet için
              <br />
              doğru adres.
            </h1>
          </FadeIn>

          <FadeIn delay={0.1}>
            <p className="mt-8 text-xl md:text-2xl text-apple-ink/85 leading-snug max-w-2xl mx-auto font-medium">
              Okulunuzun belirlediği eğitim paketini tek tıkla sipariş edin.
              Şeffaf süreç, güvenli ödeme, eksiksiz teslimat.
            </p>
          </FadeIn>

          <FadeIn delay={0.15}>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-6">
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
              <a
                href="#nasil-calisir"
                className="group inline-flex items-center gap-1.5 text-[15px] font-medium text-[#10b981] hover:underline underline-offset-4"
              >
                Nasıl çalışıyor?
                <ArrowRight
                  weight="bold"
                  className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5"
                />
              </a>
            </div>
          </FadeIn>

          <FadeIn delay={0.2}>
            <p className="mt-6 text-[13px] text-apple-gray inline-flex items-center justify-center gap-1.5 w-full">
              <ShieldCheck weight="regular" className="w-4 h-4 text-apple-gray" />
              3D Secure ile güvenli ödeme
            </p>
          </FadeIn>
        </div>
      </div>
    </section>
  )
}
