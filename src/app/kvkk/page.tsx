import Link from 'next/link'
import { ArrowLeft } from '@phosphor-icons/react/dist/ssr'

// =====================================================================
// ŞİRKET BİLGİLERİ — DOLDURUN
// Üretime almadan önce aşağıdaki tüm placeholder'ları kendi
// işletme/şirket bilgilerinizle değiştirin. Bu sayfa hukuki bir metindir
// ve KVKK Kurumu denetiminde delil olarak değerlendirilir.
// Mümkünse bir avukata gözden geçirtin.
// =====================================================================
const COMPANY = {
  legalName: '[Ticaret Unvanı / Şahıs Adı]',
  brand: 'OkulTedarigim',
  taxOffice: '[Vergi Dairesi]',
  taxNumber: '[Vergi Numarası]',
  mersis: '[MERSİS No (varsa)]',
  address: '[Tam Adres — Mahalle, Cadde, No, İlçe, İl, Posta Kodu]',
  email: 'destek@okultedarigim.com',
  phone: '+90 549 774 71 37',
  verbisNumber: '[VERBİS Kayıt No (kayıt yapıldıysa)]',
  dpoEmail: 'kvkk@okultedarigim.com',
}

export default function KVKKPage() {
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
              KVKK aydınlatma metni
            </h1>
            <p className="mt-6 text-lg lg:text-xl text-apple-gray leading-relaxed">
              6698 sayılı Kişisel Verilerin Korunması Kanunu (&quot;KVKK&quot;) uyarınca, kişisel
              verilerinizin işlenme amaçları, hukuki sebepleri, aktarımı, saklama süreleri ve
              KVKK&apos;dan doğan haklarınız hakkında bilgi vermek amacıyla bu metin
              hazırlanmıştır.
            </p>
          </div>

          <div className="space-y-14 text-[17px] text-apple-gray leading-relaxed">

            <Section title="1. Veri Sorumlusu">
              <p>
                Veri sorumlusu sıfatıyla; kişisel verileriniz, aşağıda kimliği yer alan tüzel/şahıs
                tarafından işlenmektedir.
              </p>
              <InfoBox>
                <p><span className="text-apple-ink font-medium">Ticaret Unvanı:</span> {COMPANY.legalName}</p>
                <p><span className="text-apple-ink font-medium">Marka:</span> {COMPANY.brand}</p>
                <p><span className="text-apple-ink font-medium">Vergi Dairesi / No:</span> {COMPANY.taxOffice} / {COMPANY.taxNumber}</p>
                <p><span className="text-apple-ink font-medium">MERSİS No:</span> {COMPANY.mersis}</p>
                <p><span className="text-apple-ink font-medium">Adres:</span> {COMPANY.address}</p>
                <p><span className="text-apple-ink font-medium">E-posta:</span> {COMPANY.email}</p>
                <p><span className="text-apple-ink font-medium">Telefon:</span> {COMPANY.phone}</p>
                <p><span className="text-apple-ink font-medium">VERBİS Kayıt No:</span> {COMPANY.verbisNumber}</p>
              </InfoBox>
            </Section>

            <Section title="2. İşlenen Kişisel Veriler">
              <p>
                Sipariş süreci kapsamında aşağıdaki kişisel veri kategorileri işlenmektedir:
              </p>
              <List
                items={[
                  'Kimlik verileri: ad, soyad, T.C. kimlik numarası (yalnızca e-Arşiv/e-Fatura kesimi için zorunludur)',
                  'İletişim verileri: telefon numarası, e-posta adresi, teslimat ve fatura adresi',
                  'Öğrenci verileri (çocuk verisi): öğrencinin adı, soyadı, okul ve sınıf bilgisi',
                  'Sipariş verileri: sipariş numarası, sipariş içeriği, tutar, tarih, sipariş notu',
                  'Mali veriler: vergi numarası, vergi dairesi (kurumsal fatura tercihinde), fatura no',
                  'İşlem güvenliği verileri: IP adresi, oturum bilgileri, başarısız giriş kayıtları',
                  'Ödeme verileri: yalnızca işlem referans numarası ve tutar saklanır; kart numarası, CVV ve son kullanma tarihi sistemimizde saklanmaz, lisanslı ödeme kuruluşuna (PCI-DSS uyumlu) doğrudan iletilir.',
                ]}
              />
            </Section>

            <Section title="3. Çocuk Kişisel Verileri Hakkında Özel Bildirim">
              <p>
                Sipariş süreci sırasında 18 yaş altındaki <strong>öğrencilere ait kişisel veriler</strong> (ad,
                soyad, sınıf, okul) işlenmektedir. Bu veriler yalnızca öğrencinin <strong>velisi/yasal
                temsilcisi</strong> tarafından, öğrenciye okul tedarik paketinin teslim edilmesi amacıyla,
                veli sıfatıyla verilen onay çerçevesinde işlenir.
              </p>
              <p className="mt-3">
                Sipariş formunu dolduran kişi, öğrencinin velisi/yasal temsilcisi olduğunu ve KVKK
                kapsamında öğrenciye ait kişisel verilerin işlenmesi için yetkili olduğunu beyan
                eder. Çocuğun verileri yalnızca hizmetin ifası için gereken süre boyunca işlenir ve
                pazarlama amacıyla kullanılmaz.
              </p>
            </Section>

            <Section title="4. Kişisel Verilerin İşlenme Amaçları">
              <List
                items={[
                  'Sipariş ve ödeme süreçlerinin yürütülmesi',
                  'Ürün/paket teslimat sürecinin planlanması ve gerçekleştirilmesi',
                  'e-Arşiv ve e-Fatura kesimi ile yasal fatura yükümlülüklerinin yerine getirilmesi',
                  'Müşteri ilişkileri yönetimi, sipariş takibi, iptal ve iade taleplerinin değerlendirilmesi',
                  'İletişim faaliyetlerinin yürütülmesi (sipariş bildirimi, kargo bildirimi)',
                  'Bilgi güvenliği süreçlerinin yürütülmesi (oturum, brute-force koruması, denetim izi)',
                  '6502, 6698, 213 sayılı kanunlar ve VUK gibi mevzuat kapsamındaki yükümlülüklerin yerine getirilmesi',
                  'Tüketici şikâyetlerinin ve uyuşmazlıkların değerlendirilmesi',
                ]}
              />
            </Section>

            <Section title="5. İşlemenin Hukuki Sebepleri (KVKK m.5)">
              <List
                items={[
                  'Bir sözleşmenin kurulması veya ifasıyla doğrudan doğruya ilgili olması (m. 5/2-c) — sipariş ve teslimat süreci',
                  'Veri sorumlusunun hukuki yükümlülüğünü yerine getirebilmesi için zorunlu olması (m. 5/2-ç) — fatura kesimi, mali kayıt',
                  'İlgili kişinin temel hak ve özgürlüklerine zarar vermemek kaydıyla, veri sorumlusunun meşru menfaatleri için zorunlu olması (m. 5/2-f) — bilgi güvenliği, dolandırıcılık önleme',
                  'Açık rıza (m. 5/1) — pazarlama amaçlı bildirimler ve veli olarak çocuğun verilerinin işlenmesi onayı',
                ]}
              />
            </Section>

            <Section title="6. Kişisel Verilerin Aktarılması">
              <p>
                Kişisel verileriniz, yalnızca aşağıdaki amaçlarla ve sınırlı şekilde, KVKK m. 8 ve
                m. 9 kapsamında aktarılabilir:
              </p>
              <List
                items={[
                  'Ödeme hizmet sağlayıcısı (Iyzico Ödeme Hizmetleri A.Ş.) — ödeme işleminin gerçekleştirilmesi amacıyla',
                  'e-Fatura entegratörü (KolayBi / Türkiye Bilimsel ve Teknolojik Araştırma Kurumu — GİB) — fatura kesimi amacıyla',
                  'Kargo şirketi (Aras Kargo) — kargo teslimatı için yalnızca alıcı, telefon, adres bilgileri',
                  'E-posta servisi (Resend) ve SMS servisi (Twilio) — bildirim iletimi için',
                  'Yasal merci ve kamu kurumları — yasal yükümlülükler ya da mahkeme/savcılık talebi halinde',
                  'Bulut altyapı sağlayıcıları (Vercel Inc., TiDB Cloud / PingCAP Inc.) — veri saklama ve sunum altyapısı; sunucular Avrupa Birliği (Frankfurt) bölgesinde konumlanmıştır.',
                ]}
              />
              <p className="mt-3">
                Yurt dışına aktarım, ilgili sağlayıcının KVKK m. 9 kapsamında sunduğu güvence
                çerçevesinde gerçekleşir. Yurt dışına aktarımın açık rıza ile gerçekleştiği
                durumlarda ayrıca onay alınır.
              </p>
            </Section>

            <Section title="7. Saklama Süreleri">
              <List
                items={[
                  'Sipariş ve fatura verileri: VUK ve TTK gereği 10 (on) yıl',
                  'KVKK aydınlatma kayıtları ve denetim izi (system_logs): 5 (beş) yıl',
                  'İletişim ve pazarlama amaçlı veriler: açık rızanın geri çekilmesine kadar veya en fazla 3 yıl',
                  'Başarısız giriş ve oturum güvenlik kayıtları: en fazla 1 yıl',
                  'İptal/iade kayıtları: kayıt tarihinden itibaren 10 (on) yıl',
                ]}
              />
              <p className="mt-3">
                Saklama süresi sona eren veriler ilk imha periyodunda silinir, yok edilir veya
                anonim hale getirilir.
              </p>
            </Section>

            <Section title="8. Kişisel Veri Sahibinin Hakları (KVKK m. 11)">
              <p>Veri sahibi olarak, KVKK&apos;nın 11. maddesi uyarınca aşağıdaki haklara sahipsiniz:</p>
              <List
                items={[
                  'Kişisel verilerinizin işlenip işlenmediğini öğrenme',
                  'İşlenmişse buna ilişkin bilgi talep etme',
                  'İşlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme',
                  'Yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri bilme',
                  'Eksik veya yanlış işlenmiş olması hâlinde düzeltilmesini isteme',
                  'KVKK&apos;da öngörülen şartlar çerçevesinde silinmesini veya yok edilmesini isteme',
                  'Düzeltme, silme ve yok etme işlemlerinin verilerin aktarıldığı üçüncü kişilere bildirilmesini isteme',
                  'Otomatik sistemler ile analiz edilmesi sonucu aleyhinize bir sonuç çıkmasına itiraz etme',
                  'Hukuka aykırı işleme nedeniyle zarara uğramanız hâlinde zararın giderilmesini talep etme',
                ]}
              />
            </Section>

            <Section title="9. Başvuru Yöntemi">
              <p>
                KVKK m. 13 uyarınca yukarıdaki haklarınıza ilişkin taleplerinizi, kimlik tespiti
                yapılabilecek bir şekilde aşağıdaki yollardan biriyle iletebilirsiniz:
              </p>
              <List
                items={[
                  `E-posta: ${COMPANY.dpoEmail} (kayıtlı e-posta adresinizden)`,
                  `Yazılı başvuru: ${COMPANY.address}`,
                  'Veri Sorumlusuna Başvuru Usul ve Esasları Hakkında Tebliğ kapsamında',
                ]}
              />
              <p className="mt-3">
                Başvurunuz; KVKK m. 13/2 uyarınca en geç 30 (otuz) gün içinde sonuçlandırılır.
                Başvurunuza verilen yanıttan tatmin olmamanız hâlinde KVKK Kuruluna şikayet hakkınız
                bulunmaktadır (kvkk.gov.tr).
              </p>
            </Section>

            <Section title="10. Veri Güvenliği">
              <p>
                Kişisel verilerinizin hukuka aykırı işlenmesini, erişilmesini ve kaybolmasını
                önlemek için aşağıdaki teknik ve idari tedbirler uygulanmaktadır:
              </p>
              <List
                items={[
                  'TLS 1.2+ şifreli iletişim, HSTS politikası',
                  'Şifrelerin tek yönlü kriptografik özetleme (bcrypt) ile saklanması',
                  'Yetkili erişim kontrolü ve oturum güvenliği (httpOnly, secure, sameSite çerez politikaları)',
                  'Brute-force koruması ve hız sınırı (rate limiting)',
                  'Veritabanı yedekleme (TiDB Cloud otomatik günlük yedek)',
                  'Üçüncü taraf taşeronlarla veri işleyici sözleşmeleri',
                  'Çalışan farkındalık ve gizlilik yükümlülükleri',
                ]}
              />
            </Section>

            <Section title="11. Çerez Politikası Özeti">
              <p>
                Sitemizde yalnızca <strong>oturum çerezleri</strong> (admin/müdür girişi için
                <code className="text-apple-ink mx-1">token</code>,
                <code className="text-apple-ink mx-1">mudur_token</code>) kullanılmaktadır. Üçüncü
                taraf izleme/pazarlama çerezi yerleştirilmez, analytics aracı kullanılmaz. Oturum
                çerezleri yalnızca giriş yapan kullanıcılar için ve KVKK m.5/2-c (sözleşmenin
                ifası) hukuki sebebiyle kurulur.
              </p>
            </Section>

            <Section title="12. Güncellemeler">
              <p>
                Bu aydınlatma metni, mevzuat değişiklikleri ve hizmet kapsamımızdaki gelişmeler
                doğrultusunda güncellenebilir. Güncel sürüm her zaman bu sayfada yayımlanır.
              </p>
            </Section>

            <p className="text-[13px] text-apple-gray/80 pt-10 border-t border-apple-border/60">
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
    <div className="mt-4 p-5 rounded-2xl bg-apple-panel border border-apple-border/60 space-y-1.5 text-[15px]">
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
