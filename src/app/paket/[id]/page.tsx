"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import ilIlceData from "@/data/il-ilce.json"
import { formatPrice, isValidTCKimlik } from "@/lib/utils"

interface PackageItem {
  id: string
  name: string
  quantity: number
}

interface ClassData {
  id: string
  name: string
  school: {
    id: string
    name: string
    address?: string
    deliveryType: "CARGO" | "SCHOOL_DELIVERY"
  }
  package: {
    id: string
    name: string
    description: string | null
    note: string | null
    price: number
    items: PackageItem[]
  }
}

// Icons
const BookIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
  </svg>
)

const ArrowLeftIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
  </svg>
)

const CheckIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
  </svg>
)

const TruckIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
  </svg>
)

const SchoolIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" />
  </svg>
)

const Spinner = () => (
  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
  </svg>
)

const CloseIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
)

export default function PaketPage() {
  const router = useRouter()
  const params = useParams()
  const classId = params.id as string

  const [classData, setClassData] = useState<ClassData | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [showPaymentModal, setShowPaymentModal] = useState(false)

  // Form state - Kişisel Bilgiler
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [companyName, setCompanyName] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")

  // Form state - Adres Bilgileri (Kargo için)
  const [country, setCountry] = useState("Türkiye")
  const [streetAddress, setStreetAddress] = useState("")
  const [streetAddress2, setStreetAddress2] = useState("")
  const [selectedIl, setSelectedIl] = useState("")
  const [selectedIlce, setSelectedIlce] = useState("")
  const [postalCode, setPostalCode] = useState("")

  // Alternatif Teslimat Adresi
  const [shipToDifferentAddress, setShipToDifferentAddress] = useState(false)
  const [altCountry, setAltCountry] = useState("Türkiye")
  const [altStreetAddress, setAltStreetAddress] = useState("")
  const [altStreetAddress2, setAltStreetAddress2] = useState("")
  const [altSelectedIl, setAltSelectedIl] = useState("")
  const [altSelectedIlce, setAltSelectedIlce] = useState("")
  const [altPostalCode, setAltPostalCode] = useState("")

  // Form state - Öğrenci Bilgileri
  const [studentFirstName, setStudentFirstName] = useState("")
  const [studentLastName, setStudentLastName] = useState("")

  // Form state - Ek Alanlar
  const [orderNote, setOrderNote] = useState("")

  // Form state - Indirim Kodu
  const [discountCode, setDiscountCode] = useState("")
  const [discountApplied, setDiscountApplied] = useState<{
    code: string
    description: string | null
    type: string
    value: number
    discountAmount: number
  } | null>(null)
  const [discountError, setDiscountError] = useState("")
  const [discountLoading, setDiscountLoading] = useState(false)

  // Form state - Yasal Onaylar
  const [acceptMesafeliSatis, setAcceptMesafeliSatis] = useState(false)
  const [acceptKVKK, setAcceptKVKK] = useState(false)

  // Fatura bilgileri
  const [invoiceType, setInvoiceType] = useState<'bireysel' | 'kurumsal'>('bireysel')
  const [isCorporateInvoice, setIsCorporateInvoice] = useState(false)
  const [companyTitle, setCompanyTitle] = useState("")
  const [taxNumber, setTaxNumber] = useState("")
  const [taxOffice, setTaxOffice] = useState("")
  const [tcNumber, setTcNumber] = useState("")

  // Fatura adresi (farkli adres secenegi)
  const [invoiceAddressSame, setInvoiceAddressSame] = useState(true)
  const [invoiceStreetAddress, setInvoiceStreetAddress] = useState("")
  const [invoiceStreetAddress2, setInvoiceStreetAddress2] = useState("")
  const [invoiceSelectedIl, setInvoiceSelectedIl] = useState("")
  const [invoiceSelectedIlce, setInvoiceSelectedIlce] = useState("")
  const [invoicePostalCode, setInvoicePostalCode] = useState("")

  // Odeme yontemi (sadece kredi karti destekleniyor)
  const paymentMethod = "CREDIT_CARD" as const

  // Ogrenci sube bilgisi
  const [studentSection, setStudentSection] = useState("")

  // Real-time field validation: onBlur'da kontrol edilen alan-bazli hata mesajlari
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  // Helper: tek bir alanin hatasini set/clear et
  const setFieldError = (field: string, message: string) => {
    setFieldErrors(prev => {
      if (!message) {
        if (!prev[field]) return prev
        const rest = { ...prev }
        delete rest[field]
        return rest
      }
      if (prev[field] === message) return prev
      return { ...prev, [field]: message }
    })
  }

  // onBlur handler'lari (anlik dogrulama)
  const validateEmail = (val: string) => {
    if (!val) { setFieldError('email', ''); return }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    setFieldError('email', emailRegex.test(val) ? '' : 'Geçerli bir e-posta adresi giriniz')
  }
  const validatePhone = (val: string) => {
    if (!val) { setFieldError('phone', ''); return }
    const normalized = val.replace(/[\s\-()]/g, '')
    setFieldError('phone', /^0?5\d{9}$/.test(normalized) ? '' : 'Geçerli bir telefon numarası giriniz (05XX XXX XX XX)')
  }
  const validateTC = (val: string) => {
    if (!val) { setFieldError('tcNumber', ''); return }
    if (!/^\d{11}$/.test(val)) { setFieldError('tcNumber', 'TC Kimlik No 11 haneli olmalı'); return }
    setFieldError('tcNumber', isValidTCKimlik(val) ? '' : 'Geçerli bir TC Kimlik Numarası giriniz')
  }
  const validateTaxNumber = (val: string) => {
    if (!val) { setFieldError('taxNumber', ''); return }
    setFieldError('taxNumber', /^\d{10,11}$/.test(val) ? '' : 'Vergi/TC No 10 veya 11 haneli rakam olmalı')
  }

  // Ülke listesi
  const countries = [
    "Türkiye", "Almanya", "Fransa", "İngiltere", "Hollanda", "Belçika",
    "Avusturya", "İsviçre", "İsveç", "Norveç", "Danimarka", "ABD", "Kanada",
    "Avustralya", "Kuzey Kıbrıs", "Azerbaycan", "Kazakistan", "Özbekistan"
  ]

  // İl/İlçe seçimi
  const ilceler = ilIlceData.iller.find(il => il.name === selectedIl)?.ilceler || []
  const altIlceler = ilIlceData.iller.find(il => il.name === altSelectedIl)?.ilceler || []
  const invoiceIlceler = ilIlceData.iller.find(il => il.name === invoiceSelectedIl)?.ilceler || []

  useEffect(() => {
    loadClassData()
  }, [classId])

  // F5 koruması: form state'i localStorage'a kaydet (debounced)
  // Sayfa yenilense de veri kaybolmaz. Kart bilgileri, sifre vb. asla kaydedilmez.
  const FORM_STORAGE_KEY = `paket-form-${classId}`

  // Restore: ilk mount'ta saklanan veri varsa state'lere yukle
  useEffect(() => {
    if (!classId) return
    try {
      const raw = localStorage.getItem(FORM_STORAGE_KEY)
      if (!raw) return
      const data = JSON.parse(raw)
      // 24 saatten eski veriyi at
      if (data.savedAt && Date.now() - data.savedAt > 24 * 60 * 60 * 1000) {
        localStorage.removeItem(FORM_STORAGE_KEY)
        return
      }
      if (data.firstName !== undefined) setFirstName(data.firstName)
      if (data.lastName !== undefined) setLastName(data.lastName)
      if (data.companyName !== undefined) setCompanyName(data.companyName)
      if (data.phone !== undefined) setPhone(data.phone)
      if (data.email !== undefined) setEmail(data.email)
      if (data.country !== undefined) setCountry(data.country)
      if (data.streetAddress !== undefined) setStreetAddress(data.streetAddress)
      if (data.streetAddress2 !== undefined) setStreetAddress2(data.streetAddress2)
      if (data.selectedIl !== undefined) setSelectedIl(data.selectedIl)
      if (data.selectedIlce !== undefined) setSelectedIlce(data.selectedIlce)
      if (data.postalCode !== undefined) setPostalCode(data.postalCode)
      if (data.shipToDifferentAddress !== undefined) setShipToDifferentAddress(data.shipToDifferentAddress)
      if (data.altCountry !== undefined) setAltCountry(data.altCountry)
      if (data.altStreetAddress !== undefined) setAltStreetAddress(data.altStreetAddress)
      if (data.altStreetAddress2 !== undefined) setAltStreetAddress2(data.altStreetAddress2)
      if (data.altSelectedIl !== undefined) setAltSelectedIl(data.altSelectedIl)
      if (data.altSelectedIlce !== undefined) setAltSelectedIlce(data.altSelectedIlce)
      if (data.altPostalCode !== undefined) setAltPostalCode(data.altPostalCode)
      if (data.studentFirstName !== undefined) setStudentFirstName(data.studentFirstName)
      if (data.studentLastName !== undefined) setStudentLastName(data.studentLastName)
      if (data.orderNote !== undefined) setOrderNote(data.orderNote)
      if (data.invoiceType !== undefined) setInvoiceType(data.invoiceType)
      if (data.isCorporateInvoice !== undefined) setIsCorporateInvoice(data.isCorporateInvoice)
      if (data.companyTitle !== undefined) setCompanyTitle(data.companyTitle)
      if (data.taxNumber !== undefined) setTaxNumber(data.taxNumber)
      if (data.taxOffice !== undefined) setTaxOffice(data.taxOffice)
      if (data.tcNumber !== undefined) setTcNumber(data.tcNumber)
      if (data.invoiceAddressSame !== undefined) setInvoiceAddressSame(data.invoiceAddressSame)
      if (data.invoiceStreetAddress !== undefined) setInvoiceStreetAddress(data.invoiceStreetAddress)
      if (data.invoiceStreetAddress2 !== undefined) setInvoiceStreetAddress2(data.invoiceStreetAddress2)
      if (data.invoiceSelectedIl !== undefined) setInvoiceSelectedIl(data.invoiceSelectedIl)
      if (data.invoiceSelectedIlce !== undefined) setInvoiceSelectedIlce(data.invoiceSelectedIlce)
      if (data.invoicePostalCode !== undefined) setInvoicePostalCode(data.invoicePostalCode)
      if (data.studentSection !== undefined) setStudentSection(data.studentSection)
    } catch {
      // Bozuk JSON varsa temizle
      try { localStorage.removeItem(FORM_STORAGE_KEY) } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId])

  // Save: form alanlari her degistiginde 500ms debounced kaydet
  useEffect(() => {
    if (!classId || loading) return
    const handle = setTimeout(() => {
      try {
        const snapshot = {
          savedAt: Date.now(),
          firstName, lastName, companyName, phone, email,
          country, streetAddress, streetAddress2, selectedIl, selectedIlce, postalCode,
          shipToDifferentAddress, altCountry, altStreetAddress, altStreetAddress2,
          altSelectedIl, altSelectedIlce, altPostalCode,
          studentFirstName, studentLastName, orderNote,
          invoiceType, isCorporateInvoice, companyTitle, taxNumber, taxOffice, tcNumber,
          invoiceAddressSame, invoiceStreetAddress, invoiceStreetAddress2,
          invoiceSelectedIl, invoiceSelectedIlce, invoicePostalCode,
          studentSection,
        }
        localStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(snapshot))
      } catch {
        // localStorage doluysa sessizce ignore
      }
    }, 500)
    return () => clearTimeout(handle)
  }, [
    classId, loading,
    firstName, lastName, companyName, phone, email,
    country, streetAddress, streetAddress2, selectedIl, selectedIlce, postalCode,
    shipToDifferentAddress, altCountry, altStreetAddress, altStreetAddress2,
    altSelectedIl, altSelectedIlce, altPostalCode,
    studentFirstName, studentLastName, orderNote,
    invoiceType, isCorporateInvoice, companyTitle, taxNumber, taxOffice, tcNumber,
    invoiceAddressSame, invoiceStreetAddress, invoiceStreetAddress2,
    invoiceSelectedIl, invoiceSelectedIlce, invoicePostalCode,
    studentSection, FORM_STORAGE_KEY
  ])

  useEffect(() => {
    // İl değiştiğinde ilçeyi sıfırla
    setSelectedIlce("")
  }, [selectedIl])

  useEffect(() => {
    // Alternatif adres - İl değiştiğinde ilçeyi sıfırla
    setAltSelectedIlce("")
  }, [altSelectedIl])

  useEffect(() => {
    // Fatura adresi - İl değiştiğinde ilçeyi sıfırla
    setInvoiceSelectedIlce("")
  }, [invoiceSelectedIl])

  // Modal: Escape tusu ile kapat (a11y)
  useEffect(() => {
    if (!showPaymentModal) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) {
        setShowPaymentModal(false)
      }
    }
    document.addEventListener('keydown', handleKey)
    // Modal acikken body scroll'u kilitle
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = prevOverflow
    }
  }, [showPaymentModal, submitting])

  const loadClassData = () => {
    try {
      // Önce sessionStorage'dan oku (sifre dogrulama sonrasi kaydedilmis)
      const storedData = sessionStorage.getItem('classData')

      if (storedData) {
        const parsed = JSON.parse(storedData)

        // classId eslesiyor mu kontrol et
        if (parsed.classId === classId) {
          setClassData({
            id: parsed.classId,
            name: parsed.className,
            school: {
              id: parsed.schoolId,
              name: parsed.schoolName,
              deliveryType: parsed.deliveryType
            },
            package: parsed.package
          })
          setLoading(false)
          return
        }
      }

      // SessionStorage'da veri yoksa veya classId eslesmiyorsa siparis sayfasina yonlendir
      router.push('/siparis')
    } catch {
      // Hata durumunda siparis sayfasina yonlendir
      router.push('/siparis')
    }
  }

  const handleApplyDiscount = async () => {
    if (!discountCode.trim()) return

    setDiscountLoading(true)
    setDiscountError("")

    try {
      const res = await fetch("/api/veli/discount", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: discountCode.trim(),
          totalAmount: classData?.package.price || 0
        })
      })

      const data = await res.json()

      if (!res.ok) {
        setDiscountError(data.error)
        setDiscountApplied(null)
      } else {
        setDiscountApplied(data.discount)
        setDiscountError("")
      }
    } catch {
      setDiscountError("Bir hata olustu")
    } finally {
      setDiscountLoading(false)
    }
  }

  const handleRemoveDiscount = () => {
    setDiscountApplied(null)
    setDiscountCode("")
    setDiscountError("")
  }

  const getFinalPrice = () => {
    const basePrice = classData?.package.price || 0
    if (discountApplied) {
      return Number(basePrice) - discountApplied.discountAmount
    }
    return Number(basePrice)
  }

  const validateForm = (): boolean => {
    // Kişisel bilgiler
    if (!firstName || !lastName || !phone || !email) {
      setError("Lütfen zorunlu kişisel bilgileri doldurun")
      return false
    }

    // Telefon format kontrolü (bosluk, tire, parantez tolere et)
    const phoneRegex = /^05\d{9}$/
    const normalizedPhone = phone.replace(/[\s\-()]/g, '')
    if (!phoneRegex.test(normalizedPhone)) {
      setError("Lütfen geçerli bir telefon numarası girin (05XX XXX XX XX)")
      return false
    }

    // Email format kontrolü
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      setError("Lütfen geçerli bir e-posta adresi girin")
      return false
    }

    // Öğrenci bilgileri
    if (!studentFirstName || !studentLastName) {
      setError("Lütfen öğrenci bilgilerini doldurun")
      return false
    }

    // Bireysel fatura: TC kimlik no zorunlu
    if (invoiceType === 'bireysel') {
      if (!tcNumber) {
        setError("TC Kimlik Numarası zorunludur")
        return false
      }
      if (!isValidTCKimlik(tcNumber)) {
        setError("Geçerli bir TC Kimlik Numarası giriniz")
        return false
      }
    }

    // Adres zorunlu durumlar:
    //  - Kargo teslimat (sevk adresi gerekli)
    //  - Bireysel fatura (fatura/iletisim adresi gerekli)
    //  - Kurumsal fatura (firma adresi gerekli)
    if (!country || !streetAddress || !postalCode) {
      setError("Lütfen adres bilgilerinizi eksiksiz doldurun")
      return false
    }
    // Türkiye seçiliyse il/ilçe zorunlu
    if (country === "Türkiye" && (!selectedIl || !selectedIlce)) {
      setError("Lütfen il ve ilçe seçiniz")
      return false
    }

    // Kargo teslim için alternatif adres seçiliyse kontrol et
    if (classData?.school.deliveryType === "CARGO" && shipToDifferentAddress) {
      if (!altCountry || !altStreetAddress || !altPostalCode) {
        setError("Alternatif teslimat adresi bilgilerini eksiksiz doldurun")
        return false
      }
      if (altCountry === "Türkiye" && (!altSelectedIl || !altSelectedIlce)) {
        setError("Alternatif adres için il ve ilçe seçiniz")
        return false
      }
    }

    // Kurumsal fatura için vergi bilgileri
    if (invoiceType === 'kurumsal') {
      if (!taxNumber || !taxOffice || !companyTitle) {
        setError("Kurumsal fatura için Vergi No, Firma Ünvanı ve Vergi Dairesi zorunludur")
        return false
      }
    }

    // Bireysel fatura icin fatura adresi farkli secilmisse kontrol
    if (invoiceType === 'bireysel' && !invoiceAddressSame) {
      if (!invoiceStreetAddress || !invoiceSelectedIl || !invoiceSelectedIlce || !invoicePostalCode) {
        setError("Fatura adresi bilgilerini eksiksiz doldurun")
        return false
      }
    }
    // Kurumsal fatura adresi kontrolu (kargo ise)
    if (invoiceType === 'kurumsal' && !invoiceAddressSame && classData?.school.deliveryType === "CARGO") {
      if (!invoiceStreetAddress || !invoiceSelectedIl || !invoiceSelectedIlce || !invoicePostalCode) {
        setError("Fatura adresi bilgilerini eksiksiz doldurun")
        return false
      }
    }

    // Yasal onaylar
    if (!acceptMesafeliSatis || !acceptKVKK) {
      setError("Devam etmek için sözleşmeleri kabul etmeniz gerekmektedir")
      return false
    }

    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!validateForm()) return

    // Ödeme modalını aç
    setShowPaymentModal(true)
  }

  const handlePaymentConfirm = async () => {
    setSubmitting(true)
    setShowPaymentModal(false)

    try {
      // Adres her durumda olusturulur:
      //  - Kargo teslim: sevk + iletisim adresi
      //  - Bireysel fatura: fatura/iletisim adresi
      //  - Kurumsal fatura: firma adresi
      const addressParts = [streetAddress]
      if (streetAddress2) addressParts.push(streetAddress2)
      if (country === "Türkiye") {
        addressParts.push(selectedIlce, selectedIl)
      }
      addressParts.push(postalCode, country)
      const fullAddress = addressParts.join(', ')

      // Alternatif teslimat adresi oluştur
      let altAddress = null
      if (shipToDifferentAddress && classData?.school.deliveryType === "CARGO") {
        const altParts = [altStreetAddress]
        if (altStreetAddress2) altParts.push(altStreetAddress2)
        if (altCountry === "Türkiye") {
          altParts.push(altSelectedIlce, altSelectedIl)
        }
        altParts.push(altPostalCode, altCountry)
        altAddress = altParts.join(', ')
      }

      // Fatura adresi oluştur (farklı adres seçildiyse)
      let invoiceAddr = null
      if (!invoiceAddressSame && classData?.school.deliveryType === "CARGO") {
        const invParts = [invoiceStreetAddress]
        if (invoiceStreetAddress2) invParts.push(invoiceStreetAddress2)
        invParts.push(invoiceSelectedIlce, invoiceSelectedIl)
        invParts.push(invoicePostalCode, 'Türkiye')
        invoiceAddr = invParts.join(', ')
      }

      const res = await fetch("/api/veli/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId,
          parentName: `${firstName} ${lastName}`,
          companyName: companyName || null,
          studentName: `${studentFirstName} ${studentLastName}`,
          studentSection: studentSection || null,
          phone: phone.replace(/\s/g, ''),
          email,
          address: fullAddress,
          deliveryAddress: shipToDifferentAddress ? altAddress : null,
          invoiceAddress: invoiceAddr,
          invoiceAddressSame,
          isCorporateInvoice: invoiceType === 'kurumsal',
          companyTitle: invoiceType === 'kurumsal' ? companyTitle : null,
          taxNumber: invoiceType === 'kurumsal' ? taxNumber : (tcNumber || null),
          taxOffice: invoiceType === 'kurumsal' ? taxOffice : null,
          orderNote,
          discountCode: discountApplied ? discountApplied.code : null,
          paymentMethod
        })
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Sipariş oluşturulamadı")
        setSubmitting(false)
        return
      }

      // Basarili siparis sonrasi form draft'ini temizle (F5 koruma kaydi)
      try { localStorage.removeItem(FORM_STORAGE_KEY) } catch {}

      // Kredi karti odeme sayfasina yonlendir (accessToken ile — F-04 IDOR koruması)
      const tokenParam = data.accessToken ? `?t=${encodeURIComponent(data.accessToken)}` : ''
      router.push(`/odeme/${data.orderId}${tokenParam}`)

    } catch {
      setError("Sipariş oluşturulurken hata oluştu")
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex items-center gap-3 text-gray-600">
          <Spinner />
          <span>Yükleniyor...</span>
        </div>
      </div>
    )
  }

  if (error && !classData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8 max-w-md text-center">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Hata</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => router.push("/")}
            className="inline-flex items-center gap-2 bg-blue-900 hover:bg-blue-800 text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            <ArrowLeftIcon />
            Ana Sayfaya Dön
          </button>
        </div>
      </div>
    )
  }

  if (!classData) return null

  const isCargoDelivery = classData.school.deliveryType === "CARGO"

  // Adres input'lari (ulke/il/ilce/sokak/posta kodu) - kargo, bireysel okula teslim ve kurumsal okula teslim icin yeniden kullanilir
  const renderAddressFields = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Ülke *</label>
        <select
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          required
        >
          {countries.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>
      {country === "Türkiye" && (
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">İl *</label>
            <select
              value={selectedIl}
              onChange={(e) => setSelectedIl(e.target.value)}
              className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              required
            >
              <option value="">İl Seçiniz</option>
              {ilIlceData.iller.map((il) => (
                <option key={il.id} value={il.name}>{il.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">İlçe / Semt *</label>
            <select
              value={selectedIlce}
              onChange={(e) => setSelectedIlce(e.target.value)}
              className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              required
              disabled={!selectedIl}
            >
              <option value="">
                {selectedIl ? "İlçe Seçiniz" : "Önce il seçiniz"}
              </option>
              {ilceler.map((ilce) => (
                <option key={ilce} value={ilce}>{ilce}</option>
              ))}
            </select>
          </div>
        </div>
      )}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Sokak Adresi *</label>
        <input
          type="text"
          value={streetAddress}
          onChange={(e) => setStreetAddress(e.target.value)}
          placeholder="Bina numarası ve sokak adı"
          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Apartman, daire, oda vb. (Opsiyonel)</label>
        <input
          type="text"
          value={streetAddress2}
          onChange={(e) => setStreetAddress2(e.target.value)}
          placeholder="Apartman adı, kat, daire no, vb."
          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Posta Kodu *</label>
        <input
          type="text"
          value={postalCode}
          onChange={(e) => setPostalCode(e.target.value)}
          placeholder="34000"
          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 max-w-[200px]"
          required
        />
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="relative w-10 h-10 flex items-center justify-center">
                <svg className="w-9 h-9 text-red-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
                </svg>
                <div className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-amber-400 rounded-full flex items-center justify-center">
                  <svg className="w-2.5 h-2.5 text-amber-900" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                  </svg>
                </div>
              </div>
              <span className="text-xl font-extrabold tracking-tight">
                <span className="text-gray-900">okultedarigim</span><span className="text-red-600">.com</span>
              </span>
            </Link>
            <button
              onClick={() => router.push("/")}
              className="flex items-center gap-2 text-gray-600 hover:text-blue-900 transition-colors"
            >
              <ArrowLeftIcon />
              <span className="hidden sm:inline">Geri</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <form onSubmit={handleSubmit}>
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Sol - Form Alanları */}
            <div className="lg:col-span-2 space-y-6">
              {/* Okul/Sınıf Bilgisi */}
              <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-900 rounded-lg flex items-center justify-center text-white">
                    <SchoolIcon />
                  </div>
                  <div>
                    <p className="text-sm text-blue-700">{classData.school.name}</p>
                    <p className="font-semibold text-blue-900">{classData.name} Sınıfı</p>
                  </div>
                  <div className="ml-auto">
                    {isCargoDelivery ? (
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                        <TruckIcon />
                        Kargo ile Teslim
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                        <SchoolIcon />
                        Okula Teslim
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* 👤 Fatura & İletişim Bilgileri */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">👤 Fatura & İletişim Bilgileri</h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Ad *</label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Soyad *</label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Firma Adı (Opsiyonel)</label>
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Telefon *</label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => { setPhone(e.target.value); if (fieldErrors.phone) validatePhone(e.target.value) }}
                      onBlur={(e) => validatePhone(e.target.value)}
                      placeholder="05XX XXX XX XX"
                      autoComplete="tel"
                      className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-1 ${fieldErrors.phone ? 'border-red-400 focus:border-red-500 focus:ring-red-400' : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'}`}
                      required
                    />
                    {fieldErrors.phone && <p className="mt-1 text-xs text-red-600">{fieldErrors.phone}</p>}
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">E-posta *</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); if (fieldErrors.email) validateEmail(e.target.value) }}
                      onBlur={(e) => validateEmail(e.target.value)}
                      autoComplete="email"
                      className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-1 ${fieldErrors.email ? 'border-red-400 focus:border-red-500 focus:ring-red-400' : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'}`}
                      required
                    />
                    {fieldErrors.email && <p className="mt-1 text-xs text-red-600">{fieldErrors.email}</p>}
                  </div>
                </div>
              </div>

              {/* Okula Teslim Bilgisi */}
              {!isCargoDelivery && (
                <div className="bg-green-50 rounded-xl p-6 border border-green-100">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center text-green-700 flex-shrink-0">
                      <SchoolIcon />
                    </div>
                    <div>
                      <h3 className="font-semibold text-green-900 mb-1">Okula Teslim</h3>
                      <p className="text-green-700 text-sm">
                        Siparişiniz, okulunuz tarafından belirlenen teslim tarihinde okulunuza teslim edilecektir.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Adres Bilgileri - kargo teslimatta veya bireysel fatura icin */}
              {(isCargoDelivery || invoiceType === 'bireysel') && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    📍 {isCargoDelivery ? 'Teslimat ve Fatura Adresi' : 'Fatura ve Iletisim Adresi'}
                  </h3>
                  {renderAddressFields()}
                </div>
              )}

              {/* 🚚 Alternatif Teslimat Adresi */}
              {isCargoDelivery && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={shipToDifferentAddress}
                      onChange={(e) => setShipToDifferentAddress(e.target.checked)}
                      className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-gray-900 font-medium">🚚 Farklı bir adrese gönder</span>
                  </label>

                  {shipToDifferentAddress && (
                    <div className="mt-6 pt-6 border-t border-gray-100 space-y-4">
                      <h4 className="text-sm font-semibold text-gray-700 mb-3">Alternatif Teslimat Adresi</h4>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Ülke *</label>
                        <select
                          value={altCountry}
                          onChange={(e) => setAltCountry(e.target.value)}
                          className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                          required
                        >
                          {countries.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                      {altCountry === "Türkiye" && (
                        <div className="grid sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">İl *</label>
                            <select
                              value={altSelectedIl}
                              onChange={(e) => setAltSelectedIl(e.target.value)}
                              className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                              required
                            >
                              <option value="">İl Seçiniz</option>
                              {ilIlceData.iller.map((il) => (
                                <option key={il.id} value={il.name}>{il.name}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">İlçe / Semt *</label>
                            <select
                              value={altSelectedIlce}
                              onChange={(e) => setAltSelectedIlce(e.target.value)}
                              className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                              required
                              disabled={!altSelectedIl}
                            >
                              <option value="">
                                {altSelectedIl ? "İlçe Seçiniz" : "Önce il seçiniz"}
                              </option>
                              {altIlceler.map((ilce) => (
                                <option key={ilce} value={ilce}>{ilce}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      )}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Sokak Adresi *</label>
                        <input
                          type="text"
                          value={altStreetAddress}
                          onChange={(e) => setAltStreetAddress(e.target.value)}
                          placeholder="Bina numarası ve sokak adı"
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Apartman, daire, oda vb. (Opsiyonel)</label>
                        <input
                          type="text"
                          value={altStreetAddress2}
                          onChange={(e) => setAltStreetAddress2(e.target.value)}
                          placeholder="Apartman adı, kat, daire no, vb."
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Posta Kodu *</label>
                        <input
                          type="text"
                          value={altPostalCode}
                          onChange={(e) => setAltPostalCode(e.target.value)}
                          placeholder="34000"
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 max-w-[200px]"
                          required
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 🎓 Öğrenci Bilgileri */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">🎓 Öğrenci Bilgileri</h3>
                <div className="grid sm:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Öğrenci Adı *</label>
                    <input
                      type="text"
                      value={studentFirstName}
                      onChange={(e) => setStudentFirstName(e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Öğrenci Soyadı *</label>
                    <input
                      type="text"
                      value={studentLastName}
                      onChange={(e) => setStudentLastName(e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Sınıf *</label>
                    <input
                      type="text"
                      value={classData.name}
                      disabled
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-gray-600"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Şube <span className="text-gray-400 text-xs">(Opsiyonel)</span>
                    </label>
                    <input
                      type="text"
                      value={studentSection}
                      onChange={(e) => setStudentSection(e.target.value.toUpperCase().slice(0, 4))}
                      placeholder="A, B, C..."
                      maxLength={4}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* 🧾 Fatura Bilgileri */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">🧾 Fatura Bilgileri</h3>

                {/* Bireysel/Kurumsal Seçimi */}
                <div className="flex gap-3 mb-5">
                  <button
                    type="button"
                    onClick={() => { setInvoiceType('bireysel'); setIsCorporateInvoice(false) }}
                    className={`flex-1 py-3 px-4 rounded-xl border-2 font-medium text-sm transition-all ${
                      invoiceType === 'bireysel'
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    👤 Bireysel
                  </button>
                  <button
                    type="button"
                    onClick={() => { setInvoiceType('kurumsal'); setIsCorporateInvoice(true) }}
                    className={`flex-1 py-3 px-4 rounded-xl border-2 font-medium text-sm transition-all ${
                      invoiceType === 'kurumsal'
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    🏢 Kurumsal
                  </button>
                </div>

                {/* Bireysel Fatura Alanları */}
                {invoiceType === 'bireysel' && (
                  <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Ad Soyad</label>
                        <input
                          type="text"
                          value={`${firstName} ${lastName}`.trim()}
                          disabled
                          className="w-full px-4 py-2.5 border border-gray-200 rounded-lg bg-white text-gray-600"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">TC Kimlik No *</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={tcNumber}
                          onChange={(e) => {
                            const v = e.target.value.replace(/\D/g, '').slice(0, 11)
                            setTcNumber(v)
                            if (fieldErrors.tcNumber) validateTC(v)
                          }}
                          onBlur={(e) => validateTC(e.target.value)}
                          placeholder="11 haneli TC no"
                          maxLength={11}
                          className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-1 ${fieldErrors.tcNumber ? 'border-red-400 focus:border-red-500 focus:ring-red-400' : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'}`}
                          required={invoiceType === 'bireysel'}
                        />
                        {fieldErrors.tcNumber && <p className="mt-1 text-xs text-red-600">{fieldErrors.tcNumber}</p>}
                      </div>
                    </div>
                    {isCargoDelivery && (
                      <p className="text-xs text-gray-500">Fatura ve sevk adresi asagidaki adres bilgilerinden alinacaktir.</p>
                    )}
                  </div>
                )}

                {/* Kurumsal Fatura Alanları */}
                {invoiceType === 'kurumsal' && (
                  <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                    <h4 className="text-sm font-semibold text-gray-700">Firma Bilgileri</h4>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Vergi No *</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={taxNumber}
                          onChange={(e) => {
                            const v = e.target.value.replace(/\D/g, '').slice(0, 11)
                            setTaxNumber(v)
                            if (fieldErrors.taxNumber) validateTaxNumber(v)
                          }}
                          onBlur={(e) => validateTaxNumber(e.target.value)}
                          placeholder="10 haneli vergi numarasi"
                          maxLength={11}
                          className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-1 ${fieldErrors.taxNumber ? 'border-red-400 focus:border-red-500 focus:ring-red-400' : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'}`}
                          required={invoiceType === 'kurumsal'}
                        />
                        {fieldErrors.taxNumber && <p className="mt-1 text-xs text-red-600">{fieldErrors.taxNumber}</p>}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Firma Ünvanı *</label>
                        <input
                          type="text"
                          value={companyTitle}
                          onChange={(e) => setCompanyTitle(e.target.value)}
                          placeholder="Şirket veya şahıs ismi"
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                          required={invoiceType === 'kurumsal'}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Vergi Dairesi *</label>
                        <input
                          type="text"
                          value={taxOffice}
                          onChange={(e) => setTaxOffice(e.target.value)}
                          placeholder="Vergi dairesi adı"
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                          required={invoiceType === 'kurumsal'}
                        />
                      </div>
                    </div>
                    {isCargoDelivery ? (
                      <div className="pt-2 border-t border-gray-200">
                        <p className="text-xs font-semibold text-gray-600 mb-1">Firma Adresi</p>
                        <p className="text-xs text-gray-500">Fatura adresi asagidaki adres bilgilerinden alinacaktir. Farkli bir firma adresi icin asagida &quot;Faturami ayni adrese gonder&quot; secenegini kaldirin.</p>
                      </div>
                    ) : (
                      <div className="pt-4 border-t border-gray-200">
                        <h4 className="text-sm font-semibold text-gray-700 mb-3">📍 Firma Adresi</h4>
                        {renderAddressFields()}
                      </div>
                    )}
                  </div>
                )}

                {/* Fatura Adresi - Sadece Kargo Teslim ise */}
                {isCargoDelivery && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={invoiceAddressSame}
                        onChange={(e) => setInvoiceAddressSame(e.target.checked)}
                        className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-gray-700">Faturamı aynı adrese gönder</span>
                    </label>

                    {!invoiceAddressSame && (
                      <div className="mt-4 space-y-4 p-4 bg-gray-50 rounded-lg">
                        <h4 className="text-sm font-semibold text-gray-700">Fatura Adresi</h4>
                        <div className="grid sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">İl *</label>
                            <select
                              value={invoiceSelectedIl}
                              onChange={(e) => setInvoiceSelectedIl(e.target.value)}
                              className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                              required={!invoiceAddressSame}
                            >
                              <option value="">İl Seçiniz</option>
                              {ilIlceData.iller.map((il) => (
                                <option key={il.id} value={il.name}>{il.name}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">İlçe *</label>
                            <select
                              value={invoiceSelectedIlce}
                              onChange={(e) => setInvoiceSelectedIlce(e.target.value)}
                              className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                              required={!invoiceAddressSame}
                              disabled={!invoiceSelectedIl}
                            >
                              <option value="">
                                {invoiceSelectedIl ? "İlçe Seçiniz" : "Önce il seçiniz"}
                              </option>
                              {invoiceIlceler.map((ilce) => (
                                <option key={ilce} value={ilce}>{ilce}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Sokak Adresi *</label>
                          <input
                            type="text"
                            value={invoiceStreetAddress}
                            onChange={(e) => setInvoiceStreetAddress(e.target.value)}
                            placeholder="Bina numarası ve sokak adı"
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                            required={!invoiceAddressSame}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Apartman, daire vb. (Opsiyonel)</label>
                          <input
                            type="text"
                            value={invoiceStreetAddress2}
                            onChange={(e) => setInvoiceStreetAddress2(e.target.value)}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Posta Kodu *</label>
                          <input
                            type="text"
                            value={invoicePostalCode}
                            onChange={(e) => setInvoicePostalCode(e.target.value)}
                            placeholder="34000"
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 max-w-[200px]"
                            required={!invoiceAddressSame}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 📝 Ek Bilgiler */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">📝 Sipariş Notu (Opsiyonel)</h3>
                <textarea
                  value={orderNote}
                  onChange={(e) => setOrderNote(e.target.value)}
                  rows={3}
                  placeholder="Siparişinizle ilgili eklemek istediğiniz notlar..."
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* 💳 Ödeme Yöntemi */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Odeme Yontemi</h3>
                <div className="flex items-center gap-3 p-3 border rounded-lg" style={{ borderColor: '#3b82f6' }}>
                  <div className="w-4 h-4 rounded-full bg-blue-600 flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-white" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Kredi Karti / Banka Karti</p>
                    <p className="text-sm text-gray-500">Guvenli online odeme (3D Secure)</p>
                  </div>
                </div>
              </div>

              {/* ✅ Yasal Onaylar */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">✅ Yasal Onaylar</h3>
                <div className="space-y-3">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={acceptMesafeliSatis}
                      onChange={(e) => setAcceptMesafeliSatis(e.target.checked)}
                      className="w-5 h-5 mt-0.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-gray-700 text-sm">
                      <Link href="/mesafeli-satis" className="text-blue-600 hover:underline" target="_blank">
                        Mesafeli Satış Sözleşmesi
                      </Link>
                      &apos;ni okudum ve kabul ediyorum. *
                    </span>
                  </label>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={acceptKVKK}
                      onChange={(e) => setAcceptKVKK(e.target.checked)}
                      className="w-5 h-5 mt-0.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-gray-700 text-sm">
                      <Link href="/kvkk" className="text-blue-600 hover:underline" target="_blank">
                        KVKK Aydınlatma Metni
                      </Link>
                      &apos;ni okudum ve kabul ediyorum. *
                    </span>
                  </label>
                </div>
              </div>

              {/* Hata Mesajı */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              )}
            </div>

            {/* Sağ - Sipariş Özeti (Sticky) */}
            <div className="lg:col-span-1">
              <div className="sticky top-24">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="bg-blue-900 px-6 py-4">
                    <h3 className="text-white font-semibold">Sipariş Özeti</h3>
                  </div>
                  <div className="p-6 space-y-4">
                    {/* Okul/Sınıf */}
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Okul:</span>
                        <span className="font-medium text-gray-900">{classData.school.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Sınıf:</span>
                        <span className="font-medium text-gray-900">{classData.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Paket:</span>
                        <span className="font-medium text-gray-900">{classData.package.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Teslimat:</span>
                        <span className="font-medium text-gray-900">
                          {isCargoDelivery ? "Kargo" : "Okula Teslim"}
                        </span>
                      </div>
                    </div>

                    <hr className="border-gray-100" />

                    {/* Paket İçeriği */}
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-2">Paket İçeriği</p>
                      <ul className="space-y-2">
                        {classData.package.items.map((item) => (
                          <li key={item.id} className="flex items-center gap-2 text-sm text-gray-600">
                            <CheckIcon />
                            <span>{item.name}</span>
                            {item.quantity > 1 && (
                              <span className="text-gray-400">x{item.quantity}</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {classData.package.note && (
                      <div className="bg-blue-50 p-3 rounded-lg text-xs text-blue-700">
                        {classData.package.note}
                      </div>
                    )}

                    <hr className="border-gray-100" />

                    {/* Indirim Kodu */}
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-2">Indirim Kodu</p>
                      {discountApplied ? (
                        <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg p-3">
                          <div>
                            <p className="text-sm font-semibold text-green-800">{discountApplied.code}</p>
                            <p className="text-xs text-green-600">
                              {discountApplied.type === 'PERCENTAGE'
                                ? `%${discountApplied.value} indirim`
                                : `${formatPrice(discountApplied.value)} TL indirim`
                              }
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={handleRemoveDiscount}
                            className="text-green-600 hover:text-red-500 transition-colors"
                          >
                            <CloseIcon />
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={discountCode}
                            onChange={(e) => {
                              setDiscountCode(e.target.value.toUpperCase())
                              setDiscountError("")
                            }}
                            placeholder="Kod girin"
                            className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                          />
                          <button
                            type="button"
                            onClick={handleApplyDiscount}
                            disabled={discountLoading || !discountCode.trim()}
                            className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            {discountLoading ? "..." : "Uygula"}
                          </button>
                        </div>
                      )}
                      {discountError && (
                        <p className="text-xs text-red-600 mt-1">{discountError}</p>
                      )}
                    </div>

                    <hr className="border-gray-100" />

                    {/* Toplam */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Ara Toplam</span>
                        <span className="text-gray-700">{formatPrice(classData.package.price)} TL</span>
                      </div>
                      {discountApplied && (
                        <div className="flex justify-between text-sm">
                          <span className="text-green-600">Indirim</span>
                          <span className="text-green-600">-{formatPrice(discountApplied.discountAmount)} TL</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                        <span className="font-semibold text-gray-900">TOPLAM TUTAR</span>
                        <span className="text-2xl font-bold text-blue-900">
                          {formatPrice(getFinalPrice())} TL
                        </span>
                      </div>
                    </div>

                    {/* Ödeme Butonu */}
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full bg-blue-900 hover:bg-blue-800 text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {submitting ? (
                        <>
                          <Spinner />
                          <span>İşleniyor...</span>
                        </>
                      ) : (
                        <span>Ödemeyi Tamamla</span>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </form>
      </main>

      {/* Mock Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
            <div className="bg-yellow-50 border-b border-yellow-200 px-6 py-4 flex items-center justify-between">
              <h3 className="font-semibold text-yellow-800">Test Ödemesi</h3>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="text-yellow-600 hover:text-yellow-800"
              >
                <CloseIcon />
              </button>
            </div>
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-gray-600 mb-6">
                <span className="font-semibold text-gray-900">Gerçek ödeme alınmamaktadır.</span><br />
                Bu bir test ödemesidir. Onayladığınızda siparişiniz oluşturulacaktır.
              </p>
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <p className="text-sm text-gray-500">Ödenecek Tutar</p>
                <p className="text-2xl font-bold text-blue-900">
                  {formatPrice(getFinalPrice())} TL
                </p>
                {discountApplied && (
                  <p className="text-xs text-green-600 mt-1">
                    {discountApplied.code} kodu ile {formatPrice(discountApplied.discountAmount)} TL indirim
                  </p>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowPaymentModal(false)}
                  className="flex-1 py-3 px-4 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
                >
                  İptal
                </button>
                <button
                  onClick={handlePaymentConfirm}
                  disabled={submitting}
                  className="flex-1 py-3 px-4 bg-blue-900 hover:bg-blue-800 text-white font-semibold rounded-lg transition-colors disabled:opacity-70 flex items-center justify-center gap-2"
                >
                  {submitting ? <Spinner /> : null}
                  Ödemeyi Onayla
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
