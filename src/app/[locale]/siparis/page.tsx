'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useRouter, Link } from '@/i18n/navigation'
import Image from 'next/image'
import { useTranslations, useLocale } from 'next-intl'
import { ArrowLeft, ArrowRight, Buildings, CheckCircle, LockSimple, WarningCircle, CaretDown, CaretUp, Eye, EyeSlash } from '@phosphor-icons/react'
import { getLocalized } from '@/lib/i18n-content'

// Sinif kartlari icin gorsel arka plan listesi (public/images/class-bg/)
const CLASS_BG_VARIANTS = [
  'blue', 'green', 'purple',
  'pink', 'orange', 'yellow',
  'teal', 'lime', 'red'
] as const

interface PackageItem {
  id: string
  name: string
  name_en?: string | null
  name_de?: string | null
  name_ar?: string | null
  quantity: number
}

interface Package {
  id: string
  name: string
  name_en?: string | null
  name_de?: string | null
  name_ar?: string | null
  description: string | null
  description_en?: string | null
  description_de?: string | null
  description_ar?: string | null
  note: string | null
  note_en?: string | null
  note_de?: string | null
  note_ar?: string | null
  price: number
  items: PackageItem[]
}

interface ClassOption {
  id: string
  name: string
  name_en?: string | null
  name_de?: string | null
  name_ar?: string | null
  package: Package | null
}

interface SchoolData {
  schoolId: string
  schoolName?: string | null
  schoolName_en?: string | null
  schoolName_de?: string | null
  schoolName_ar?: string | null
  deliveryType: string
  showSchoolDeliveryNote: boolean
  classes: ClassOption[]
}

export default function SiparisPage() {
  return (
    <div className="min-h-screen bg-white overflow-x-clip">
      <main className="relative">
        <Suspense fallback={null}>
          <SchoolPasswordFlow />
        </Suspense>
      </main>
    </div>
  )
}

