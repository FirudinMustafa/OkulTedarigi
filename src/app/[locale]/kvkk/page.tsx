import { ArrowLeft } from '@phosphor-icons/react/dist/ssr'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'

// =====================================================================
// ŞİRKET BİLGİLERİ (gerçek — 2026-06 dolduruldu)
// Bu sayfa hukuki bir metindir ve KVKK Kurumu denetiminde delil olarak
// değerlendirilir. Üretime almadan önce avukatınıza gözden geçirtmeniz önerilir.
// =====================================================================
const COMPANY = {
  legalName: 'NEXT KIRTASİYE YAYINCILIK DAĞITIM OTOMOTİV GIDA İLETİŞİM HİZMETLERİ LİMİTED ŞİRKETİ',
  brand: 'OkulTedarigim',
  taxOffice: 'Başakşehir',
  taxNumber: '1258793967',
  mersis: '0180070520100001',
  address: 'Şamlar Mah. Hanedan Sk. Seher Hanım Apt. No: 11/1A Başakşehir / İstanbul',
  email: 'info@okultedarigim.com',
  phone: '+90 549 774 71 37',
  verbisNumber: '-',
  dpoEmail: 'info@okultedarigim.com',
}

const rich = {
  strong: (chunks: React.ReactNode) => <strong>{chunks}</strong>,
  code: (chunks: React.ReactNode) => <code className="text-apple-ink mx-1">{chunks}</code>,
}

export default async function KVKKPage() {
  const t = await getTranslations('legal.kvkk')

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
              <InfoBox>
                <p><span className="text-apple-ink font-medium">{t('s1.box.legalName')}:</span> {COMPANY.legalName}</p>
                <p><span className="text-apple-ink font-medium">{t('s1.box.brand')}:</span> {COMPANY.brand}</p>
                <p><span className="text-apple-ink font-medium">{t('s1.box.tax')}:</span> {COMPANY.taxOffice} / {COMPANY.taxNumber}</p>
                <p><span className="text-apple-ink font-medium">{t('s1.box.mersis')}:</span> {COMPANY.mersis}</p>
                <p><span className="text-apple-ink font-medium">{t('s1.box.address')}:</span> {COMPANY.address}</p>
                <p><span className="text-apple-ink font-medium">{t('s1.box.email')}:</span> {COMPANY.email}</p>
                <p><span className="text-apple-ink font-medium">{t('s1.box.phone')}:</span> {COMPANY.phone}</p>
                <p><span className="text-apple-ink font-medium">{t('s1.box.verbis')}:</span> {COMPANY.verbisNumber}</p>
              </InfoBox>
            </Section>

            <Section title={t('s2.title')}>
              <p>{t('s2.p0')}</p>
              <List
                items={[
                  t('s2.items.0'),
                  t('s2.items.1'),
                  t('s2.items.2'),
                  t('s2.items.3'),
                  t('s2.items.4'),
                  t('s2.items.5'),
                  t('s2.items.6'),
                ]}
              />
            </Section>

            <Section title={t('s3.title')}>
              <p>{t.rich('s3.p0', rich)}</p>
              <p className="mt-3">{t('s3.p1')}</p>
            </Section>

            <Section title={t('s4.title')}>
              <List
                items={[
                  t('s4.items.0'),
                  t('s4.items.1'),
                  t('s4.items.2'),
                  t('s4.items.3'),
                  t('s4.items.4'),
                  t('s4.items.5'),
                  t('s4.items.6'),
                  t('s4.items.7'),
                ]}
              />
            </Section>

            <Section title={t('s5.title')}>
              <List
                items={[
                  t('s5.items.0'),
                  t('s5.items.1'),
                  t('s5.items.2'),
                  t('s5.items.3'),
                ]}
              />
            </Section>

            <Section title={t('s6.title')}>
              <p>{t('s6.p0')}</p>
              <List
                items={[
                  t('s6.items.0'),
                  t('s6.items.1'),
                  t('s6.items.2'),
                  t('s6.items.3'),
                  t('s6.items.4'),
                  t('s6.items.5'),
                ]}
              />
              <p className="mt-3">{t('s6.p1')}</p>
            </Section>

            <Section title={t('s7.title')}>
              <List
                items={[
                  t('s7.items.0'),
                  t('s7.items.1'),
                  t('s7.items.2'),
                  t('s7.items.3'),
                  t('s7.items.4'),
                ]}
              />
              <p className="mt-3">{t('s7.p0')}</p>
            </Section>

            <Section title={t('s8.title')}>
              <p>{t('s8.p0')}</p>
              <List
                items={[
                  t('s8.items.0'),
                  t('s8.items.1'),
                  t('s8.items.2'),
                  t('s8.items.3'),
                  t('s8.items.4'),
                  t('s8.items.5'),
                  t('s8.items.6'),
                  t('s8.items.7'),
                  t('s8.items.8'),
                ]}
              />
            </Section>

            <Section title={t('s9.title')}>
              <p>{t('s9.p0')}</p>
              <List
                items={[
                  t('s9.items.0', { dpoEmail: COMPANY.dpoEmail }),
                  t('s9.items.1', { address: COMPANY.address }),
                  t('s9.items.2'),
                ]}
              />
              <p className="mt-3">{t('s9.p1')}</p>
            </Section>

            <Section title={t('s10.title')}>
              <p>{t('s10.p0')}</p>
              <List
                items={[
                  t('s10.items.0'),
                  t('s10.items.1'),
                  t('s10.items.2'),
                  t('s10.items.3'),
                  t('s10.items.4'),
                  t('s10.items.5'),
                  t('s10.items.6'),
                ]}
              />
            </Section>

            <Section title={t('s11.title')}>
              <p>{t.rich('s11.p0', rich)}</p>
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
    <div className="mt-4 p-5 rounded-2xl bg-apple-panel border border-apple-border/60 space-y-1.5 text-[15px]">
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
