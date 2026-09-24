/**
 * Siparis -> KolayBi fatura kalemi donusumu (auto-invoice, manuel ve toplu fatura kesiminde ortak).
 *
 * Bug (2026-09-24): Ozellestirilemeyen (isCustomizable=false) paketlerde fiyat sadece
 * Package.price (paket toplu fiyati) uzerinden alinir; PackageItem.price admin panelinde
 * girilmedigi icin 0 kalabiliyor (bkz. src/app/api/admin/packages/route.ts). OrderItem
 * snapshot'i bu 0 fiyatlari kopyaladigi icin KolayBi'ye 0 TL kalemler gidiyor, fatura
 * dogru toplam siparis tutariyla degil 0 TL ile kesiliyordu. Kalem toplami 0 ama siparis
 * tutari 0'dan buyukse, kalemler yerine siparis toplamini tek kalem olarak faturalandiriyoruz.
 */

interface InvoiceItemSnapshot {
  name: string
  quantity: number
  price: unknown // Prisma Decimal
}

interface OrderForInvoiceItems {
  totalAmount: unknown // Prisma Decimal
  items: InvoiceItemSnapshot[]
  class: {
    package: {
      name: string
      items: InvoiceItemSnapshot[]
    } | null
  }
}

export interface InvoiceLineItem {
  name: string
  quantity: number
  unitPrice: number
  totalPrice: number
}

export function buildInvoiceItems(order: OrderForInvoiceItems, studentCount: number): InvoiceLineItem[] {
  const snapshotItems = order.items.length > 0 ? order.items : (order.class.package?.items ?? [])
  const items: InvoiceLineItem[] = snapshotItems.map(item => ({
    name: item.name,
    quantity: item.quantity * studentCount,
    unitPrice: Number(item.price),
    totalPrice: Number(item.price) * item.quantity * studentCount,
  }))

  const itemsTotal = items.reduce((sum, it) => sum + it.totalPrice, 0)
  const orderTotal = Number(order.totalAmount)

  if (items.length === 0 || (itemsTotal <= 0 && orderTotal > 0)) {
    return [{
      name: order.class.package?.name || 'Siparis',
      quantity: studentCount,
      unitPrice: Math.round((orderTotal / studentCount) * 100) / 100,
      totalPrice: orderTotal,
    }]
  }

  return items
}
