import Link from 'next/link'
import { ArrowLeft } from '@phosphor-icons/react/dist/ssr'

// =====================================================================
// SATICI BİLGİLERİ — DOLDURUN
// Bu metin 6502 sayılı Tüketicinin Korunması Hakkında Kanun ve Mesafeli
// Sözleşmeler Yönetmeliği uyarınca hazırlanmıştır. Üretime almadan önce
// avukat onayından geçirin. Aşağıdaki placeholder'ları doldurun.
// =====================================================================
const SELLER = {
  legalName: '[Ticaret Unvanı / Şahıs Adı]',
  brand: 'OkulTedarigim',
  taxOffice: '[Vergi Dairesi]',
  taxNumber: '[Vergi Numarası]',
  mersis: '[MERSİS No (varsa)]',
  address: '[Tam Adres]',
  email: 'destek@okultedarigim.com',
  phone: '+90 549 774 71 37',
  website: 'okultedarigim.com',
  esnafSicilNo: '[Esnaf Sicil No (şahıs şirketi ise)]',
}

export default function MesafeliSatisPage() {
  return (
    <div className="min-h-screen bg-white overflow-x-clip">
      <LegalHeader />

      <main className="pt-36 pb-24 px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="mb-16">
            <p className="text-[13px] font-medium text-apple-gray mb-5 tracking-wide uppercase">
              Yasal
            </p>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight text-apple-ink leading-[1.05]">
              Mesafeli satış sözleşmesi
            </h1>
            <p className="mt-6 text-lg lg:text-xl text-apple-gray leading-relaxed">
              6502 sayılı Tüketicinin Korunması Hakkında Kanun ve Mesafeli Sözleşmeler Yönetmeliği
              uyarınca hazırlanmış; satıcı ile alıcı arasındaki hak ve yükümlülükleri düzenleyen
              sözleşme metni.
            </p>
          </div>

          <div className="space-y-14 text-[17px] text-apple-gray leading-relaxed">

            <Section title="1. Taraflar">
              <p>İşbu sözleşme aşağıdaki taraflar arasında akdedilmiştir.</p>

              <h3 className="text-lg font-semibold text-apple-ink mt-5 mb-2">1.1. Satıcı</h3>
              <InfoBox>
                <p><span className="text-apple-ink font-medium">Ticaret Unvanı:</span> {SELLER.legalName}</p>
                <p><span className="text-apple-ink font-medium">Marka:</span> {SELLER.brand}</p>
                <p><span className="text-apple-ink font-medium">Vergi Dairesi / No:</span> {SELLER.taxOffice} / {SELLER.taxNumber}</p>
                <p><span className="text-apple-ink font-medium">MERSİS No:</span> {SELLER.mersis}</p>
                <p><span className="text-apple-ink font-medium">Adres:</span> {SELLER.address}</p>
                <p><span className="text-apple-ink font-medium">E-posta:</span> {SELLER.email}</p>
                <p><span className="text-apple-ink font-medium">Telefon:</span> {SELLER.phone}</p>
                <p><span className="text-apple-ink font-medium">Web:</span> {SELLER.website}</p>
              </InfoBox>

              <h3 className="text-lg font-semibold text-apple-ink mt-5 mb-2">1.2. Alıcı (Tüketici)</h3>
              <p>
                Sipariş formunda kimlik, iletişim ve teslimat bilgilerini beyan eden gerçek/tüzel
                kişi. Sözleşme tarafı olan veli/yasal temsilci, öğrencinin kişisel verilerinin
                paylaşılması konusunda yetkili olduğunu beyan eder.
              </p>
            </Section>

            <Section title="2. Sözleşmenin Konusu">
              <p>
                İşbu sözleşmenin konusu; Alıcı&apos;nın Satıcı&apos;ya ait <strong>{SELLER.website}</strong>
                internet sitesinden elektronik ortamda siparişini verdiği, nitelikleri ve satış
                fiyatı sipariş onayında belirtilen okul tedarik paketinin satışı ve teslimi ile
                ilgili olarak, tarafların hak ve yükümlülüklerinin düzenlenmesidir.
              </p>
            </Section>

            <Section title="3. Sözleşmeye Konu Mal/Hizmet">
              <p>
                Mal/hizmetin <strong>türü, miktarı, marka/modeli, içeriği, KDV dahil satış bedeli</strong>
                ve <strong>ödeme şekli</strong> sipariş formunda ve sipariş onay e-postasında belirtilmiştir.
                Tüm fiyatlar KDV dahildir. Türk Lirası (₺) cinsindendir.
              </p>
              <p className="mt-3">
                Paketler, ilgili okulun ve sınıfın ihtiyaçları doğrultusunda Satıcı tarafından
                önceden belirlenmiş içeriktedir. Paket içerisinde yer alan ürünlerin görsel
                temsilleri tanıtım amaçlıdır; renk ve marka detayında küçük farklılıklar olabilir.
              </p>
            </Section>

            <Section title="4. Genel Hükümler">
              <p>
                Alıcı; Satıcı&apos;ya ait internet sitesinde satış sözleşmesine konu ürünün temel
                nitelikleri, satış fiyatı (KDV dahil), ödeme şekli, teslimata ilişkin ön
                bilgilendirmeleri okuyup bilgi sahibi olduğunu, elektronik ortamda gerekli teyidi
                verdiğini kabul, beyan ve taahhüt eder. Alıcı&apos;nın siparişi tamamlaması; bu
                sözleşme ve KVKK aydınlatma metnini kabul ettiği anlamına gelir.
              </p>
            </Section>

            <Section title="5. Cayma Hakkı">
              <p>
                Alıcı; ürünün kendisine veya gösterdiği adresteki kişi/kuruluşa teslim tarihinden
                itibaren <strong>14 (ondört) gün</strong> içinde herhangi bir gerekçe göstermeksizin ve cezai
                şart ödemeksizin sözleşmeden cayma hakkına sahiptir.
              </p>
              <p className="mt-3">
                Cayma hakkı, aşağıdaki kanaldan kullanılabilir:
              </p>
              <List
                items={[
                  `E-posta: ${SELLER.email} adresine, sipariş numarası ve cayma talebini açıkça belirten bir bildirim`,
                  'Sipariş takip sayfası üzerinden iptal talebi formu',
                ]}
              />
              <p className="mt-3">
                Cayma hakkının kullanılabilmesi için ürünlerin <strong>kullanılmamış, ambalajının
                açılmamış</strong> ve yeniden satılabilir durumda olması gerekir. Ürünlerin Alıcı
                tarafından sökülmüş, yıpratılmış, kullanılmış olması veya niteliği itibariyle iade
                edilemeyen ürünler haline gelmiş olması durumunda cayma hakkı kullanılamaz.
              </p>
            </Section>

            <Section title="6. Cayma Hakkının İstisnaları (Yön. m. 15)">
              <p>
                Mesafeli Sözleşmeler Yönetmeliği&apos;nin 15. maddesi gereği, aşağıdaki ürünler için
                cayma hakkı kullanılamaz:
              </p>
              <List
                items={[
                  'Tüketicinin istekleri veya açıkça onun kişisel ihtiyaçları doğrultusunda hazırlanan, kişiye özel hazırlanmış mallar',
                  'Tesliminden sonra ambalaj, bant, mühür, paket gibi koruyucu unsurları açılmış olan, iadesi sağlık ve hijyen açısından uygun olmayan ürünler',
                  'Tesliminden sonra başka ürünlerle karışan ve doğası gereği ayrıştırılması mümkün olmayan ürünler',
                ]}
              />
              <p className="mt-3">
                Okula özel hazırlanmış öğrenci paketleri, paket Alıcıya/öğrenciye ulaştırılıp
                ambalajı açıldıktan sonra <strong>kişiye özel hazırlanmış mal</strong> niteliği kazanabilir;
                bu durumda cayma hakkının kullanımı sınırlanabilir. Bu istisna her sipariş için
                öncesinde Alıcı&apos;ya açıkça bildirilir.
              </p>
            </Section>

            <Section title="7. Teslimat">
              <p>
                Sipariş onayının ardından, ödeme onayını takiben en geç <strong>30 (otuz) gün</strong> içinde
                teslimat gerçekleştirilir. Teslimat seçenekleri:
              </p>
              <List
                items={[
                  'Okula toplu teslim — okul tarafından belirlenen tarihte, sınıf öğretmeni veya idare aracılığıyla; teslim alındı belgesi düzenlenir',
                  'Kargo ile eve teslim — Aras Kargo aracılığıyla, sipariş onayından itibaren 2-4 iş günü içinde, sipariş formundaki adrese',
                ]}
              />
              <p className="mt-3">
                Kargo ücreti varsa sipariş özetinde belirtilir. Belirtilmemişse, kargo ücreti
                paket fiyatına dahildir. Adres yanlışlığından doğan ek kargo masrafları Alıcıya
                aittir.
              </p>
            </Section>

            <Section title="8. Ödeme">
              <p>
                Ödeme; banka/kredi kartı ile online olarak, lisanslı ödeme kuruluşu (Iyzico) ve
                3D Secure altyapısı üzerinden gerçekleştirilir. Kart bilgileri Satıcı sistemlerinde
                saklanmaz, doğrudan ödeme kuruluşuna iletilir.
              </p>
            </Section>

            <Section title="9. İade ve Geri Ödeme">
              <p>
                Cayma hakkı kapsamındaki iadeler, ürünün Satıcıya ulaşmasından itibaren en geç
                <strong> 14 (ondört) iş günü</strong> içinde, ödemenin yapıldığı kart/hesap iadesi şeklinde
                yapılır. Bankanın ödemeyi hesaba yansıtma süresi Satıcı kontrolü dışındadır.
              </p>
              <p className="mt-3">
                İade kargo bedeli, cayma hakkı kullanımında — sipariş Alıcının açık tercihi ile
                kargo seçeneğinde verilmiş ve ürün ayıpsız ise — Alıcıya aittir.
              </p>
            </Section>

            <Section title="10. Uyuşmazlıkların Çözümü">
              <p>
                Bu sözleşmeden doğan uyuşmazlıklarda, Ticaret Bakanlığı tarafından her yıl ilan
                edilen <strong>parasal sınırlara göre Tüketici Hakem Heyetleri</strong> ya da <strong>Tüketici
                Mahkemeleri</strong> yetkilidir. 2025 yılı itibarıyla parasal sınırlar:
              </p>
              <List
                items={[
                  'İlçe Tüketici Hakem Heyeti: belirlenen değer altındaki uyuşmazlıklar',
                  'İl Tüketici Hakem Heyeti: orta değer aralığındaki uyuşmazlıklar',
                  'Tüketici Mahkemeleri: üst sınırı aşan uyuşmazlıklar',
                ]}
              />
              <p className="mt-3">
                Güncel parasal sınırlar Ticaret Bakanlığı tüketici sayfasında (ticaret.gov.tr) yer
                almaktadır.
              </p>
            </Section>

            <Section title="11. Şikâyet ve İletişim">
              <p>Şikayet ve sorularınız için:</p>
              <List
                items={[
                  `E-posta: ${SELLER.email}`,
                  `Telefon: ${SELLER.phone}`,
                  'Tüketici Bilgi Sistemi: tuketici.ticaret.gov.tr',
                  'Alo 175 — Tüketici Danışma Hattı',
                ]}
              />
            </Section>

            <Section title="12. Yürürlük">
              <p>
                İşbu Mesafeli Satış Sözleşmesi, Alıcı&apos;nın elektronik ortamda onaylaması ile
                yürürlüğe girer. Sözleşmenin bir nüshası, Alıcı&apos;nın e-posta adresine sipariş onay
                bildirimiyle birlikte iletilir. Tarafların bu sözleşmenin uygulanmasından doğan
                yükümlülükleri, sipariş bedelinin tahsili ve ürün/paketin teslimi ile sona erer.
                Cayma ve iade hakları saklıdır.
              </p>
            </Section>

            <p className="text-[13px] text-apple-gray/80 pt-10 border-t border-apple-border/60">
              Bu sözleşme, sipariş tarihinde elektronik ortamda taraflarca okunup kabul edilmiştir.
              Son güncelleme tarihi: Nisan 2026 — Sürüm 2.0
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-2xl md:text-3xl font-semibold text-apple-ink tracking-tight mb-4">
        {title}
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  )
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="mt-3 space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3">
          <span className="mt-[11px] w-1 h-1 rounded-full bg-apple-ink/40 flex-shrink-0" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-2 p-5 rounded-2xl bg-apple-panel border border-apple-border/60 space-y-1.5 text-[15px]">
      {children}
    </div>
  )
}

