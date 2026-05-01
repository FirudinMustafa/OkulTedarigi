/**
 * Paket DELETE akışını HTTP üzerinden test eder.
 *   - Boş paket (sipariş ve sınıf yok)         → 200 silinmeli
 *   - Aktif siparişi olan paket                → 400 dönmeli
 *   - Sadece COMPLETED/CANCELLED siparişli paket→ 200 silinmeli
 *   - Sınıfa atanmış ama siparişi olmayan paket→ 200, sınıfın packageId null'a düşmeli
 */
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const BASE = 'http://localhost:3000'
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@okultedarigim.com'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin12345!Test'

let cookie = ''

function ok(s) { console.log('  OK   ' + s) }
function bad(s, e) { console.log('  FAIL ' + s + (e ? ' :: ' + e : '')); process.exitCode = 1 }

async function login() {
  const r = await fetch(`${BASE}/api/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
  })
  if (!r.ok) throw new Error('login: ' + r.status)
  const m = (r.headers.get('set-cookie') || '').match(/token=([^;]+)/)
  if (!m) throw new Error('no token cookie')
  cookie = `token=${m[1]}`
}

async function del(id) {
  const r = await fetch(`${BASE}/api/admin/packages/${id}`, {
    method: 'DELETE',
    headers: { Cookie: cookie }
  })
  const text = await r.text()
  let body
  try { body = JSON.parse(text) } catch { body = text }
  return { status: r.status, body }
}

async function main() {
  console.log('=== PAKET DELETE TESTİ ===\n')
  await login()
  ok('admin login')

  // ---- Senaryo 1: Tamamen boş paket
  console.log('\n[1] Boş paket (0 sınıf, 0 sipariş) → silinmeli (200)')
  const empty = await prisma.package.create({
    data: {
      name: 'TEST-EMPTY-' + Date.now(),
      description: 'Test',
      price: 100,
      items: { create: [{ name: 'kalem', quantity: 1, price: 10 }] }
    }
  })
  const r1 = await del(empty.id)
  console.log('     status=' + r1.status + ' body=' + JSON.stringify(r1.body))
  if (r1.status === 200) ok('boş paket silindi')
  else bad('boş paket silinemedi', r1.status)
  const stillThere1 = await prisma.package.findUnique({ where: { id: empty.id } })
  if (stillThere1) bad('paket DB\'de hâlâ var')
  else ok('DB\'den de silindi')

  // ---- Senaryo 2: Aktif siparişli paket → 400
  console.log('\n[2] Aktif (INVOICED) siparişi olan "Demo Tam Set" → 400 dönmeli')
  const demo = await prisma.package.findFirst({ where: { name: 'Demo Tam Set' } })
  if (!demo) bad('Demo Tam Set bulunamadı (önce node scripts/test-payment-flow.js çalıştır)')
  else {
    const r2 = await del(demo.id)
    console.log('     status=' + r2.status + ' body=' + JSON.stringify(r2.body))
    if (r2.status === 400 && /aktif siparis/i.test(r2.body.error || '')) ok('aktif siparişler nedeniyle 400 (beklenen)')
    else bad('beklenen 400 değil', r2.status)
    const still = await prisma.package.findUnique({ where: { id: demo.id } })
    if (still) ok('paket DB\'de hâlâ duruyor (beklenen)')
    else bad('400 dönmesine rağmen paket silinmiş!')
  }

  // ---- Senaryo 3: Sınıfa atanmış ama siparişsiz paket → silinmeli, class.packageId null olmalı
  console.log('\n[3] Sınıfa atanmış ama siparişi olmayan paket → silinmeli, sınıfın packageId null olmalı')
  const pkg3 = await prisma.package.create({
    data: { name: 'TEST-WITH-CLASS-' + Date.now(), price: 50, items: { create: [{ name: 'silgi', quantity: 1, price: 5 }] } }
  })
  // Demo okula sınıf ekle ve bu pakete bağla
  const school = await prisma.school.findFirst({ where: { name: 'Demo Koleji' } })
  const cls = await prisma.class.create({
    data: { name: 'TEST-CLASS-' + Date.now(), schoolId: school.id, packageId: pkg3.id, commissionAmount: 10 }
  })
  const r3 = await del(pkg3.id)
  console.log('     status=' + r3.status + ' body=' + JSON.stringify(r3.body))
  if (r3.status === 200) ok('sınıfa bağlı paket silindi')
  else bad('paket silinemedi', r3.status)
  const cls2 = await prisma.class.findUnique({ where: { id: cls.id } })
  if (cls2 && cls2.packageId === null) ok('sınıfın packageId null\'a indi')
  else bad('class.packageId null değil: ' + cls2?.packageId)
  await prisma.class.delete({ where: { id: cls.id } })  // cleanup

  // ---- Senaryo 4: Sadece CANCELLED/COMPLETED siparişli paket → silinmeli
  console.log('\n[4] Sadece CANCELLED/COMPLETED siparişi olan paket → silinmeli')
  const pkg4 = await prisma.package.create({
    data: { name: 'TEST-CANCELLED-' + Date.now(), price: 200, items: { create: [{ name: 'defter', quantity: 1, price: 20 }] } }
  })
  // Bu pakete sınıf + iptal edilmiş 2 sipariş ekle
  const cls4 = await prisma.class.create({
    data: { name: 'TEST-CLS4-' + Date.now(), schoolId: school.id, packageId: pkg4.id, commissionAmount: 10 }
  })
  await prisma.order.createMany({
    data: [
      { orderNumber: 'TEST-CANC-' + Date.now() + '-1', parentName: 'A', studentName: 'B', phone: '0000', totalAmount: 200, status: 'CANCELLED', classId: cls4.id, packageId: pkg4.id, cancelledAt: new Date() },
      { orderNumber: 'TEST-CANC-' + Date.now() + '-2', parentName: 'C', studentName: 'D', phone: '0001', totalAmount: 200, status: 'COMPLETED', classId: cls4.id, packageId: pkg4.id }
    ]
  })
  const r4 = await del(pkg4.id)
  console.log('     status=' + r4.status + ' body=' + JSON.stringify(r4.body))
  if (r4.status === 200) ok('terminal-state siparişli paket silindi')
  else bad('beklenmeyen hata', r4.status)
  const remainingOrders = await prisma.order.count({ where: { packageId: pkg4.id } })
  if (remainingOrders === 0) ok('siparişler de silindi (cascade)')
  else bad(`${remainingOrders} sipariş hâlâ duruyor`)
  // cleanup
  try { await prisma.class.delete({ where: { id: cls4.id } }) } catch {}

  // ---- Senaryo 5: Auth zorunluluğu
  console.log('\n[5] Cookie\'siz DELETE → 401')
  const r5 = await fetch(`${BASE}/api/admin/packages/dummy-id`, { method: 'DELETE' })
  if (r5.status === 401) ok('auth zorunluluğu OK')
  else bad('401 değil', r5.status)

  // ---- Senaryo 6: Olmayan id
  console.log('\n[6] Olmayan id → 404')
  const r6 = await del('id-yok-boyle-bir-paket')
  console.log('     status=' + r6.status + ' body=' + JSON.stringify(r6.body))
  if (r6.status === 404) ok('404 OK')
  else bad('404 değil', r6.status)

  if (process.exitCode) console.log('\nSONUÇ: BAŞARISIZ')
  else console.log('\nSONUÇ: TÜM TESTLER GEÇTİ')
}

main()
  .catch(e => { console.error('HATA:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
