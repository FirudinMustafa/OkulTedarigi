/**
 * Hakediş / Ödeme Geçmişi Akış Testi
 *
 * Senaryo:
 *  - Demo Koleji açıyoruz (2 sınıf)
 *  - 18 sipariş giriyoruz → toplam 27.000 TL ciro
 *  - Sınıf bazlı komisyon: 1-A (10 × 100) + 1-B (8 × 75) = 1.600 TL hakediş
 *  - Admin "elden 600 TL verdi" → PAID kayıt
 *  - Admin "400 TL daha hazırladı ama henüz havale yapmadı" → PENDING kayıt
 *  - Müdür panelinde sadece PAID görünmeli (600), bekleyen 1000 olmalı
 *
 * Çalıştırma:
 *   node scripts/test-payment-flow.js
 */

const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

const COMMISSION_STATUSES = [
  'PAID', 'CONFIRMED', 'INVOICED', 'PREPARING',
  'SHIPPED', 'DELIVERED', 'COMPLETED'
]

function pad(s, n) { return String(s).padEnd(n) }
function tl(n) { return Number(n).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' TL' }
function line(ch = '-') { console.log(ch.repeat(72)) }

async function reset() {
  // Önce daha önceki demo verilerini sil
  const old = await prisma.school.findFirst({
    where: { directorEmail: 'demo-mudur@okultedarigim.test' },
    include: { classes: { include: { orders: true } }, schoolPayments: true }
  })
  if (old) {
    for (const c of old.classes) {
      await prisma.order.deleteMany({ where: { classId: c.id } })
    }
    await prisma.schoolPayment.deleteMany({ where: { schoolId: old.id } })
    await prisma.class.deleteMany({ where: { schoolId: old.id } })
    await prisma.school.delete({ where: { id: old.id } })
    console.log('  (eski demo veriler silindi)')
  }
}

async function seedSchoolAndOrders() {
  // Paket var mı kontrol et, yoksa oluştur
  let pkg = await prisma.package.findFirst({ where: { name: 'Demo Tam Set' } })
  if (!pkg) {
    pkg = await prisma.package.create({
      data: {
        name: 'Demo Tam Set',
        description: 'Test paketi',
        price: 1500
      }
    })
  }

  const directorPassword = await bcrypt.hash('Demo12345!Test', 12)

  const school = await prisma.school.create({
    data: {
      name: 'Demo Koleji',
      address: 'Demo Mah. Test Sok. No:1, Istanbul',
      phone: '02121234567',
      email: 'info@demo-koleji.test',
      password: 'DEMO-PASS-1234-XYZW',
      directorName: 'Ahmet Demo',
      directorEmail: 'demo-mudur@okultedarigim.test',
      directorPassword: directorPassword,
      classes: {
        create: [
          { name: '1-A', commissionAmount: 100, packageId: pkg.id },
          { name: '1-B', commissionAmount: 75,  packageId: pkg.id }
        ]
      }
    },
    include: { classes: true }
  })

  const class1A = school.classes.find(c => c.name === '1-A')
  const class1B = school.classes.find(c => c.name === '1-B')

  // 1-A: 10 siparis (status INVOICED → komisyona dahil)
  // 1-B: 8 siparis (status INVOICED → komisyona dahil)
  const orders = []
  for (let i = 0; i < 10; i++) {
    orders.push({
      orderNumber: `DEMO-A-${String(i + 1).padStart(3, '0')}`,
      parentName: `Veli ${i + 1}`,
      studentName: `Ogrenci 1A-${i + 1}`,
      phone: `0530000${String(i).padStart(4, '0')}`,
      totalAmount: 1500,
      status: 'INVOICED',
      paidAt: new Date(),
      confirmedAt: new Date(),
      invoicedAt: new Date(),
      classId: class1A.id,
      packageId: pkg.id
    })
  }
  for (let i = 0; i < 8; i++) {
    orders.push({
      orderNumber: `DEMO-B-${String(i + 1).padStart(3, '0')}`,
      parentName: `Veli ${i + 11}`,
      studentName: `Ogrenci 1B-${i + 1}`,
      phone: `0530001${String(i).padStart(4, '0')}`,
      totalAmount: 1500,
      status: 'INVOICED',
      paidAt: new Date(),
      confirmedAt: new Date(),
      invoicedAt: new Date(),
      classId: class1B.id,
      packageId: pkg.id
    })
  }

  for (const o of orders) await prisma.order.create({ data: o })

  return school
}

async function simulateAdminPayment(school) {
  console.log('\n[ADIM 3] Admin paneli akışı:')
  console.log('  Admin /admin/hakedisler sayfasına girer.')
  console.log('  "Demo Koleji" satırında "Bekleyen" 1.600,00 TL görünür.')
  console.log('  "Ödeme Yap" butonuna basar → modal açılır.')
  console.log('')

  // (a) Tutar 600 TL → kayıt oluştur (POST /api/admin/payments)
  const period = new Date().toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })
  const payment1 = await prisma.schoolPayment.create({
    data: {
      schoolId: school.id,
      amount: 600,
      description: 'Mayıs ilk taksit (havale)',
      period,
      status: 'PENDING',
      paymentDate: new Date()
    }
  })
  console.log('  (a) Tutar 600 TL girildi → SchoolPayment oluşturuldu (status=PENDING)  id=' + payment1.id.slice(-8))

  // (b) "Ödendi İşaretle" (POST /api/admin/payments/:id/pay)
  await prisma.schoolPayment.updateMany({
    where: { id: payment1.id, status: 'PENDING' },
    data: { status: 'PAID', paidAt: new Date() }
  })
  console.log('  (b) "Ödendi İşaretle" tıklandı → status=PAID, paidAt set edildi')

  // (c) Yeni bir 400 TL daha → ama PENDING kaldı (havale henüz gitmedi)
  const payment2 = await prisma.schoolPayment.create({
    data: {
      schoolId: school.id,
      amount: 400,
      description: 'Mayıs ikinci taksit (havale bekleniyor)',
      period,
      status: 'PENDING',
      paymentDate: new Date()
    }
  })
  console.log('  (c) 400 TL daha eklendi ama Ödendi İşaretle YOK → status=PENDING  id=' + payment2.id.slice(-8))
}

