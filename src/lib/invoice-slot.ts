/**
 * E-fatura kesim "slot"u — ayni siparise iki kez e-fatura kesilmesini engeller.
 *
 * KolayBi cagrisi DIS bir islem ve geri alinamaz (kesilen yasal fatura iptal edilmez);
 * bu yuzden cagridan ONCE siparis atomik olarak rezerve edilir:
 *   invoiceNo = null  VE  (invoicedAt = null VEYA invoicedAt bayat)  ->  invoicedAt = simdi
 * Ayni anda gelen ikinci istek (tekli "Fatura Kes", toplu fatura, otomatik COMPLETED
 * faturasi) count=0 alir ve KolayBi'ye gitmez.
 *
 * Bayat esik: eski akislardan invoicedAt dolu ama invoiceNo bos kalmis siparisler veya
 * yarida kalmis bir istek siparisi sonsuza kadar kilitlemesin (KolayBi cagrisi dakikalar surmez).
 */
import { prisma } from '@/lib/prisma'

const STALE_MS = 10 * 60 * 1000

export async function claimInvoiceSlot(orderId: string): Promise<boolean> {
  const now = new Date()
  const res = await prisma.order.updateMany({
    where: {
      id: orderId,
      invoiceNo: null,
      OR: [{ invoicedAt: null }, { invoicedAt: { lt: new Date(now.getTime() - STALE_MS) } }],
    },
    data: { invoicedAt: now },
  })
  return res.count === 1
}

/** KolayBi basarisiz: slotu birak ki tekrar denenebilsin. */
export async function releaseInvoiceSlot(orderId: string): Promise<void> {
  await prisma.order.updateMany({
    where: { id: orderId, invoiceNo: null },
    data: { invoicedAt: null },
  }).catch(err => console.error('[invoice-slot] release hatasi:', orderId, err))
}
