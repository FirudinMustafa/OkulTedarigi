'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, ArrowRight, Buildings, CheckCircle, LockSimple, WarningCircle } from '@phosphor-icons/react'

// Sinif kartlari icin gorsel arka plan listesi (public/images/class-bg/)
const CLASS_BG_VARIANTS = [
  'blue', 'green', 'purple',
  'pink', 'orange', 'yellow',
  'teal', 'lime', 'red'
] as const

interface PackageItem {
  id: string
  name: string
  quantity: number
}

interface Package {
  id: string
  name: string
  description: string | null
  note: string | null
  price: number
  items: PackageItem[]
}

interface ClassOption {
  id: string
  name: string
  package: Package | null
}

interface SchoolData {
  schoolId: string
  schoolName: string
  deliveryType: string
  classes: ClassOption[]
}

export default function SiparisPage() {
  return (
    <div className="min-h-screen bg-white overflow-x-clip">
      <OrderHeader />
      <main className="relative">
        <SchoolPasswordFlow />
      </main>
    </div>
  )
}

// ==================== ORDER HEADER ====================
// Ana sayfa ile ayni floating pill stili: solda logo + nav,
// sagda tek buton "Ana Sayfaya Dön".
function OrderHeader() {
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
          {/* Sol pill — logo + nav */}
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

          {/* Sag pill — Ana Sayfaya Don */}
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

// ==================== SCHOOL PASSWORD FLOW ====================
function SchoolPasswordFlow() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [isValidating, setIsValidating] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [schoolData, setSchoolData] = useState<SchoolData | null>(null)

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!password.trim()) {
      setErrorMessage('Lütfen okul şifrenizi girin')
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
        setErrorMessage(data.error || 'Geçersiz okul şifresi')
        setIsValidating(false)
        return
      }

      setSchoolData({
        schoolId: data.schoolId,
        schoolName: data.schoolName,
        deliveryType: data.deliveryType,
        classes: data.classes
      })
    } catch {
      setErrorMessage('Bir hata oluştu. Lütfen tekrar deneyin.')
    } finally {
      setIsValidating(false)
    }
  }

  const handleClassSelect = (cls: ClassOption) => {
    if (!schoolData || !cls.package) return

    sessionStorage.setItem('classData', JSON.stringify({
      classId: cls.id,
      className: cls.name,
      schoolId: schoolData.schoolId,
      schoolName: schoolData.schoolName,
      deliveryType: schoolData.deliveryType,
      package: cls.package
    }))

    router.push(`/paket/${cls.id}`)
  }

  // ========== SINIF SECIM EKRANI ==========
  if (schoolData) {
    return (
      <section className="min-h-screen pt-32 pb-20 px-6 lg:px-8 bg-apple-bg">
        <div className="max-w-6xl mx-auto">
          {/* Okul bilgisi */}
          <div className="mb-10 flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-apple-panel flex items-center justify-center">
              <Buildings weight="regular" className="w-6 h-6 text-apple-ink" />
            </div>
            <div>
              <p className="text-[15px] font-semibold text-apple-ink">{schoolData.schoolName}</p>
              <p className="text-[13px] text-apple-gray">
                {schoolData.deliveryType === 'CARGO' ? 'Kargo ile teslim' : 'Okula teslim'}
              </p>
            </div>
          </div>

          {/* Baslik */}
          <div className="mb-10 max-w-2xl">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight text-apple-ink leading-[1.05]">
              Sınıfını <span className="text-gradient-green">seç.</span>
            </h2>
            <p className="mt-4 text-lg text-apple-gray">Öğrencinizin sınıfını seçin, paketi görüntüleyin.</p>
          </div>

          {/* Sinif grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {schoolData.classes.map((cls, idx) => {
              const variant = CLASS_BG_VARIANTS[idx % CLASS_BG_VARIANTS.length]
              return (
                <button
                  key={cls.id}
                  onClick={() => handleClassSelect(cls)}
                  className="group relative text-left rounded-[28px] overflow-hidden border border-apple-border/60 bg-white shadow-[0_12px_32px_-20px_rgba(0,0,0,0.15)] hover:shadow-[0_24px_60px_-24px_rgba(0,0,0,0.25)] hover:-translate-y-0.5 transition-all"
                >
                  <div className="relative w-full aspect-[16/9] overflow-hidden">
                    <Image
                      src={`/images/class-bg/${variant}.png`}
                      alt={`${cls.name} sınıfı`}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="object-cover group-hover:scale-[1.03] transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                    <div className="absolute bottom-4 left-5 right-5">
                      <p className="text-white font-semibold text-xl tracking-tight drop-shadow-md">{cls.name} Sınıfı</p>
                    </div>
                  </div>

                  <div className="p-6 space-y-4">
                    {cls.package && (
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[14px] font-medium text-apple-ink line-clamp-1">{cls.package.name}</p>
                        <span className="text-lg font-semibold text-[#10b981] whitespace-nowrap">
                          {Number(cls.package.price).toFixed(2)} ₺
                        </span>
                      </div>
                    )}

                    {cls.package && cls.package.items.length > 0 && (
                      <div className="pt-4 border-t border-apple-border/60">
                        <p className="text-[11px] font-semibold text-apple-gray uppercase tracking-wide mb-2">
                          Paket içeriği
                        </p>
                        <div className="space-y-1.5">
                          {cls.package.items.slice(0, 4).map((item) => (
                            <div key={item.id} className="flex items-center gap-2">
                              <CheckCircle weight="fill" className="w-3.5 h-3.5 text-[#10b981] flex-shrink-0" />
                              <span className="text-[13px] text-apple-gray line-clamp-1">
                                {item.quantity > 1 && <span className="font-medium text-apple-ink">{item.quantity}× </span>}
                                {item.name}
                              </span>
                            </div>
                          ))}
                          {cls.package.items.length > 4 && (
                            <p className="text-[12px] text-apple-gray/80 italic pl-5">
                              +{cls.package.items.length - 4} ürün daha
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="pt-2 flex items-center justify-end text-[#10b981] text-[13px] font-medium gap-1">
                      Paketi görüntüle
                      <ArrowRight weight="bold" className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>
                </button>
              )
            })}
          </div>

          <button
            onClick={() => { setSchoolData(null); setPassword('') }}
            className="mt-10 mx-auto flex items-center gap-2 text-[13px] text-apple-gray hover:text-apple-ink transition-colors"
          >
            <ArrowLeft weight="regular" className="w-4 h-4" />
            Farklı bir okul şifresi girin
          </button>
        </div>
      </section>
    )
  }

  // ========== SIFRE GIRIS EKRANI — iki sutun ==========
  return (
    <section className="min-h-screen grid lg:grid-cols-2 bg-white">
      {/* Sol: 3D siparis ikonu — mobilde gizli */}
      <div className="relative hidden lg:flex items-center justify-center bg-apple-panel lg:min-h-screen px-6 py-24">
        <div className="relative w-full max-w-md aspect-square">
          <Image
            src="/images/pass.png"
            alt="Şifre"
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
          <div className="mb-10">
            <p className="text-[13px] font-medium text-[#10b981] mb-4 tracking-wide uppercase">
              Sipariş
            </p>
            <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-apple-ink leading-[1.05]">
              <span className="text-gradient-green">Lütfen</span> okul şifrenizi girin.
            </h1>
            <p className="mt-5 text-[17px] text-apple-gray leading-relaxed">
              Okulundan aldığın sınıf şifresini gir, paketini gör, ödemeni tamamla. Üyelik gerekmiyor.
            </p>
          </div>

          <form onSubmit={handlePasswordSubmit} className="space-y-5">
            <div>
              <label htmlFor="schoolPassword" className="block text-[13px] font-medium text-apple-ink mb-2">
                Okul Şifresi
              </label>
              <input
                id="schoolPassword"
                type="text"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value.toUpperCase())
                  setErrorMessage('')
                }}
                placeholder="Örn: ATATURK2024"
                disabled={isValidating}
                className={`w-full h-14 px-5 text-[17px] bg-white border rounded-2xl transition-all outline-none font-mono tracking-wider placeholder:text-apple-gray/60 placeholder:font-sans placeholder:tracking-normal ${
                  errorMessage
                    ? 'border-red-400 focus:border-red-500'
                    : 'border-apple-border focus:border-apple-ink'
                } disabled:opacity-60 disabled:cursor-not-allowed`}
                autoComplete="off"
                autoFocus
              />
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
                  Kontrol ediliyor…
                </>
              ) : (
                <>
                  Devam et
                  <ArrowRight weight="bold" className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-10 flex items-center gap-2 text-[12px] text-apple-gray">
            <LockSimple weight="regular" className="w-3.5 h-3.5" />
            256-bit SSL · 3D Secure güvenli ödeme
          </div>
        </div>
      </div>
    </section>
  )
}
