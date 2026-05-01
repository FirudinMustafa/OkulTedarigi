'use client'

import { useState } from 'react'
import { Plus } from '@phosphor-icons/react'

// Apple-stili accordion: hairline border-b, büyük soru, yumuşak aç/kapat.
// AI tropes (rounded cards, rotating badge) kaldırıldı.
export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  const faqs = [
    {
      question: 'Şifreyi nereden alacağım?',
      answer:
        'Sınıf şifrenizi okulunuzun idaresinden veya sınıf öğretmeninizden temin edebilirsiniz. Her sınıf için özel bir şifre tanımlanmıştır.',
    },
    {
      question: 'Ödeme güvenli mi?',
      answer:
        'Evet, tüm ödemeler 256-bit SSL şifrelemesi ve 3D Secure teknolojisi ile korunmaktadır. Kart bilgileriniz sistemimizde saklanmaz.',
    },
    {
      question: 'Teslimat ne kadar sürer?',
      answer:
        'Kargo ile teslimat 2-3 iş günü içinde gerçekleşir. Okula toplu teslimat seçeneğinde okul tarafından belirlenen tarihte teslim yapılır.',
    },
    {
      question: 'İade yapabilir miyim?',
      answer:
        'Kullanılmamış ve ambalajı açılmamış ürünler için 14 gün içinde iade talebinde bulunabilirsiniz.',
    },
    {
      question: 'Fatura alabilir miyim?',
      answer:
        'Evet, bireysel veya kurumsal fatura seçenekleri mevcuttur. Sipariş sırasında tercihini belirtmeniz yeterlidir.',
    },
  ]

  return (
    <section id="sss" className="py-24 lg:py-32 bg-apple-bg">
      <div className="max-w-3xl mx-auto px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <p className="text-[13px] font-medium text-[#10b981] mb-5 tracking-wide uppercase">
            S.S.S
          </p>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight text-apple-ink leading-[1.05]">
            <span className="text-gradient-green">Merak</span> edilenler
          </h2>
          <p className="mt-6 text-xl text-apple-gray">
            Sık sorulan sorular ve cevapları.
          </p>
        </div>

        {/* Accordion */}
        <div className="border-t border-apple-border/60">
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index
            return (
              <div key={index} className="border-b border-apple-border/60">
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  className="w-full flex items-center justify-between gap-6 py-6 text-left group"
                  aria-expanded={isOpen}
                >
                  <span className="text-lg md:text-xl font-medium text-apple-ink tracking-tight group-hover:text-[#10b981] transition-colors">
                    {faq.question}
                  </span>
                  <Plus
                    weight="regular"
                    className={`w-6 h-6 text-apple-ink flex-shrink-0 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                      isOpen ? 'rotate-45 text-[#10b981]' : 'rotate-0'
                    }`}
                  />
                </button>
                <div
                  className={`grid transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                    isOpen ? 'grid-rows-[1fr] opacity-100 pb-6' : 'grid-rows-[0fr] opacity-0'
                  }`}
                >
                  <div className="overflow-hidden">
                    <p className="text-[16px] text-apple-gray leading-relaxed pr-12">
                      {faq.answer}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