// ==================== LEGAL HEADER ====================
function LegalHeader() {
  const navLinks = [
    { label: 'Nasıl Çalışır', href: '/#nasil-calisir' },
    { label: 'Referanslar', href: '/#referanslar' },
    { label: 'S.S.S', href: '/#sss' },
    { label: 'Sipariş Takibi', href: '/siparis-takip' },
  ]

  return (
    <header className="fixed top-0 left-0 right-0 z-50 pointer-events-none">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <div className="flex items-center justify-between gap-3">
          <div className="pointer-events-auto flex items-center gap-6 lg:gap-8 h-12 pl-5 pr-6 rounded-full backdrop-blur-xl shadow-[0_8px_24px_-12px_rgba(0,0,0,0.12)]">
            <Link href="/" className="flex items-center gap-2 shrink-0" aria-label="okultedarigim.com ana sayfa">
              <span className="text-[15px] font-semibold tracking-tight text-apple-ink">
                okultedarigim
                <span className="text-apple-blue">.com</span>
              </span>
            </Link>
            <nav className="hidden lg:flex items-center gap-7">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-[13px] font-normal text-apple-ink/80 hover:text-apple-ink transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="pointer-events-auto flex items-center h-12 pl-1.5 pr-1.5 rounded-full backdrop-blur-xl shadow-[0_8px_24px_-12px_rgba(0,0,0,0.12)]">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full text-apple-ink/80 hover:text-apple-ink text-[13px] font-medium transition-colors"
            >
              <ArrowLeft weight="regular" className="w-4 h-4" />
              Ana Sayfaya Dön
            </Link>
          </div>
        </div>
      </div>
    </header>
  )
}