async function verifyMudurView(schoolId) {
  // Düzeltme sonrası müdür sayfasının yaptığı sorguyu birebir çalıştır
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    include: {
      schoolPayments: {
        where: { status: 'PAID' },           // <-- düzeltme: sadece PAID
        orderBy: { paidAt: 'desc' }
      },
      classes: {
        include: {
          orders: {
            where: { status: { in: COMMISSION_STATUSES } }
          }
        }
      }
    }
  })

  const allOrders = school.classes.flatMap(c => c.orders)
  const totalRevenue = allOrders.reduce((acc, o) => acc + Number(o.totalAmount), 0)

  let totalCommission = 0
  for (const c of school.classes) {
    totalCommission += Number(c.commissionAmount) * c.orders.length
  }

  const paidAmount = school.schoolPayments.reduce((acc, p) => acc + Number(p.amount), 0)
  const pendingAmount = Math.max(totalCommission - paidAmount, 0)

  console.log('\n[ADIM 4] Müdür panelinde göreceği değerler (düzeltme sonrası):')
  line()
  console.log('  ' + pad('Toplam Ciro:', 22) + tl(totalRevenue))
  console.log('  ' + pad('Toplam Hakediş:', 22) + tl(totalCommission))
  console.log('  ' + pad('Ödenen:', 22) + tl(paidAmount))
  console.log('  ' + pad('Bekleyen:', 22) + tl(pendingAmount))
  line()

  console.log('\n[ADIM 5] Müdürün gördüğü "Ödeme Geçmişi" tablosu:')
  line()
  if (school.schoolPayments.length === 0) {
    console.log('  (boş)')
  } else {
    console.log('  ' + pad('Tarih', 22) + pad('Tutar', 14) + 'Açıklama')
    for (const p of school.schoolPayments) {
      const d = (p.paidAt ?? p.paymentDate).toLocaleString('tr-TR')
      console.log('  ' + pad(d, 22) + pad(tl(p.amount), 14) + (p.description || '-'))
    }
  }
  line()

  // Beklenen değerler
  const expected = {
    totalRevenue: 27000,    // 18 × 1500
    totalCommission: 1600,  // 10×100 + 8×75
    paidAmount: 600,        // sadece PAID kayıt
    pendingAmount: 1000     // 1600 - 600
  }

  console.log('\n[DOĞRULAMA] Beklenen vs Gerçek:')
  const checks = [
    ['Ciro',     expected.totalRevenue,    totalRevenue],
    ['Komisyon', expected.totalCommission, totalCommission],
    ['Ödenen',   expected.paidAmount,      paidAmount],
    ['Bekleyen', expected.pendingAmount,   pendingAmount]
  ]
  let allOk = true
  for (const [k, exp, got] of checks) {
    const ok = Math.abs(exp - got) < 0.001
    if (!ok) allOk = false
    console.log('  ' + (ok ? 'OK ' : 'FAIL ') + pad(k, 12) + 'beklenen=' + tl(exp) + '  gerçek=' + tl(got))
  }
  if (!allOk) process.exitCode = 1

  // Adminin gördüğü Ödeme Geçmişi (PENDING dahil)
  const allPayments = await prisma.schoolPayment.findMany({
    where: { schoolId },
    orderBy: { createdAt: 'desc' }
  })
  console.log('\n[ADIM 6] Admin panelinde "Ödeme Geçmişi" (PENDING dahil tüm kayıtlar):')
  line()
  for (const p of allPayments) {
    console.log('  ' + pad(p.status, 10) + pad(tl(p.amount), 14) + (p.description || '-'))
  }
  line()
}

async function main() {
  console.log('=== HAKEDIŞ / ÖDEME AKIŞ TESTİ ===\n')
  console.log('[ADIM 1] Eski demo veriler temizleniyor…')
  await reset()

  console.log('[ADIM 2] Demo Koleji + 2 sınıf + 18 sipariş oluşturuluyor…')
  const school = await seedSchoolAndOrders()
  console.log('  schoolId=' + school.id)
  console.log('  müdür login: demo-mudur@okultedarigim.test  /  Demo12345!Test')

  await simulateAdminPayment(school)
  await verifyMudurView(school.id)

  console.log('\nTAMAM. Test senaryosu hazır. Şimdi tarayıcıda:')
  console.log('  → /admin/login    (.env\'deki ADMIN_EMAIL/PASSWORD)')
  console.log('  → /admin/hakedisler   "Demo Koleji" satırını incele')
  console.log('  → /mudur/login    demo-mudur@okultedarigim.test  /  Demo12345!Test')
  console.log('  → /mudur/hakedisler   sadece PAID kayıt görünmeli')
}

main()
  .catch(e => { console.error('HATA:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
