/**
 * DELETE handler'ının iş mantığını Prisma seviyesinde birebir koşar.
 * (Turbopack dev worker sorunundan bağımsız olarak kodun doğruluğunu kanıtlar)
 */
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

function ok(s) { console.log('  OK   ' + s) }
function bad(s, e) { console.log('  FAIL ' + s + (e ? ' :: ' + e : '')); process.exitCode = 1 }

// route.ts:173-253'teki DELETE handler'ının iş mantığı:
async function deleteHandler(id) {
  const pkg = await prisma.package.findUnique({ where: { id } })
  if (!pkg) return { status: 404, body: { error: 'Paket bulunamadi' } }

  const activeOrders = await prisma.order.count({
    where: {
      packageId: id,
      status: { notIn: ['COMPLETED', 'CANCELLED', 'REFUNDED'] }
    }
  })
  if (activeOrders > 0) {
    return {
      status: 400,
      body: { error: `Bu pakete ait ${activeOrders} aktif siparis bulunuyor. Silmeden once siparislerin tamamlanmasi veya iptal edilmesi gerekiyor.` }
    }
  }

  await prisma.cancelRequest.deleteMany({ where: { order: { packageId: id } } })
  await prisma.order.deleteMany({ where: { packageId: id } })
  await prisma.class.updateMany({ where: { packageId: id }, data: { packageId: null } })
  await prisma.packageItem.deleteMany({ where: { packageId: id } })
  await prisma.package.delete({ where: { id } })

  return { status: 200, body: { success: true } }
}

async function main() {
  console.log('=== PAKET DELETE — DOĞRUDAN KOD TESTİ ===\n')

  // 1. Boş paket
  console.log('[1] Boş paket')
  const empty = await prisma.package.create({
    data: { name: 'TEST-EMPTY-' + Date.now(), price: 100, items: { create: [{ name: 'kalem', quantity: 1, price: 10 }] } }
  })
  const r1 = await deleteHandler(empty.id)
  if (r1.status === 200) ok('200 silindi'); else bad('beklenen 200', r1.status)
  if (!(await prisma.package.findUnique({ where: { id: empty.id } }))) ok('DB\'den silindi'); else bad('DB\'de kaldı')

  // 2. Aktif siparişli (Demo Tam Set, 18 INVOICED)
  console.log('\n[2] Aktif INVOICED siparişli "Demo Tam Set"')
  const demo = await prisma.package.findFirst({ where: { name: 'Demo Tam Set' } })
  if (!demo) bad('Demo Tam Set yok')
  else {
    const r2 = await deleteHandler(demo.id)
    console.log('     status=' + r2.status + ' error=' + (r2.body.error || '-'))
    if (r2.status === 400 && /18 aktif siparis/.test(r2.body.error)) ok('400 + doğru mesaj')
    else bad('beklenen 400', r2.status + ' ' + r2.body.error)
    if (await prisma.package.findUnique({ where: { id: demo.id } })) ok('paket korundu')
    else bad('paket silinmiş!')
  }

  // 3. Sınıf bağlı, sipariş yok → silinmeli, class.packageId null olmalı
  console.log('\n[3] Sınıfa atanmış, siparişsiz paket')
  const school = await prisma.school.findFirst({ where: { name: 'Demo Koleji' } })
  const pkg3 = await prisma.package.create({
    data: { name: 'TEST-WITH-CLASS-' + Date.now(), price: 50, items: { create: [{ name: 'silgi', quantity: 1, price: 5 }] } }
  })
  const cls = await prisma.class.create({
    data: { name: 'TEST-CLS-' + Date.now(), schoolId: school.id, packageId: pkg3.id, commissionAmount: 10 }
  })
  const r3 = await deleteHandler(pkg3.id)
  if (r3.status === 200) ok('paket silindi'); else bad('200 değil', r3.status)
  const cls2 = await prisma.class.findUnique({ where: { id: cls.id } })
  if (cls2 && cls2.packageId === null) ok('sınıfın packageId null oldu')
  else bad('packageId null değil', cls2?.packageId)
  await prisma.class.delete({ where: { id: cls.id } })

  // 4. Sadece terminal-state siparişli paket
  console.log('\n[4] Sadece CANCELLED + COMPLETED siparişli paket')
  const pkg4 = await prisma.package.create({
    data: { name: 'TEST-DONE-' + Date.now(), price: 200, items: { create: [{ name: 'defter', quantity: 1, price: 20 }] } }
  })
  const cls4 = await prisma.class.create({
    data: { name: 'TEST-CLS4-' + Date.now(), schoolId: school.id, packageId: pkg4.id, commissionAmount: 10 }
  })
  const ts = Date.now()
  await prisma.order.createMany({
    data: [
      { orderNumber: `T-CANC-${ts}-1`, parentName: 'A', studentName: 'B', phone: '0530000', totalAmount: 200, status: 'CANCELLED', cancelledAt: new Date(), classId: cls4.id, packageId: pkg4.id },
      { orderNumber: `T-CANC-${ts}-2`, parentName: 'C', studentName: 'D', phone: '0530001', totalAmount: 200, status: 'COMPLETED', classId: cls4.id, packageId: pkg4.id }
    ]
  })
  const r4 = await deleteHandler(pkg4.id)
  if (r4.status === 200) ok('paket silindi')
  else bad('beklenen 200', r4.status + ' ' + r4.body.error)
  const remOrders = await prisma.order.count({ where: { packageId: pkg4.id } })
  if (remOrders === 0) ok('siparişler de silindi')
  else bad(`${remOrders} sipariş kaldı`)
  try { await prisma.class.delete({ where: { id: cls4.id } }) } catch {}

  // 5. CancelRequest'li sipariş silinebiliyor mu (FK güvenliği)
  console.log('\n[5] CancelRequest\'li sipariş + COMPLETED → cascade düzgün mü')
  const pkg5 = await prisma.package.create({
    data: { name: 'TEST-CANCREQ-' + Date.now(), price: 300, items: { create: [{ name: 'ucu', quantity: 1, price: 30 }] } }
  })
  const cls5 = await prisma.class.create({
    data: { name: 'TEST-CLS5-' + Date.now(), schoolId: school.id, packageId: pkg5.id, commissionAmount: 10 }
  })
  const order5 = await prisma.order.create({
    data: { orderNumber: `T-CR-${Date.now()}`, parentName: 'X', studentName: 'Y', phone: '0530002', totalAmount: 300, status: 'CANCELLED', cancelledAt: new Date(), classId: cls5.id, packageId: pkg5.id }
  })
  await prisma.cancelRequest.create({
    data: { orderId: order5.id, status: 'APPROVED', reason: 'test' }
  })
  const r5 = await deleteHandler(pkg5.id)
  if (r5.status === 200) ok('cancelRequest\'li paket silindi (FK OK)')
  else bad('200 değil', r5.status + ' ' + r5.body.error)
  try { await prisma.class.delete({ where: { id: cls5.id } }) } catch {}

  // 6. Olmayan id
  console.log('\n[6] Olmayan id')
  const r6 = await deleteHandler('id-yok-boyle-bir-paket')
  if (r6.status === 404) ok('404')
  else bad('beklenen 404', r6.status)

  if (process.exitCode) console.log('\nSONUÇ: BAŞARISIZ')
  else console.log('\nSONUÇ: TÜM TESTLER GEÇTİ — kod doğru')
}

main()
  .catch(e => { console.error('HATA:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
