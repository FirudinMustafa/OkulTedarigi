import { test, expect, request as pwRequest, type APIRequestContext, type Page } from '@playwright/test'
import {
  loginAdmin, createSchool, createPackage, createClass,
  deleteClass, deletePackage, deleteSchool, deleteOrder,
  generateValidTCKimlik, type TestSchool, type TestPackage, type TestClass,
} from './fixtures'
import { seedCompletedOrder, deleteOrderDirect, prisma } from './prisma-helper'

let api: APIRequestContext
// [showNameToParent=true, showNameToParent=false] icin ayri okul/paket/sinif
const schools: Record<'visible' | 'hidden', TestSchool> = {} as any
const pkgs: Record<'visible' | 'hidden', TestPackage> = {} as any
const classes: Record<'visible' | 'hidden', TestClass> = {} as any
const seededOrderIds: string[] = []

test.beforeAll(async ({ baseURL }) => {
  api = await pwRequest.newContext({ baseURL })
  await loginAdmin(api)

  for (const key of ['visible', 'hidden'] as const) {
    schools[key] = await createSchool(api, { label: `Happy-${key}`, showNameToParent: key === 'visible' })
    pkgs[key] = await createPackage(api, {
      label: `Paket-${key}`,
      basePrice: 1,
      items: [{ name: 'Defter', unitPrice: 0.5, quantity: 2 }, { name: 'Kalem', unitPrice: 0.5, quantity: 1 }],
    })
    classes[key] = await createClass(api, { label: '1-A', schoolId: schools[key].id, packageId: pkgs[key].id })
  }
})

test.afterAll(async () => {
  for (const id of seededOrderIds) await deleteOrderDirect(id)
  for (const key of ['visible', 'hidden'] as const) {
    await deleteClass(api, classes[key].id)
    await deletePackage(api, pkgs[key].id)
    await deleteSchool(api, schools[key].id) // paid orders varsa VUK/TTK guard'i 409 doner (beklenen)
  }
  await api.dispose()
  await prisma.$disconnect()
})

async function enterSchoolPassword(page: Page, password: string) {
  await page.goto('/tr/siparis')
  await page.locator('#schoolPassword').fill(password)
  await page.getByRole('button', { name: 'Devam et' }).click()
}

async function fillOrderForm(page: Page, tc: string) {
  await page.locator('#f-firstName').fill('Test')
  await page.locator('#f-lastName').fill('Veli')
  await page.locator('#f-phone').fill('05551234567')
  await page.locator('#f-email').fill('e2e-test-veli@example.com')
  await page.locator('#f-il').selectOption({ label: 'İstanbul' })
  await page.locator('#f-ilce').selectOption({ label: 'Kadıköy' })
  await page.locator('#f-streetAddress').fill('Test Sokak No:1')
  await page.locator('#f-streetAddress2').fill('Daire 1')

  const studentInputs = page.locator('#f-students input[type="text"]')
  await studentInputs.nth(0).fill('Öğrenci') // ad
  await studentInputs.nth(1).fill('Test')    // soyad
  await studentInputs.nth(3).fill('A')       // sube (nth(2) = disabled sinif alani)

  await page.locator('#f-tcNumber').fill(tc)

  const legalChecks = page.locator('#f-legal input[type="checkbox"]')
  await legalChecks.nth(0).check()
  await legalChecks.nth(1).check()
}

for (const key of ['visible', 'hidden'] as const) {
  test(`mutlu yol: şifre → paket → form → PayNKolay yönlendirme (okul adı ${key === 'visible' ? 'görünür' : 'gizli'})`, async ({ page }) => {
    await enterSchoolPassword(page, schools[key].password)

    // Sinif secim ekrani
    await expect(page).toHaveURL(/\/tr\/siparis/)
    if (key === 'visible') {
      await expect(page.getByText(schools[key].name)).toBeVisible()
    } else {
      await expect(page.getByText(schools[key].name)).toHaveCount(0)
    }

    await page.getByRole('button', { name: 'Paketi seç' }).click()
    await expect(page).toHaveURL(new RegExp(`/tr/paket/${classes[key].id}`))

    // Paket formu ustunde (header) VE siparis ozeti kutusunda okul adi iki kez gecer
    if (key === 'visible') {
      await expect(page.getByText(schools[key].name).first()).toBeVisible()
      await expect(page.getByText(schools[key].name)).toHaveCount(2)
    } else {
      await expect(page.getByText(schools[key].name)).toHaveCount(0)
    }

    await fillOrderForm(page, generateValidTCKimlik())

    await page.getByRole('button', { name: 'Ödemeye Geç' }).click()
    await expect(page).toHaveURL(/\/tr\/odeme/)
    await expect(page.getByText('1.00 TL', { exact: true })).toBeVisible()

    await page.getByRole('button', { name: /TL Öde/ }).click()
    // PayNKolay hosted sayfasina gercek yonlendirme (form otomatik POST eder)
    await page.waitForURL(/paynkolaytest\.nkolayislem\.com\.tr/, { timeout: 15_000 })
    await expect(page.getByText('1,00')).toBeVisible({ timeout: 10_000 })

    // Bu noktada gercek 3DS kart girisi TAMAMLANMIYOR (sandbox banka simulatorleri
    // su an kararsiz) — checkout'un PAYMENT_PENDING siparis olusturdugunu dogrulamak yeterli.
    const res = await api.get(`/api/admin/orders?status=PAYMENT_PENDING`)
    const { orders } = await res.json()
    const created = orders.find((o: { class: { id: string } }) => o.class.id === classes[key].id)
    expect(created).toBeTruthy()
    seededOrderIds.push(created.id)
  })
}

for (const key of ['visible', 'hidden'] as const) {
  test(`sipariş onay sayfası okul adını ${key === 'visible' ? 'gösterir' : 'gizler'}`, async ({ page }) => {
    const order = await seedCompletedOrder({ classId: classes[key].id, packageId: pkgs[key].id })
    seededOrderIds.push(order.id)

    await page.goto(`/tr/siparis-onay/${order.orderNumber}`)
    if (key === 'visible') {
      await expect(page.getByText(schools[key].name)).toBeVisible()
    } else {
      await expect(page.getByText(schools[key].name)).toHaveCount(0)
    }
  })

  test(`sipariş takip sayfası okul adını ${key === 'visible' ? 'gösterir' : 'gizler'}`, async ({ page }) => {
    const order = await seedCompletedOrder({ classId: classes[key].id, packageId: pkgs[key].id })
    seededOrderIds.push(order.id)

    await page.goto('/tr/siparis-takip')
    await page.locator('#orderNumber').fill(order.orderNumber)
    await page.locator('button[type="submit"]').click()
    if (key === 'visible') {
      await expect(page.getByText(schools[key].name)).toBeVisible({ timeout: 10_000 })
    } else {
      await expect(page.getByText(schools[key].name)).toHaveCount(0)
    }
  })
}
