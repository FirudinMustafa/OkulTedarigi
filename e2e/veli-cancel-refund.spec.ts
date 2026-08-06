import { test, expect, request as pwRequest, type APIRequestContext } from '@playwright/test'
import {
  loginAdmin, createSchool, createPackage, createClass,
  deleteClass, deletePackage, deleteSchool,
  type TestSchool, type TestPackage, type TestClass,
} from './fixtures'
import { seedOrder, deleteOrderDirect, prisma } from './prisma-helper'

let admin: APIRequestContext
let anon: APIRequestContext
let school: TestSchool
let pkg: TestPackage
let cls: TestClass
const seededOrderIds: string[] = []

test.beforeAll(async ({ baseURL }) => {
  admin = await pwRequest.newContext({ baseURL })
  await loginAdmin(admin)
  anon = await pwRequest.newContext({ baseURL })

  school = await createSchool(admin, { label: 'CancelRefund', showNameToParent: true })
  pkg = await createPackage(admin, { label: 'CancelRefund-Paket', basePrice: 1, items: [{ name: 'Defter', unitPrice: 1 }] })
  cls = await createClass(admin, { label: 'CR-A', schoolId: school.id, packageId: pkg.id })
})

test.afterAll(async () => {
  for (const id of seededOrderIds) await deleteOrderDirect(id)
  await deleteClass(admin, cls.id)
  await deletePackage(admin, pkg.id)
  await deleteSchool(admin, school.id)
  await admin.dispose()
  await anon.dispose()
  await prisma.$disconnect()
})

test('veli — yanlış telefon son 4 hane ile iptal talebi 403 döner', async () => {
  const order = await seedOrder({ classId: cls.id, packageId: pkg.id, status: 'PAID', paidAt: new Date() })
  seededOrderIds.push(order.id)

  const res = await anon.post('/api/veli/cancel-request', {
    data: { orderId: order.id, phoneLast4: '0000', reason: 'Yanlis dogrulama testi' },
  })
  expect(res.status()).toBe(403)
})

test('veli — doğru telefon son 4 hane ile iptal talebi oluşturulur, admin onaylar (paymentId yoksa gerçek iade atlanır)', async () => {
  const order = await seedOrder({ classId: cls.id, packageId: pkg.id, status: 'PAID', paidAt: new Date(), paymentId: null })
  seededOrderIds.push(order.id)

  const createRes = await anon.post('/api/veli/cancel-request', {
    data: { orderId: order.id, phoneLast4: '4567', reason: 'E2E test iptali' },
  })
  expect(createRes.ok()).toBeTruthy()
  const { cancelRequest } = await createRes.json()
  expect(cancelRequest.status).toBe('PENDING')

  const approveRes = await admin.post(`/api/admin/cancel-requests/${cancelRequest.id}/process`, {
    data: { status: 'APPROVED', adminNote: 'E2E test onayi' },
  })
  expect(approveRes.ok()).toBeTruthy()

  const updated = await prisma.order.findUnique({ where: { id: order.id } })
  expect(updated?.status).toBe('REFUNDED')
  expect(updated?.refundedAt).toBeTruthy()
})

test('admin — CANCELLED değilken /refund çağrısı 400 döner (yanlış durum geçişi engellenir)', async () => {
  const order = await seedOrder({ classId: cls.id, packageId: pkg.id, status: 'CONFIRMED' })
  seededOrderIds.push(order.id)

  const res = await admin.post(`/api/admin/orders/${order.id}/refund`)
  expect(res.status()).toBe(400)
})

test('admin — hiç ödenmemiş CANCELLED sipariş /refund ile PayNKolay çağrısı yapmadan REFUNDED olur', async () => {
  const order = await seedOrder({ classId: cls.id, packageId: pkg.id, status: 'CANCELLED', paidAt: null })
  seededOrderIds.push(order.id)

  const res = await admin.post(`/api/admin/orders/${order.id}/refund`)
  expect(res.ok()).toBeTruthy()
  const body = await res.json()
  expect(body.success).toBeTruthy()
  expect(body.refundId).toBeNull()

  const updated = await prisma.order.findUnique({ where: { id: order.id } })
  expect(updated?.status).toBe('REFUNDED')
})

test('admin — ödenmiş ama paymentId eksik (veri anomalisi) CANCELLED sipariş /refund ile 502 döner, durum DEĞİŞMEZ (eski "sahte iade" hatası artık yok)', async () => {
  const order = await seedOrder({ classId: cls.id, packageId: pkg.id, status: 'CANCELLED', paidAt: new Date(), paymentId: null })
  seededOrderIds.push(order.id)

  const res = await admin.post(`/api/admin/orders/${order.id}/refund`)
  expect(res.status()).toBe(502)

  // Kritik dogrulama: eski hatada burada status sessizce REFUNDED'a donuyordu (para donmeden).
  // Simdi basarisiz iade sonrasi siparis CANCELLED olarak KALMALI.
  const updated = await prisma.order.findUnique({ where: { id: order.id } })
  expect(updated?.status).toBe('CANCELLED')
})

test('admin — genel PUT route ile CANCELLED→REFUNDED geçişi artık YASAK (400) — /refund tek yol', async () => {
  const order = await seedOrder({ classId: cls.id, packageId: pkg.id, status: 'CANCELLED', paidAt: null })
  seededOrderIds.push(order.id)

  const res = await admin.put(`/api/admin/orders/${order.id}`, { data: { status: 'REFUNDED' } })
  expect(res.status()).toBe(400)

  const updated = await prisma.order.findUnique({ where: { id: order.id } })
  expect(updated?.status).toBe('CANCELLED') // degismedi
})
