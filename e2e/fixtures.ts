import type { APIRequestContext } from '@playwright/test'

export const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@okultedarigim.com'
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin123456!@'

// Test verisi bu onekle isaretlenir; kolayca ayirt edilip temizlenebilsin diye.
export const PREFIX = 'E2E-TEST'

export async function loginAdmin(request: APIRequestContext) {
  const res = await request.post('/api/admin/auth/login', {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  })
  if (!res.ok()) {
    throw new Error(`Admin login basarisiz: ${res.status()} ${await res.text()}`)
  }
}

export interface TestSchool {
  id: string
  name: string
  password: string
  directorEmail: string
}

export async function createSchool(
  request: APIRequestContext,
  opts: { label: string; showNameToParent: boolean; deliveryType?: 'CARGO' | 'SCHOOL_DELIVERY' }
): Promise<TestSchool> {
  const suffix = Math.random().toString(36).slice(2, 8)
  const res = await request.post('/api/admin/schools', {
    data: {
      name: `${PREFIX} ${opts.label} ${suffix}`,
      directorEmail: `${PREFIX.toLowerCase()}-${suffix}@example.com`,
      directorPassword: 'E2eTest123!',
      deliveryType: opts.deliveryType || 'CARGO',
      showNameToParent: opts.showNameToParent,
    },
  })
  if (!res.ok()) throw new Error(`Okul olusturulamadi: ${res.status()} ${await res.text()}`)
  const { school } = await res.json()
  return { id: school.id, name: school.name, password: school.password, directorEmail: school.directorEmail }
}

export interface TestPackage {
  id: string
  name: string
  items: { id: string; name: string }[]
}

export async function createPackage(
  request: APIRequestContext,
  opts: { label: string; basePrice: number; isCustomizable?: boolean; items: { name: string; unitPrice: number; quantity?: number }[] }
): Promise<TestPackage> {
  const suffix = Math.random().toString(36).slice(2, 8)
  const res = await request.post('/api/admin/packages', {
    data: {
      name: `${PREFIX} ${opts.label} ${suffix}`,
      basePrice: opts.basePrice,
      isCustomizable: !!opts.isCustomizable,
      items: opts.items,
    },
  })
  if (!res.ok()) throw new Error(`Paket olusturulamadi: ${res.status()} ${await res.text()}`)
  const { package: pkg } = await res.json()
  return { id: pkg.id, name: pkg.name, items: pkg.items.map((it: { id: string; name: string }) => ({ id: it.id, name: it.name })) }
}

export interface TestClass {
  id: string
  name: string
}

export async function createClass(
  request: APIRequestContext,
  opts: { label: string; schoolId: string; packageId: string }
): Promise<TestClass> {
  const suffix = Math.random().toString(36).slice(2, 6)
  const res = await request.post('/api/admin/classes', {
    data: { name: `${opts.label}-${suffix}`, schoolId: opts.schoolId, packageId: opts.packageId, commissionAmount: 0 },
  })
  if (!res.ok()) throw new Error(`Sinif olusturulamadi: ${res.status()} ${await res.text()}`)
  const { class: cls } = await res.json()
  return { id: cls.id, name: cls.name }
}

export async function deleteClass(request: APIRequestContext, id: string) {
  await request.delete(`/api/admin/classes/${id}`).catch(() => {})
}
export async function deletePackage(request: APIRequestContext, id: string) {
  await request.delete(`/api/admin/packages/${id}`).catch(() => {})
}
export async function deleteSchool(request: APIRequestContext, id: string) {
  // Odenmis/faturali siparisi olan okullar VUK/TTK geregi silinemez (409) — bu beklenen davranis,
  // yerel test DB'sinde kalmasi sorun degil.
  await request.delete(`/api/admin/schools/${id}`).catch(() => {})
}

export async function deleteOrder(request: APIRequestContext, id: string) {
  await request.delete(`/api/admin/orders/${id}`).catch(() => {})
}

/**
 * Checksum'i gecerli bir TC Kimlik No uretir (src/lib/utils.ts isValidTCKimlik ile ayni algoritma).
 * seed: ilk 9 haneyi degistirmek icin (varsayilan 123456789 - test icin sabit ve tekrar uretilebilir).
 */
export function generateValidTCKimlik(seed = '123456789'): string {
  const digits = seed.split('').map(Number)
  const oddSum = digits[0] + digits[2] + digits[4] + digits[6] + digits[8]
  const evenSum = digits[1] + digits[3] + digits[5] + digits[7]
  const d10 = (((oddSum * 7) - evenSum) % 10 + 10) % 10
  const firstTen = [...digits, d10]
  const d11 = firstTen.reduce((a, b) => a + b, 0) % 10
  return [...firstTen, d11].join('')
}

/** PayNKolay sandbox test karti (07-test-cards.php) - Yapikredi, sifre alanli. */
export const SANDBOX_TEST_CARD = {
  number: '4506347010299085',
  month: '09',
  year: '2026',
  cvv: '000',
  password: '34020',
}
