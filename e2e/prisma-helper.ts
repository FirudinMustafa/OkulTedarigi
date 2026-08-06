// Playwright testleri Node ortaminda calisir; siparis onay/takip sayfalarini gercek
// odeme yapmadan test edebilmek icin dogrudan Prisma ile "sanki tamamlanmis" bir siparis
// tohumlanir (checkout API'si sadece gercek odeme basariliysa siparis olusturuyor).
import { PrismaClient } from '@prisma/client'

export const prisma = new PrismaClient()

export async function seedCompletedOrder(opts: { classId: string; packageId: string }) {
  const orderNumber = 'E2ETST' + Math.random().toString(36).slice(2, 8).toUpperCase()
  const order = await prisma.order.create({
    data: {
      orderNumber,
      parentName: 'Test Veli',
      studentName: 'Öğrenci Test',
      phone: '05551234567',
      email: 'e2e-test-veli@example.com',
      address: 'Test Sokak No:1, Kadıköy, İstanbul, Türkiye',
      totalAmount: 1,
      status: 'COMPLETED',
      paymentMethod: 'CREDIT_CARD',
      paidAt: new Date(),
      confirmedAt: new Date(),
      classId: opts.classId,
      packageId: opts.packageId,
      students: { create: [{ firstName: 'Öğrenci', lastName: 'Test', section: 'A' }] },
    },
  })
  return order
}

export async function deleteOrderDirect(id: string) {
  await prisma.order.deleteMany({ where: { id } }).catch(() => {})
}

/**
 * Iptal/iade testleri icin serbest bicimli siparis tohumlar (VALID_STATUS_TRANSITIONS'i
 * atlar — dogrudan istenen durumda olusturur). Sadece test setup'i icin, gercek akista
 * kullanilmaz.
 */
export async function seedOrder(opts: {
  classId: string
  packageId: string
  status: 'CANCELLED' | 'COMPLETED' | 'CONFIRMED' | 'PAID'
  paidAt?: Date | null
  paymentId?: string | null
}) {
  const orderNumber = 'E2ETST' + Math.random().toString(36).slice(2, 8).toUpperCase()
  const order = await prisma.order.create({
    data: {
      orderNumber,
      parentName: 'Test Veli',
      studentName: 'Öğrenci Test',
      phone: '05551234567',
      email: 'e2e-test-veli@example.com',
      address: 'Test Sokak No:1, Kadıköy, İstanbul, Türkiye',
      totalAmount: 1,
      status: opts.status,
      paymentMethod: 'CREDIT_CARD',
      paidAt: opts.paidAt ?? null,
      paymentId: opts.paymentId ?? null,
      classId: opts.classId,
      packageId: opts.packageId,
      students: { create: [{ firstName: 'Öğrenci', lastName: 'Test', section: 'A' }] },
    },
  })
  return order
}
