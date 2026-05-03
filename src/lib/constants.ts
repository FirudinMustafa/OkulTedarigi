// Siparis durum sabitleri - tum sayfalarda kullanilir

export const ORDER_STATUS_LABELS: Record<string, string> = {
  NEW: "Yeni",
  PAYMENT_PENDING: "Odeme Bekliyor",
  PAID: "Odeme Alindi",
  CONFIRMED: "Onaylandi",
  INVOICED: "Fatura Kesildi",
  SHIPPED: "Kargoya Verildi",
  DELIVERED: "Teslim Edildi",
  COMPLETED: "Tamamlandi",
  CANCELLED: "Iptal Edildi",
  REFUNDED: "Iade Edildi"
}

export const ORDER_STATUS_COLORS: Record<string, string> = {
  NEW: "bg-sky-100 text-sky-800",
  PAYMENT_PENDING: "bg-yellow-100 text-yellow-800",
  PAID: "bg-blue-100 text-blue-800",
  CONFIRMED: "bg-cyan-100 text-cyan-800",
  INVOICED: "bg-indigo-100 text-indigo-800",
  SHIPPED: "bg-purple-100 text-purple-800",
  DELIVERED: "bg-green-100 text-green-800",
  COMPLETED: "bg-emerald-100 text-emerald-800",
  CANCELLED: "bg-red-100 text-red-800",
  REFUNDED: "bg-orange-100 text-orange-800"
}

// Filtre dropdown'larinda gosterilecek durumlar
export const FILTERABLE_ORDER_STATUSES = [
  'NEW', 'PAYMENT_PENDING', 'PAID', 'CONFIRMED', 'INVOICED',
  'SHIPPED', 'DELIVERED', 'COMPLETED', 'CANCELLED', 'REFUNDED'
] as const

// Iptal edilebilir durumlar (veli tarafindan)
export const CANCELLABLE_STATUSES = ['NEW', 'PAYMENT_PENDING', 'PAID', 'CONFIRMED']

// Gelire dahil edilecek durumlar (odenmis siparisler)
export const REVENUE_STATUSES = ['PAID', 'CONFIRMED', 'INVOICED', 'SHIPPED', 'DELIVERED', 'COMPLETED']

// Hakediş hesabina dahil edilecek durumlar (Onaylanmis + Teslim edilmemis + Iade edilmemis)
export const COMMISSION_STATUSES = ['PAID', 'CONFIRMED', 'INVOICED', 'SHIPPED', 'DELIVERED', 'COMPLETED']

// Gecerli status gecisleri
export const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  NEW: ['PAYMENT_PENDING', 'PAID', 'CANCELLED'],
  PAYMENT_PENDING: ['PAID', 'CANCELLED'],
  PAID: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['INVOICED', 'CANCELLED'],
  INVOICED: ['SHIPPED', 'DELIVERED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: ['REFUNDED'],
  REFUNDED: []
}
