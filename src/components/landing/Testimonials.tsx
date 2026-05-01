import { Star } from '@phosphor-icons/react/dist/ssr'
import FadeIn from '@/components/motion/FadeIn'

// Referanslar — Apple-style testimonial gridi. Büyük, nefes alan
// typography; kutu yerine hafif hairline + gölge; sade avatar rozeti
// (baş harfi). Yorumlar okul idaresi ve veli perspektiflerinden,
// sitenin vaadiyle uyumlu: şeffaflık, kolay sipariş, güvenli ödeme,
// zamanında teslimat.
const TESTIMONIALS = [
  {
    quote:
      'Her sezon başında kitap listesi karmaşası yaşıyorduk. Artık velilere tek bir şifre gönderiyoruz, sistem gerisini hallediyor. İdari yükümüz belirgin şekilde azaldı.',
    name: 'Elif Kaya',
    role: 'Müdür Yardımcısı',
  },
  {
    quote:
      'İki çocuğum için ayrı ayrı listelerle kırtasiye kırtasiye dolaşmaktan kurtuldum. Şifreyi girdim, paketi gördüm, ödedim. Üç gün sonra tüm kitaplar kapımdaydı.',
    name: 'Murat Demir',
    role: 'Veli',
  },
  {
    quote:
      'En sevdiğimiz taraf şeffaflık. Hangi kitap hangi yayınevinden, fiyatı ne, nereden çıkıyor — hepsi açık. 3D Secure ödeme ailelere de bize de güven veriyor.',
    name: 'Ayşe Yıldız',
    role: 'Okul Müdürü',
  },
  {
    quote:
      'Geçen yıl kargo takibini sürekli soran velilerle uğraşıyorduk. Bu sene her adımda SMS gidiyor, kimse aramıyor bile. Bizim için muazzam bir rahatlama.',
    name: 'Serkan Aydın',
    role: 'İdari İşler Sorumlusu',
  },
  {
    quote:
      'İlk kez online kitap siparişi verdim, tereddütlüydüm. Ama arayüz o kadar sade ki annem bile tek başına yapabildi. Ödeme de hızlı ve güvenliydi.',
    name: 'Zeynep Arslan',
    role: 'Veli',
  },
  {
    quote:
      'Okul olarak farklı yayınevleriyle ayrı ayrı anlaşmak yerine tek bir paket tanımlıyoruz. Velilere gönderilen fiyat da şeffaf — hiçbir gizli kalem yok.',
    name: 'Burak Şahin',
    role: 'Müdür',
  },
] as const

export default function Testimonials() {
  return (
    <section id="referanslar" className="py-24 lg:py-32 bg-apple-panel">
      <div className="max-w-6xl mx-auto px-6 lg:px-8">
        <div className="max-w-3xl mb-20 lg:mb-24">
          <FadeIn>
            <p className="text-[13px] font-medium text-[#10b981] mb-5 tracking-wide uppercase">
              Referanslar
            </p>
          </FadeIn>
          <FadeIn delay={0.05}>
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight text-apple-ink leading-[1.05]">
              Kullanıcılarımız{' '}
              <span className="text-gradient-green">ne diyor?</span>
            </h2>
          </FadeIn>
          <FadeIn delay={0.1}>
            <p className="mt-7 text-lg lg:text-xl text-apple-gray leading-relaxed">
              Türkiye&apos;nin dört bir yanındaki okul idarecileri ve veliler,
              okultedarigim.com ile sipariş sürecini nasıl kolaylaştırdıklarını
              anlatıyor.
            </p>
          </FadeIn>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {TESTIMONIALS.map((t, i) => (
            <FadeIn key={t.name} delay={0.05 * i}>
              <figure className="h-full bg-white rounded-[28px] border border-apple-border/60 shadow-[0_12px_32px_-20px_rgba(0,0,0,0.15)] p-8 lg:p-10 flex flex-col">
                <div className="flex items-center gap-1 mb-6">
                  {Array.from({ length: 5 }).map((_, idx) => (
                    <Star
                      key={idx}
                      weight="fill"
                      className="w-[18px] h-[18px] text-[#f59e0b]"
                    />
                  ))}
                </div>
                <blockquote className="flex-1">
                  <p className="text-[17px] lg:text-lg text-apple-ink leading-relaxed tracking-tight">
                    &ldquo;{t.quote}&rdquo;
                  </p>
                </blockquote>
                <figcaption className="mt-8">
                  <div className="text-[14px] font-semibold text-apple-ink">
                    {t.name}
                  </div>
                  <div className="text-[12px] text-apple-gray">{t.role}</div>
                </figcaption>
              </figure>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  )
}
