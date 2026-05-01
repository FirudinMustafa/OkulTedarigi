'use client'

import { useRef } from 'react'
import Image from 'next/image'
import { motion, useScroll, useTransform, useSpring, type MotionValue } from 'framer-motion'

// Süreç kartları — tek sticky wrapper + scroll-driven animasyon.
// Outer container ~(STEPS.length + 1) × 100vh yüksekliğinde, içinde
// h-screen sticky bir "sahne" var. Header sahne üstünde, kartlar
// sahne ortasında. Her kart scroll progress'ine göre aşağıdan
// gelip ortalanıyor; bir sonraki kart gelince küçük bir peek offset
// bırakıp üstünde duruyor.

const STEPS = [
  {
    num: '1',
    title: 'Okul paketi oluşturur',
    desc: 'Okul idaresi, sınıf bazında ders kitapları ve yardımcı kaynakları belirler, sistemde paket olarak tanımlar.',
    iconA: '/images/surec/1.1.png',
    iconB: '/images/surec/1.2.png',
  },
  {
    num: '2',
    title: 'Şifre velilere ulaşır',
    desc: 'Her sınıf için benzersiz sipariş şifresi oluşturulur ve SMS/e-posta ile velilere güvenle iletilir.',
    iconA: '/images/surec/2.1.png',
    iconB: '/images/surec/2.2.png',
  },
  {
    num: '3',
    title: 'Veli siparişi tamamlar',
    desc: 'Veli, şifre ile pakete erişir, içeriği inceler ve 3D Secure ile güvenli ödeme yapar.',
    iconA: '/images/surec/3.1.png',
    iconB: '/images/surec/3.2.png',
  },
  {
    num: '4',
    title: 'Kitaplar teslim edilir',
    desc: 'Siparişler okula toplu ya da kargo ile eve teslim edilir. Her adım şeffafça takip edilir.',
    iconA: '/images/surec/4.1.png',
    iconB: '/images/surec/4.2.png',
  },
] as const

// 1. kart en başından itibaren sahnede sabit duruyor. 2–4. kartlar sırayla
// aşağıdan gelip üstüne stacklenir. Toplam slot = STEPS.length: (total-1)
// animasyon slotu + 1 breathing room slotu.
const TOTAL_SLOTS = STEPS.length

export default function Process() {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end end'],
  })

  return (
    <section id="nasil-calisir" className="bg-apple-panel">
      {/* Tall outer — scroll-driven animasyonun süresi */}
      <div
        ref={ref}
        className="relative"
        style={{ height: `${TOTAL_SLOTS * 100}vh` }}
      >
        {/* Sticky sahne — tam ekran, top-0, içinde header + kartlar */}
        <div className="sticky top-0 h-screen overflow-hidden">
          {/* Header — sahnenin üstünde sabit */}
          <div className="absolute inset-x-0 top-0 pt-16 px-6 lg:px-8 z-40">
            <div className="max-w-3xl mx-auto text-center">
              <p className="text-[13px] font-medium text-[#10b981] mb-5 tracking-wide uppercase">
                Süreç
              </p>
              <h2 className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight text-apple-ink leading-[1.05]">
                Dört adımda,
                <br />
                <span className="text-gradient-green">baştan sona şeffaf.</span>
              </h2>
            </div>
          </div>

          {/* Kartlar — merkezde üst üste binmiş */}
          <div className="absolute inset-0 flex items-center justify-center px-6 lg:px-8">
            <div className="relative w-full max-w-4xl h-[440px]">
              {STEPS.map((step, i) => (
                <ProcessCard
                  key={step.num}
                  step={step}
                  index={i}
                  total={STEPS.length}
                  progress={scrollYProgress}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function ProcessCard({
  step,
  index,
  total,
  progress,
}: {
  step: (typeof STEPS)[number]
  index: number
  total: number
  progress: MotionValue<number>
}) {
  // 1. kart (index 0) en başından itibaren stack pozisyonunda sabit duruyor.
  // Diğer kartlar slot [(index-1)/total, index/total] aralığında aşağıdan
  // gelip üste stacklenir. Son slot breathing room.
  const start = Math.max(0, (index - 1) / total)
  const end = Math.max(0, index / total)

  // translateY: aşağıdan gelsin — viewport-unit ile %100vh kadar aşağıdan
  // başlar, tam 0'a gelir. Sticky wrapper'ın overflow-hidden'ı clip eder.
  // 1. kart hep 0'da durur (start == end olduğundan hareket etmez).
  const y = useTransform(
    progress,
    [start, end],
    [index === 0 ? '0vh' : '100vh', '0vh'],
    { clamp: true }
  )

  // Spring ile yumusatma — scroll momentum'undaki sıçramaları yumuşatır.
  // Critically-damped: overshoot yok, son pozisyonu degismedi, sadece geçiş smooth.
  const ySmooth = useSpring(y, { stiffness: 120, damping: 30, mass: 0.4 })

  // Progressive peek offset — sonraki kart öncekinin biraz altına oturur.
  const peek = index * 16

  return (
    <motion.div
      className="absolute inset-0"
      style={{
        y: ySmooth,
        top: `${peek}px`,
        zIndex: 10 + index,
      }}
    >
      <div className="relative bg-white rounded-[32px] border border-apple-border/60 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.25)] h-[440px] overflow-hidden">
        <div className="relative p-10 md:p-14 lg:p-16 h-full">
          {/* Content */}
          <div className="relative z-10 h-full flex flex-col items-center justify-center text-center md:h-auto md:flex-row md:items-center md:justify-start md:text-left md:gap-10 lg:gap-12 md:max-w-2xl">
            <span className="shrink-0 text-[64px] md:text-[88px] lg:text-[104px] font-semibold text-gradient-green leading-[0.85] tracking-tight">
              {step.num}
            </span>
            <div className="mt-2 md:mt-0 min-w-0">
              <h3 className="text-2xl md:text-4xl lg:text-5xl font-semibold text-apple-ink tracking-tight leading-[1.08]">
                {step.title}
              </h3>
              <p className="mt-3 md:mt-4 text-[15px] md:text-lg text-apple-gray leading-relaxed max-w-md mx-auto md:mx-0">
                {step.desc}
              </p>
            </div>
          </div>

          {/* Icon A — top-right */}
          <div className="pointer-events-none absolute top-6 right-6 md:top-10 md:right-10 w-24 h-24 md:w-32 md:h-32 lg:w-40 lg:h-40">
            <Image
              src={step.iconA}
              alt=""
              fill
              sizes="160px"
              className="object-contain drop-shadow-[0_12px_28px_rgba(0,0,0,0.18)]"
            />
          </div>

          {/* Icon B — bottom-left */}
          <div className="pointer-events-none absolute bottom-6 left-6 md:bottom-10 md:left-10 w-24 h-24 md:w-32 md:h-32 lg:w-40 lg:h-40">
            <Image
              src={step.iconB}
              alt=""
              fill
              sizes="160px"
              className="object-contain drop-shadow-[0_12px_28px_rgba(0,0,0,0.18)]"
            />
          </div>
        </div>
      </div>
    </motion.div>
  )
}
