"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { ArrowLeft, ArrowRight, Eye, EyeSlash, LockSimple, WarningCircle } from "@phosphor-icons/react"

export default function MudurLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const res = await fetch("/api/mudur/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Giriş yapılamadı")
        return
      }

      router.push("/mudur")
      router.refresh()
    } catch {
      setError("Bir hata oluştu. Lütfen tekrar deneyin.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white overflow-x-clip">
      <LoginHeader />
      <main>
        <section className="min-h-screen grid lg:grid-cols-2 bg-white">
          {/* Sol: 3D signin ikonu — mobilde gizli */}
          <div className="relative hidden lg:flex items-center justify-center bg-apple-panel lg:min-h-screen px-6 py-24">
            <div className="relative w-full max-w-md aspect-square">
              <Image
                src="/images/signin.png"
                alt="Giriş"
                fill
                sizes="(max-width: 1024px) 80vw, 40vw"
                className="object-contain drop-shadow-[0_40px_80px_rgba(0,0,0,0.18)]"
                priority
              />
            </div>
          </div>

          {/* Sag: Giris formu */}
          <div className="flex items-center justify-center min-h-screen px-6 py-24">
            <div className="w-full max-w-md">
              <div className="mb-10">
                <p className="text-[13px] font-medium text-[#10b981] mb-4 tracking-wide uppercase">
                  Okul Paneli
                </p>
                <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-apple-ink leading-[1.05]">
                  <span className="text-gradient-green">Lütfen</span> giriş yapın.
                </h1>
                <p className="mt-5 text-[17px] text-apple-gray leading-relaxed">
                  Okul yönetim paneline erişmek için müdür hesabınızla giriş yapın.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="email" className="block text-[13px] font-medium text-apple-ink mb-2">
                    E-posta
                  </label>
                  <input
                    id="email"
                    type="email"
                    placeholder="mudur@okul.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    required
                    className="w-full h-14 px-5 text-[17px] bg-white border border-apple-border rounded-2xl transition-all outline-none placeholder:text-apple-gray/60 focus:border-apple-ink disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>

                <div>
                  <label htmlFor="password" className="block text-[13px] font-medium text-apple-ink mb-2">
                    Şifre
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Şifreniz"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={loading}
                      required
                      className="w-full h-14 px-5 pr-14 text-[17px] bg-white border border-apple-border rounded-2xl transition-all outline-none placeholder:text-apple-gray/60 focus:border-apple-ink disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-5 top-1/2 -translate-y-1/2 text-apple-gray hover:text-apple-ink transition-colors"
                      aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
                    >
                      {showPassword ? (
                        <EyeSlash weight="regular" className="w-5 h-5" />
                      ) : (
                        <Eye weight="regular" className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="flex items-center gap-2 text-red-600">
                    <WarningCircle weight="fill" className="w-4 h-4 flex-shrink-0" />
                    <span className="text-[13px] font-medium">{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-14 rounded-2xl bg-[#10b981] hover:bg-[#059669] text-white text-[15px] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Giriş yapılıyor…
                    </>
                  ) : (
                    <>
                      Giriş yap
                      <ArrowRight weight="bold" className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-10 flex items-center gap-2 text-[12px] text-apple-gray">
                <LockSimple weight="regular" className="w-3.5 h-3.5" />
                256-bit SSL · Şifreli bağlantı
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

// ==================== LOGIN HEADER ====================
// Ana sayfa ile ayni floating pill stili: solda logo + nav,
// sagda tek buton "Ana Sayfaya Dön".
function LoginHeader() {
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
