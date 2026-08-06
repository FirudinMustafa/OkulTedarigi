// Siparis durum sabitleri - tum sayfalarda kullanilir
//
// Yeni 4-asamali is akisi (2026-06 revizyonu):
//   Gelen Siparis (PAID) -> [Onayla] -> Hazirlaniyor (CONFIRMED)
//     -> [Kargola | Okula Teslim Et] -> Dagitimda (SHIPPED)
//     -> [Tamamlandi (COMPLETED)] veya [Teslim Edilemeyen (UNDELIVERED)]
//   UNDELIVERED -> tekrar Dagitimda (SHIPPED)
//   Iptal: CANCELLED -> REFUNDED
//
// NEW / PAYMENT_PENDING / INVOICED / DELIVERED enum'da KALIR ama yeni akista
// uretilmez; yalnizca eski veri uyumlulugu icin tutulur.

export const ORDER_STATUS_LABELS: Record<string, string> = {
  NEW: "Yeni",
  PAYMENT_PENDING: "Odeme Bekliyor",
  PAID: "Gelen Siparis",
  CONFIRMED: "Hazirlaniyor",
  INVOICED: "Fatura Kesildi",
  SHIPPED: "Dagitimda",
  DELIVERED: "Teslim Edildi",
  COMPLETED: "Tamamlandi",
  CANCELLED: "Iptal Edildi",
  REFUNDED: "Iade Edildi",
  UNDELIVERED: "Teslim Edilemeyen"
}

export const ORDER_STATUS_COLORS: Record<string, string> = {
  NEW: "bg-sky-100 text-sky-800",
  PAYMENT_PENDING: "bg-yellow-100 text-yellow-800",
  PAID: "bg-sky-100 text-sky-800",
  CONFIRMED: "bg-cyan-100 text-cyan-800",
  INVOICED: "bg-indigo-100 text-indigo-800",
  SHIPPED: "bg-purple-100 text-purple-800",
  DELIVERED: "bg-green-100 text-green-800",
  COMPLETED: "bg-emerald-100 text-emerald-800",
  CANCELLED: "bg-red-100 text-red-800",
  REFUNDED: "bg-orange-100 text-orange-800",
  UNDELIVERED: "bg-rose-100 text-rose-800"
}

// Filtre dropdown'larinda gosterilecek durumlar
export const FILTERABLE_ORDER_STATUSES = [
  'PAID', 'CONFIRMED', 'SHIPPED', 'UNDELIVERED', 'COMPLETED', 'CANCELLED', 'REFUNDED'
] as const

// Iptal edilebilir durumlar (veli tarafindan) — dagitima cikmadan once
export const CANCELLABLE_STATUSES = ['PAID', 'CONFIRMED']

// Gelire dahil edilecek durumlar (odenmis siparisler)
// Eski veri uyumu icin INVOICED/DELIVERED de dahil edilir.
export const REVENUE_STATUSES = ['PAID', 'CONFIRMED', 'INVOICED', 'SHIPPED', 'DELIVERED', 'UNDELIVERED', 'COMPLETED']

// Hakediş hesabina dahil edilecek durumlar (odenmis + iade edilmemis)
export const COMMISSION_STATUSES = ['PAID', 'CONFIRMED', 'INVOICED', 'SHIPPED', 'DELIVERED', 'UNDELIVERED', 'COMPLETED']

// Odenmemis durumlar — admin liste/raporlarda varsayilan olarak gizlenir
export const UNPAID_STATUSES = ['NEW', 'PAYMENT_PENDING']

// Veli akisi: form -> /odeme arasinda tasinan checkout draft sessionStorage anahtari.
// Siparis SADECE /odeme'de odeme basariliysa olusturulur.
export const CHECKOUT_DRAFT_KEY = 'okultedarigim-checkout-draft'

// Aktif okul filtresi - dashboard ve reports tutarliligi icin ortak helper
// Schools listesi (admin yonetim) bu filtreyi kullanmaz, tum okullari gosterir.
export const ACTIVE_SCHOOL_WHERE = { isActive: true } as const

// Gecerli status gecisleri (yeni 4-asamali model)
//   PAID -> CONFIRMED (Onayla)
//   CONFIRMED -> SHIPPED (Kargola / Okula Teslim Et = Dagitimda)
//   SHIPPED -> COMPLETED (Tamamlandi) | UNDELIVERED (Teslim Edilemeyen)
//   UNDELIVERED -> SHIPPED (Tekrar Dagitima Cikar)
// Eski veriden gelebilecek durumlar icin geriye uyumlu gecisler de tanimli.
export const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  NEW: ['PAYMENT_PENDING', 'PAID', 'CANCELLED'],
  PAYMENT_PENDING: ['PAID', 'CANCELLED'],
  PAID: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['SHIPPED', 'CANCELLED'],
  INVOICED: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['COMPLETED', 'UNDELIVERED'],
  UNDELIVERED: ['SHIPPED'],
  DELIVERED: ['COMPLETED', 'UNDELIVERED'],
  COMPLETED: [],
  // CANCELLED -> REFUNDED burada YOK: bu gecis genel PUT route'undan degil,
  // sadece POST /api/admin/orders/[id]/refund uzerinden yapilmali (gercek
  // PayNKolay iadesini tetikler). Aksi halde "sahte iade" (para donmeden
  // status=REFUNDED) mumkun olur.
  CANCELLED: [],
  REFUNDED: []
}
