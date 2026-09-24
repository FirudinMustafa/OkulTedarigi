/**
 * Siparis -> KolayBi fatura kalemi donusumu (auto-invoice, manuel ve toplu fatura kesiminde ortak).
 *
 * Bug (2026-09-24): Fatura kalemleri PackageItem/OrderItem'in kendi `price` alanindan
 * hesaplaniyordu. Bu alan admin panelinde hic girilmeyebiliyor (non-customizable paketlerde
 * tutarin tek kaynagi Package.price'tir, bkz. src/app/api/veli/checkout/route.ts) veya kismi
 * girilebiliyor — her iki durumda da kalem toplami siparisin gercekte odenen tutarindan
 * (Order.totalAmount) farkli olabiliyor, KolayBi'ye eksik/0 TL kalemler gidiyordu.
 *
 * Duzeltme: kalem fiyatlarina hic bakilmiyor. Fatura her zaman siparisin gercekte odenen
 * toplam tutarini (Order.totalAmount) tek kalem olarak yaziyor — bu deger indirim dahil
 * dogru ve tek guvenilir kaynak.
 */

interface OrderForInvoiceItems {
  totalAmount: unknown // Prisma Decimal
  class: {
    package: { name: string } | null
  }
}

export interface InvoiceLineItem {
  name: string
  quantity: number
  unitPrice: number
  totalPrice: number
}

export function buildInvoiceItems(order: OrderForInvoiceItems, studentCount: number): InvoiceLineItem[] {
  const orderTotal = Number(order.totalAmount)
  const name = order.class.package?.name || 'Siparis'

  return [{
    name,
    quantity: studentCount,
    unitPrice: Math.round((orderTotal / studentCount) * 100) / 100,
    totalPrice: orderTotal,
  }]
}