// ==================== ORDER HEADER ====================
// Ana sayfa ile ayni floating pill stili: solda logo + nav,
// sagda tek buton. onBack verilirse "Şifre ekranına dön" gibi
// state-aware geri eylemi calistirilir; yoksa "Ana Sayfaya Dön" linki.
function OrderHeader({ onBack }: { onBack?: () => void }) {
  const t = useTranslations('order')
  const navLinks = [
    { label: t('header.nav.howItWorks'), href: '/#nasil-calisir' },
    { label: t('header.nav.faq'), href: '/#sss' },
    { label: t('header.nav.orderTracking'), href: '/siparis-takip' },
  ]

  return (
    <header className="fixed top-0 left-0 right-0 z-50 pointer-events-none">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <div className="flex items-center justify-between gap-3">
          {/* Sol pill — logo + nav */}
          <div className="pointer-events-auto flex items-center gap-6 lg:gap-8 h-12 pl-5 pr-6 rounded-full backdrop-blur-xl shadow-[0_8px_24px_-12px_rgba(0,0,0,0.12)]">
            <Link href="/" className="flex items-center gap-2 shrink-0" aria-label={t('header.homeAriaLabel')}>
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

          {/* Sag pill — duruma gore "Sifre ekranina don" veya "Ana Sayfaya Don" */}
          <div className="pointer-events-auto flex items-center h-12 pl-1.5 pr-1.5 rounded-full backdrop-blur-xl shadow-[0_8px_24px_-12px_rgba(0,0,0,0.12)]">
            {onBack ? (
              <button
                type="button"
                onClick={onBack}
                className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full text-apple-ink/80 hover:text-apple-ink text-[13px] font-medium transition-colors"
              >
                <ArrowLeft weight="regular" className="w-4 h-4" />
                {t('header.backToPassword')}
              </button>
            ) : (
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full text-apple-ink/80 hover:text-apple-ink text-[13px] font-medium transition-colors"
              >
                <ArrowLeft weight="regular" className="w-4 h-4" />
                {t('header.backToHome')}
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

// ==================== SCHOOL PASSWORD FLOW ====================
const SCHOOL_DATA_KEY = 'siparisSchoolData'

function SchoolPasswordFlow() {
  const t = useTranslations('order')
  const locale = useLocale()
  const router = useRouter()
  const searchParams = useSearchParams()
  const sessionLost = searchParams.get('reason') === 'session-lost'
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isValidating, setIsValidating] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [schoolData, setSchoolData] = useState<SchoolData | null>(null)
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)
  const [showSessionWarning, setShowSessionWarning] = useState(sessionLost)

  // /siparis her acildiginda kullanicidan sifre yeniden istenir.
  // Onceki oturumdan kalmis okul verisini temizle.
  useEffect(() => {
    try { sessionStorage.removeItem(SCHOOL_DATA_KEY) } catch {}
  }, [])

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!password.trim()) {
      setErrorMessage(t('errors.passwordRequired'))
      return
    }

    setIsValidating(true)
    setErrorMessage('')

    try {
      const res = await fetch('/api/veli/verify-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: password.trim() })
      })

      const data = await res.json()

      if (!res.ok) {
        setErrorMessage(data.error || t('errors.invalidPassword'))
        setIsValidating(false)
        return
      }

      setSchoolData({
        schoolId: data.schoolId,
        schoolName: data.schoolName ?? null,
        schoolName_en: data.schoolName_en ?? null,
        schoolName_de: data.schoolName_de ?? null,
        schoolName_ar: data.schoolName_ar ?? null,
        deliveryType: data.deliveryType,
        showSchoolDeliveryNote: data.showSchoolDeliveryNote,
        classes: data.classes
      })
    } catch {
      setErrorMessage(t('errors.generic'))
    } finally {
      setIsValidating(false)
    }
  }

  // Sınıf-seçim ekranindan geri donerken sifre giris ekranina don (ana sayfaya degil).
  const handleBackToPassword = () => {
    try { sessionStorage.removeItem(SCHOOL_DATA_KEY) } catch {}
    setSchoolData(null)
    setPassword('')
    setExpandedIdx(null)
    setErrorMessage('')
  }

  const handleClassSelect = (cls: ClassOption) => {
    if (!schoolData || !cls.package) return

    sessionStorage.setItem('classData', JSON.stringify({
      classId: cls.id,
      className: cls.name,
      schoolId: schoolData.schoolId,
      schoolName: schoolData.schoolName,
      deliveryType: schoolData.deliveryType,
      showSchoolDeliveryNote: schoolData.showSchoolDeliveryNote,
      package: cls.package
    }))

    router.push(`/paket/${cls.id}`)
  }

  // ========== SINIF SECIM EKRANI ==========
  if (schoolData) {
    return (
      <>
      <OrderHeader onBack={handleBackToPassword} />
      <section className="min-h-screen pt-32 pb-20 px-6 lg:px-8 bg-apple-bg">
        <div className="max-w-6xl mx-auto">
          {/* Okul bilgisi */}
          <div className="mb-10 flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-apple-panel flex items-center justify-center">
              <Buildings weight="regular" className="w-6 h-6 text-apple-ink" />
            </div>
            <div>
              {schoolData.schoolName && (
                <p className="text-[15px] font-semibold text-apple-ink">{getLocalized(schoolData, 'schoolName', locale)}</p>
              )}
              <p className="text-[13px] text-apple-gray">
                {schoolData.deliveryType === 'CARGO' ? t('delivery.cargo') : t('delivery.school')}
              </p>
            </div>
          </div>

          {/* Baslik */}
          <div className="mb-10 max-w-2xl">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight text-apple-ink leading-[1.05]">
              {t.rich('selectPackage.title', {
                accent: (chunks) => <span className="text-gradient-green">{chunks}</span>,
              })}
            </h2>
            <p className="mt-4 text-lg text-apple-gray">{t('selectPackage.subtitle')}</p>
          </div>

          {/* Paket grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 items-start">
            {schoolData.classes.map((cls, idx) => {
              const variant = CLASS_BG_VARIANTS[idx % CLASS_BG_VARIANTS.length]
              const isExpanded = expandedIdx === idx
              const hasItems = !!cls.package && Array.isArray(cls.package.items) && cls.package.items.length > 0
              return (
                <div
                  key={`${cls.id}-${idx}`}
                  className="group relative rounded-[28px] overflow-hidden border border-apple-border/60 bg-white shadow-[0_12px_32px_-20px_rgba(0,0,0,0.15)] transition-all flex flex-col"
                >
                  <div className="relative w-full aspect-[16/9] overflow-hidden">
                    <Image
                      src={`/images/class-bg/${variant}.png`}
                      alt={t('selectPackage.classPackageAlt', { className: getLocalized(cls, 'name', locale) })}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                    <div className="absolute bottom-4 left-5 right-5">
                      <p className="text-white font-semibold text-xl tracking-tight drop-shadow-md">{t('selectPackage.classPackageLabel', { className: getLocalized(cls, 'name', locale) })}</p>
                    </div>
                  </div>

                  <div className="p-6 flex-1 flex flex-col gap-4">
                    {cls.package && (
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[14px] font-medium text-apple-ink line-clamp-1">{getLocalized(cls.package, 'name', locale)}</p>
                        <span className="text-lg font-semibold text-[#10b981] whitespace-nowrap">
                          {Number(cls.package.price).toFixed(2)} ₺
                        </span>
                      </div>
                    )}

                    {hasItems && isExpanded && (
                      <div className="pt-4 border-t border-apple-border/60">
                        <p className="text-[11px] font-semibold text-apple-gray uppercase tracking-wide mb-2">
                          {t('selectPackage.packageContents')}
                        </p>
                        <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                          {cls.package!.items.map((item) => (
                            <div key={item.id} className="flex items-center gap-2">
                              <CheckCircle weight="fill" className="w-3.5 h-3.5 text-[#10b981] flex-shrink-0" />
                              <span className="text-[13px] text-apple-gray line-clamp-2">
                                {item.quantity > 1 && <span className="font-medium text-apple-ink">{item.quantity}× </span>}
                                {getLocalized(item, 'name', locale)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Aksiyon butonlari — mobilde alt alta, sm+ yan yana */}
                    <div className="mt-auto pt-2 flex flex-col sm:flex-row gap-2">
                      {hasItems && (
                        <button
                          type="button"
                          onClick={() => setExpandedIdx(isExpanded ? null : idx)}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-full border border-apple-border/80 text-apple-ink text-[13px] font-medium hover:bg-apple-panel transition-colors"
                        >
                          {isExpanded ? (
                            <>
                              {t('selectPackage.hide')} <CaretUp weight="bold" className="w-3.5 h-3.5" />
                            </>
                          ) : (
                            <>
                              {t('selectPackage.viewPackage')} <CaretDown weight="bold" className="w-3.5 h-3.5" />
                            </>
                          )}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleClassSelect(cls)}
                        disabled={!cls.package}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-full bg-[#10b981] hover:bg-[#059669] text-white text-[13px] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {t('selectPackage.choosePackage')}
                        <ArrowRight weight="bold" className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <button
            onClick={() => {
              try { sessionStorage.removeItem(SCHOOL_DATA_KEY) } catch {}
              setSchoolData(null)
              setPassword('')
            }}
            className="mt-10 mx-auto flex items-center gap-2 text-[13px] text-apple-gray hover:text-apple-ink transition-colors"
          >
            <ArrowLeft weight="regular" className="w-4 h-4" />
            {t('selectPackage.differentPassword')}
          </button>
        </div>
      </section>
      </>
    )
  }

  // ========== SIFRE GIRIS EKRANI — iki sutun ==========
  return (
    <>
    <OrderHeader />
    <section className="min-h-screen grid lg:grid-cols-2 bg-white">
      {/* Sol: 3D siparis ikonu — mobilde gizli */}
      <div className="relative hidden lg:flex items-center justify-center bg-apple-panel lg:min-h-screen px-6 py-24">
        <div className="relative w-full max-w-md aspect-square">
          <Image
            src="/images/pass.png"
            alt={t('passwordEntry.imageAlt')}
            fill
            sizes="(max-width: 1024px) 80vw, 40vw"
            className="object-contain drop-shadow-[0_40px_80px_rgba(0,0,0,0.18)]"
            priority
          />
        </div>
      </div>

      {/* Sag: Sifre giris formu */}
      <div className="flex items-center justify-center min-h-screen px-6 py-24">
        <div className="w-full max-w-md">
          {showSessionWarning && (
            <div className="mb-6 flex items-start gap-3 p-4 rounded-2xl bg-amber-50 border border-amber-200">
              <WarningCircle weight="fill" className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 text-[13px] text-amber-800">
                <p className="font-medium mb-0.5">{t('sessionWarning.title')}</p>
                <p className="text-amber-700">{t('sessionWarning.message')}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowSessionWarning(false)}
                className="text-amber-600 hover:text-amber-800 text-[13px]"
                aria-label={t('sessionWarning.close')}
              >
                ✕
              </button>
            </div>
          )}
          <div className="mb-10">
            <p className="text-[13px] font-medium text-[#10b981] mb-4 tracking-wide uppercase">
              {t('passwordEntry.eyebrow')}
            </p>
            <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-apple-ink leading-[1.05]">
              {t.rich('passwordEntry.title', {
                accent: (chunks) => <span className="text-gradient-green">{chunks}</span>,
              })}
            </h1>
            <p className="mt-5 text-[17px] text-apple-gray leading-relaxed">
              {t('passwordEntry.description')}
            </p>
          </div>

          <form onSubmit={handlePasswordSubmit} className="space-y-5">
            <div>
              <label htmlFor="schoolPassword" className="block text-[13px] font-medium text-apple-ink mb-2">
                {t('passwordEntry.label')}
              </label>
              <div className="relative">
                <input
                  id="schoolPassword"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value.toUpperCase())
                    setErrorMessage('')
                  }}
                  placeholder={t('passwordEntry.placeholder')}
                  disabled={isValidating}
                  className={`w-full h-14 pl-5 pr-14 text-[17px] bg-white border rounded-2xl transition-all outline-none font-mono tracking-wider placeholder:text-apple-gray/60 placeholder:font-sans placeholder:tracking-normal ${
                    errorMessage
                      ? 'border-red-400 focus:border-red-500'
                      : 'border-apple-border focus:border-apple-ink'
                  } disabled:opacity-60 disabled:cursor-not-allowed`}
                  autoComplete="off"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-apple-gray hover:text-apple-ink transition-colors"
                  aria-label={showPassword ? t('passwordEntry.hidePassword') : t('passwordEntry.showPassword')}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeSlash weight="regular" className="w-5 h-5" /> : <Eye weight="regular" className="w-5 h-5" />}
                </button>
              </div>
              {errorMessage && (
                <div className="mt-3 flex items-center gap-2 text-red-600">
                  <WarningCircle weight="fill" className="w-4 h-4 flex-shrink-0" />
                  <span className="text-[13px] font-medium">{errorMessage}</span>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={!password.trim() || isValidating}
              className="w-full h-14 rounded-2xl bg-[#10b981] hover:bg-[#059669] text-white text-[15px] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isValidating ? (
                <>
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {t('passwordEntry.checking')}
                </>
              ) : (
                <>
                  {t('passwordEntry.continue')}
                  <ArrowRight weight="bold" className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-10 flex items-center gap-2 text-[12px] text-apple-gray">
            <LockSimple weight="regular" className="w-3.5 h-3.5" />
            {t('passwordEntry.securityBadge')}
          </div>
        </div>
      </div>
    </section>
    </>
  )
}
