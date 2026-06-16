import { ArrowLeft } from '@phosphor-icons/react/dist/ssr'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'

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

const rich = {
  strong: (chunks: React.ReactNode) => <strong>{chunks}</strong>,
}

export default async function MesafeliSatisPage() {
  const t = await getTranslations('legal.mesafeli')

  return (
    <div className="min-h-screen bg-white overflow-x-clip">
      <LegalHeader />

      <main className="pt-36 pb-24 px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="mb-16">
            <p className="text-[13px] font-medium text-apple-gray mb-5 tracking-wide uppercase">
              {t('eyebrow')}
            </p>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight text-apple-ink leading-[1.05]">
              {t('title')}
            </h1>
            <p className="mt-6 text-lg lg:text-xl text-apple-gray leading-relaxed">
              {t('intro')}
            </p>
          </div>

          <div className="space-y-14 text-[17px] text-apple-gray leading-relaxed">

            <Section title={t('s1.title')}>
              <p>{t('s1.p0')}</p>

              <h3 className="text-lg font-semibold text-apple-ink mt-5 mb-2">{t('s1.sellerHeading')}</h3>
              <InfoBox>
                <p><span className="text-apple-ink font-medium">{t('s1.box.legalName')}:</span> {SELLER.legalName}</p>
                <p><span className="text-apple-ink font-medium">{t('s1.box.brand')}:</span> {SELLER.brand}</p>
                <p><span className="text-apple-ink font-medium">{t('s1.box.tax')}:</span> {SELLER.taxOffice} / {SELLER.taxNumber}</p>
                <p><span className="text-apple-ink font-medium">{t('s1.box.mersis')}:</span> {SELLER.mersis}</p>
                <p><span className="text-apple-ink font-medium">{t('s1.box.address')}:</span> {SELLER.address}</p>
                <p><span className="text-apple-ink font-medium">{t('s1.box.email')}:</span> {SELLER.email}</p>
                <p><span className="text-apple-ink font-medium">{t('s1.box.phone')}:</span> {SELLER.phone}</p>
                <p><span className="text-apple-ink font-medium">{t('s1.box.web')}:</span> {SELLER.website}</p>
              </InfoBox>

              <h3 className="text-lg font-semibold text-apple-ink mt-5 mb-2">{t('s1.buyerHeading')}</h3>
              <p>{t('s1.p1')}</p>
            </Section>

            <Section title={t('s2.title')}>
              <p>{t.rich('s2.p0', { ...rich, website: () => <strong>{SELLER.website}</strong> })}</p>
            </Section>

            <Section title={t('s3.title')}>
              <p>{t.rich('s3.p0', rich)}</p>
              <p className="mt-3">{t('s3.p1')}</p>
            </Section>

            <Section title={t('s4.title')}>
              <p>{t('s4.p0')}</p>
            </Section>

            <Section title={t('s5.title')}>
              <p>{t.rich('s5.p0', rich)}</p>
              <p className="mt-3">{t('s5.p1')}</p>
              <List
                items={[
                  t('s5.items.0', { email: SELLER.email }),
                  t('s5.items.1'),
                ]}
              />
              <p className="mt-3">{t.rich('s5.p2', rich)}</p>
            </Section>

            <Section title={t('s6.title')}>
              <p>{t('s6.p0')}</p>
              <List
                items={[
                  t('s6.items.0'),
                  t('s6.items.1'),
                  t('s6.items.2'),
                ]}
              />
              <p className="mt-3">{t.rich('s6.p1', rich)}</p>
            </Section>

            <Section title={t('s7.title')}>
              <p>{t.rich('s7.p0', rich)}</p>
              <List
                items={[
                  t('s7.items.0'),
                  t('s7.items.1'),
                ]}
              />
              <p className="mt-3">{t('s7.p1')}</p>
            </Section>

            <Section title={t('s8.title')}>
              <p>{t('s8.p0')}</p>
            </Section>

            <Section title={t('s9.title')}>
              <p>{t.rich('s9.p0', rich)}</p>
              <p className="mt-3">{t('s9.p1')}</p>
            </Section>

            <Section title={t('s10.title')}>
              <p>{t.rich('s10.p0', rich)}</p>
              <List
                items={[
                  t('s10.items.0'),
                  t('s10.items.1'),
                  t('s10.items.2'),
                ]}
              />
              <p className="mt-3">{t('s10.p1')}</p>
            </Section>

            <Section title={t('s11.title')}>
              <p>{t('s11.p0')}</p>
              <List
                items={[
                  t('s11.items.0', { email: SELLER.email }),
                  t('s11.items.1', { phone: SELLER.phone }),
                  t('s11.items.2'),
                  t('s11.items.3'),
                ]}
              />
            </Section>

            <Section title={t('s12.title')}>
              <p>{t('s12.p0')}</p>
            </Section>

            <p className="text-[13px] text-apple-gray/80 pt-10 border-t border-apple-border/60">
              {t('lastUpdated')}
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

function List({ items }: { items: React.ReactNode[] }) {
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
async function LegalHeader() {
  const t = await getTranslations('legal.header')
  const navLinks = [
    { label: t('nav.howItWorks'), href: '/#nasil-calisir' },
    { label: t('nav.faq'), href: '/#sss' },
    { label: t('nav.orderTracking'), href: '/siparis-takip' },
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
              {t('backHome')}
            </Link>
          </div>
        </div>
      </div>
    </header>
  )
}
