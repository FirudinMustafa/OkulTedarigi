import { test, expect, request as pwRequest, type APIRequestContext } from '@playwright/test'
import {
  loginAdmin, createSchool, createPackage, createClass,
  deleteClass, deletePackage, deleteSchool,
  generateValidTCKimlik, type TestSchool, type TestPackage, type TestClass,
} from './fixtures'

// Bu dosyadaki testler API seviyesinde calisir (tarayici gerekmez) — daha hizli,
// negatif/sinir durumlarini dogrudan HTTP yanitlariyla dogrular.
let admin: APIRequestContext
let anon: APIRequestContext // veli tarafi — cookie'siz, sifir onceki durum
let school: TestSchool
let pkg: TestPackage
let cls: TestClass

test.beforeAll(async ({ baseURL }) => {
  admin = await pwRequest.newContext({ baseURL })
  await loginAdmin(admin)
  anon = await pwRequest.newContext({ baseURL })

  school = await createSchool(admin, { label: 'Validation', showNameToParent: true })
  pkg = await createPackage(admin, {
    label: 'Validation-Paket', basePrice: 1,
    items: [{ name: 'Defter', unitPrice: 1 }],
  })
  cls = await createClass(admin, { label: 'V-A', schoolId: school.id, packageId: pkg.id })
})

test.afterAll(async () => {
  await deleteClass(admin, cls.id)
  await deletePackage(admin, pkg.id)
  await deleteSchool(admin, school.id)
  await admin.dispose()
  await anon.dispose()
})

test('yanlış okul şifresi 401 döner', async () => {
  const res = await anon.post('/api/veli/verify-password', { data: { password: 'YANLIS-SIFRE-XX' } })
  // 429 de kabul edilir: ayni IP'den kisa surede tekrar calistirilirsa (ornegin bu dosyanin
  // sonundaki burst testinden hemen sonra) rate limit penceresi (10/3dk) hala acik olabilir —
  // bu, rate limitin dogru calistigini gosterir, hata degildir.
  expect([401, 429]).toContain(res.status())
})

test('boş şifre 400 döner', async () => {
  const res = await anon.post('/api/veli/verify-password', { data: { password: '' } })
  expect(res.status()).toBe(400)
})

test('var olmayan class id 404 döner', async () => {
  const res = await anon.get('/api/veli/class/nonexistent-id-xyz')
  expect(res.status()).toBe(404)
})

test('class/[id] — showNameToParent=false ise API yanıtında okul adı hiç yok', async () => {
  const hiddenSchool = await createSchool(admin, { label: 'Validation-Hidden', showNameToParent: false })
  const hiddenClass = await createClass(admin, { label: 'H-A', schoolId: hiddenSchool.id, packageId: pkg.id })
  try {
    const res = await anon.get(`/api/veli/class/${hiddenClass.id}`)
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body.school.name).toBeUndefined()
    expect(body.school.name_en).toBeUndefined()
  } finally {
    await deleteClass(admin, hiddenClass.id)
    await deleteSchool(admin, hiddenSchool.id)
  }
})

test('class/[id] — showNameToParent=true ise API yanıtında okul adı var', async () => {
  const res = await anon.get(`/api/veli/class/${cls.id}`)
  expect(res.ok()).toBeTruthy()
  const body = await res.json()
  expect(body.school.name).toBe(school.name)
})

test('checkout — zorunlu alan eksikse 400 döner', async () => {
  const res = await anon.post('/api/veli/checkout', {
    data: { classId: cls.id }, // students, phone, email, address vb eksik
  })
  expect(res.status()).toBe(400)
})

test('checkout — geçersiz TC kimlik checksum 400 döner', async () => {
  const res = await anon.post('/api/veli/checkout', {
    data: {
      classId: cls.id,
      parentName: 'Test Veli',
      students: [{ firstName: 'Öğrenci', lastName: 'Test', section: 'A' }],
      phone: '05551234567',
      email: 'e2e-test@example.com',
      address: 'Test adres, İstanbul, Türkiye',
      isCorporateInvoice: false,
      taxNumber: '12345678951', // format dogru (11 hane, ilk hane≠0) ama checksum gecersiz (dogrusu ...950)
    },
  })
  expect(res.status()).toBe(400)
})

test('checkout — geçerli TC kimlik ile checksum kontrolünü geçer (400 sebebi başka olmalı)', async () => {
  const res = await anon.post('/api/veli/checkout', {
    data: {
      classId: cls.id,
      parentName: 'Test Veli',
      students: [{ firstName: 'Öğrenci', lastName: 'Test', section: 'A' }],
      phone: '05551234567',
      email: 'e2e-test@example.com',
      address: 'Test adres, İstanbul, Türkiye',
      isCorporateInvoice: false,
      taxNumber: generateValidTCKimlik(),
    },
  })
  // TC checksum artik gecerli - istek PayNKolay form uretimine kadar ilerlemeli (200).
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(body.success).toBeTruthy()
  expect(body.actionUrl).toContain('paynkolaytest')
  // Temizlik: olusan PAYMENT_PENDING siparisi sil
  await admin.delete(`/api/admin/orders/${body.orderId}`)
})

test('checkout — geçersiz telefon formatı 400 döner', async () => {
  const res = await anon.post('/api/veli/checkout', {
    data: {
      classId: cls.id,
      parentName: 'Test Veli',
      students: [{ firstName: 'Öğrenci', lastName: 'Test', section: 'A' }],
      phone: '123', // gecersiz
      email: 'e2e-test@example.com',
      address: 'Test adres, İstanbul, Türkiye',
      isCorporateInvoice: false,
      taxNumber: generateValidTCKimlik(),
    },
  })
  expect(res.status()).toBe(400)
})

test('checkout — kurumsal faturada firma unvanı eksikse 400 döner', async () => {
  const res = await anon.post('/api/veli/checkout', {
    data: {
      classId: cls.id,
      parentName: 'Test Veli',
      students: [{ firstName: 'Öğrenci', lastName: 'Test', section: 'A' }],
      phone: '05551234567',
      email: 'e2e-test@example.com',
      address: 'Test adres, İstanbul, Türkiye',
      isCorporateInvoice: true,
      taxNumber: '1234567890', // VKN gibi
      // companyTitle / taxOffice kasitli eksik
    },
  })
  expect(res.status()).toBe(400)
})

test('cancel-request — var olmayan sipariş 404 döner', async () => {
  const res = await anon.post('/api/veli/cancel-request', {
    data: { orderId: 'nonexistent-order-id', phoneLast4: '1234', reason: 'Test iptal nedeni' },
  })
  expect(res.status()).toBe(404)
})

// Rate-limit testleri IP-genelinde paylasilan sayaclari kullanir; diger testleri
// etkilememesi icin dosyanin EN SONUNDA calisir.
test('okul şifresi — kısa pencere rate limit (10/3dk) tetiklenir', async () => {
  let lastStatus = 0
  for (let i = 0; i < 12; i++) {
    const res = await anon.post('/api/veli/verify-password', { data: { password: `RATE-LIMIT-TEST-${i}` } })
    lastStatus = res.status()
    if (lastStatus === 429) break
  }
  expect(lastStatus).toBe(429)
})
