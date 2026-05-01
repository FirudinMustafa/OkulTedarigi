import FadeIn from '@/components/motion/FadeIn'

// Rakamlarla — kutusuz, çerçevesiz, saf tipografi. Başlık + açıklama
// sola hizalı; sayılar alta dev tipografi halinde açılıyor, aralarında
// sadece boşluk var.
const STATS = [
  { value: '150+', label: 'Okul' },
  { value: '12K+', label: 'Mutlu Öğrenci' },
  { value: '%99', label: 'Memnuniyet' },
  { value: '2-3 gün', label: 'Teslimat süresi' },
] as const

export default function Stats() {
  return (
    <section className="py-28 lg:py-40 bg-apple-bg">
      <div className="max-w-6xl mx-auto px-6 lg:px-8">
        <div className="max-w-3xl mb-20 lg:mb-28">
          <FadeIn>
            <p className="text-[13px] font-medium text-[#10b981] mb-5 tracking-wide uppercase">
              Rakamlarla
            </p>
          </FadeIn>
          <FadeIn delay={0.05}>
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight text-apple-ink leading-[1.05]">
              Yüzlerce okulun,{' '}
              <span className="text-gradient-green">on binlerce velinin</span>{' '}
              tercihi.
            </h2>
          </FadeIn>
          <FadeIn delay={0.1}>
            <p className="mt-7 text-lg lg:text-xl text-apple-gray leading-relaxed">
              Türkiye&apos;nin dört bir yanındaki okullarla çalışıyor, her sezon
              on binlerce öğrencinin ders kitabı ve kırtasiye ihtiyacını tek bir
              akışta buluşturuyoruz. Şeffaf süreç, güvenli ödeme ve hızlı
              teslimatla ailelerin yükünü hafifletiyor; okul idaresinin işini
              kolaylaştırıyoruz.
            </p>
          </FadeIn>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-y-12 gap-x-6 sm:gap-y-14 sm:gap-x-8">
          {STATS.map((item, i) => (
            <FadeIn key={item.label} delay={0.05 * i}>
              <div>
                <div className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-semibold tracking-tight text-apple-ink leading-none whitespace-nowrap tabular-nums">
                  {item.value}
                </div>
                <div className="mt-3 sm:mt-5 text-[13px] font-medium text-apple-gray tracking-wide uppercase">
                  {item.label}
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  )
}
