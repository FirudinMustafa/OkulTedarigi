/**
 * AUDIT SEED — kapsamlı sistem denetimi için test verisi üretir.
 *
 * Idempotent: aynı isimle çalıştırılırsa önce eski AUDIT_ kayıtlarını temizler,
 * sonra yenilerini ekler. Production verisine DOKUNMAZ.
 *
 * Kullanım:  npx tsx scripts/audit-seed.ts
 *            (veya)  npx ts-node --compiler-options '{"module":"commonjs"}' scripts/audit-seed.ts
 */

import { PrismaClient, OrderStatus, DeliveryType, CancelRequestStatus, DiscountType } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

// ============================================================
// Yardımcılar
// ============================================================
const PREFIX = 'AUDIT_'
const log = (...a: unknown[]) => console.log('[seed]', ...a)

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}
function rint(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}
function chance(p: number): boolean {
  return Math.random() < p
}

// Algoritmaya uygun test TC'si üretir (deterministik, ilk 9 hane verilince son 2 hesaplanır)
function makeValidTC(seed: number): string {
  // İlk hane 1-9, sonraki 8 hane 0-9 — seed'den deterministik üret
  const digits: number[] = []
  digits.push((seed % 9) + 1)
  let s = seed
  for (let i = 0; i < 8; i++) {
    s = (s * 9301 + 49297) % 233280
    digits.push(Math.abs(s) % 10)
  }
  // 10. hane: ((odd*7 - even) % 10 + 10) % 10
  const odd = digits[0] + digits[2] + digits[4] + digits[6] + digits[8]
  const even = digits[1] + digits[3] + digits[5] + digits[7]
  const tenth = (((odd * 7 - even) % 10) + 10) % 10
  digits.push(tenth)
  // 11. hane: ilk 10'un toplamı % 10
  const eleventh = digits.reduce((a, b) => a + b, 0) % 10
  digits.push(eleventh)
  return digits.join('')
}

// 1000 farklı geçerli TC havuzu
const VALID_TC_POOL: string[] = []
for (let i = 1000; i < 2000; i++) {
  const tc = makeValidTC(i)
  if (!VALID_TC_POOL.includes(tc)) VALID_TC_POOL.push(tc)
}

// Sipariş numarası üretici
function genOrderNumber(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let s = 'ORD-2026-AUDIT-'
  for (let i = 0; i < 8; i++) s += chars[rint(0, 31)]
  return s
}

// Türkçe karakter testi için adlar
const TR_FIRST_NAMES = ['Ayşe', 'Mehmet', 'Mustafa', 'Hatice', 'İrem', 'Çiğdem', 'Şükrü', 'Gülşah', 'Özge', 'Ümit', 'Eylül', 'Görkem', 'Berna', 'Cenk', 'Esra', 'Hilmi', 'Kübra', 'Müge', 'Necla', 'Pınar']
const TR_LAST_NAMES = ['Yıldız', 'Çelik', 'Şahin', 'Öztürk', 'Güneş', 'Demir', 'Kaya', 'Şen', 'Yılmaz', 'Aydın', 'Arslan', 'Çakır', 'Öncel', 'Gönenç', 'Üstün', 'İnal']

// İl/ilçe örneği
const ADDRESSES = [
  'Cumhuriyet Mah. Atatürk Cd. No:15, Çankaya, Ankara, 06520, Türkiye',
  'Kızılay Mah. Ziya Gökalp Cd. No:88, Çankaya, Ankara, 06420, Türkiye',
  'Maltepe Mah. Eskişehir Yolu No:204, Çankaya, Ankara, 06570, Türkiye',
  'Bahçelievler Mah. Cevizlibağ Sk. No:12 Daire:5, Bahçelievler, İstanbul, 34180, Türkiye',
  'Alsancak Mah. Kıbrıs Şehitleri Cd. No:42, Konak, İzmir, 35220, Türkiye',
]

// 6 ay içerisinde rastgele tarih
function randomDateLast6Months(): Date {
  const now = Date.now()
  const sixMonthsMs = 180 * 24 * 60 * 60 * 1000
  return new Date(now - rint(0, sixMonthsMs))
}

// ============================================================
// 1. CLEANUP — eski AUDIT_ kayıtlarını sil
// ============================================================
async function cleanup() {
  log('Eski AUDIT_ kayıtları temizleniyor...')

  // İlişki sırasıyla sil
  await prisma.orderStudent.deleteMany({
    where: { order: { orderNumber: { startsWith: 'ORD-2026-AUDIT-' } } }
  })
  await prisma.cancelRequest.deleteMany({
    where: { order: { orderNumber: { startsWith: 'ORD-2026-AUDIT-' } } }
  })
  await prisma.order.deleteMany({
    where: { orderNumber: { startsWith: 'ORD-2026-AUDIT-' } }
  })
  await prisma.discount.deleteMany({
    where: { code: { startsWith: PREFIX } }
  })
  // Sınıf/paket/okul: cascade ile temizlenir
  await prisma.class.deleteMany({
    where: { school: { name: { startsWith: PREFIX } } }
  })
  await prisma.package.deleteMany({
    where: { name: { startsWith: PREFIX } }
  })
  await prisma.school.deleteMany({
    where: { name: { startsWith: PREFIX } }
  })

  log('Cleanup tamam.')
}

// ============================================================
// 2. OKULLAR (5 farklı senaryo)
// ============================================================
async function createSchools() {
  log('Okullar oluşturuluyor...')
  const directorPwHash = await bcrypt.hash('AuditMudur123!', 12)

  const data = [
    {
      name: PREFIX + 'Atatürk İlkokulu (Türkçe karakterli)',
      address: 'Cumhuriyet Mah. Atatürk Bulvarı No:1, Çankaya, Ankara',
      phone: '03124441100',
      email: 'audit-ataturk@test.local',
      deliveryType: DeliveryType.CARGO,
      password: 'AUDIT_ATATURK_PWD_001',
      directorName: 'Müdür Şükrü Öztürk',
      directorEmail: 'audit-mudur1@test.local',
      directorPassword: directorPwHash,
      isActive: true,
    },
    {
      name: PREFIX + 'Mimar Sinan Anaokulu',
      address: 'Bahçelievler Mh. Mimar Sinan Cd., Bahçelievler, İstanbul',
      phone: '02124442200',
      email: 'audit-mimarsinan@test.local',
      deliveryType: DeliveryType.SCHOOL_DELIVERY,
      password: 'AUDIT_MIMARSIN_PWD',
      directorName: 'Necla Yıldız',
      directorEmail: 'audit-mudur2@test.local',
      directorPassword: directorPwHash,
      isActive: true,
    },
    {
      name: PREFIX + 'Cumhuriyet Ortaokulu',
      address: 'Kızılay, Ankara',
      phone: '03124443300',
      email: 'audit-cumhuriyet@test.local',
      deliveryType: DeliveryType.SCHOOL_DELIVERY,
      password: 'AUDIT_CUMHURIYET_PWD',
      directorName: 'Mehmet Demir',
      directorEmail: 'audit-mudur3@test.local',
      directorPassword: directorPwHash,
      isActive: true,
    },
    {
      // 1 pasif okul
      name: PREFIX + 'Pasif Test Okulu (isActive=false)',
      address: 'Test, Test',
      phone: '03124444400',
      email: 'audit-pasif@test.local',
      deliveryType: DeliveryType.CARGO,
      password: 'AUDIT_PASIF_PWD',
      directorName: 'Pasif Müdür',
      directorEmail: 'audit-mudur4@test.local',
      directorPassword: directorPwHash,
      isActive: false,
    },
    {
      // 1 uzun isimli okul
      name: PREFIX + 'Çok Uzun İsimli Vakıf Eğitim Kurumları Anonim Şirketi Yönetimindeki Şehit Öğretmen Halime Çakır Anaokulu ve İlkokulu Birleşik Eğitim Kampüsü Çankaya Şubesi',
      address: 'Maltepe Mh., Çankaya, Ankara, 06570',
      phone: '03124445500',
      email: 'audit-uzun@test.local',
      deliveryType: DeliveryType.SCHOOL_DELIVERY,
      password: 'AUDIT_UZUN_PWD_001',
      directorName: 'Uzun Müdür',
      directorEmail: 'audit-mudur5@test.local',
      directorPassword: directorPwHash,
      isActive: true,
    },
  ]

  const schools = []
  for (const d of data) {
    const s = await prisma.school.create({ data: d })
    schools.push(s)
  }

  log(`${schools.length} okul oluşturuldu (${schools.filter(s => s.isActive).length} aktif, ${schools.filter(s => !s.isActive).length} pasif)`)
  return schools
}

// ============================================================
// 3. PAKETLER (10 farklı çeşit)
// ============================================================
async function createPackages() {
  log('Paketler oluşturuluyor...')

  const packages = [
    {
      name: PREFIX + '1. Sınıf Standart Paket',
      price: 1500,
      desc: '1. sınıf öğrencileri için temel ders kitapları + kırtasiye.',
      itemCount: 8,
    },
    {
      name: PREFIX + '2. Sınıf Geniş Paket',
      price: 2500,
      desc: '2. sınıf — tam set.',
      itemCount: 12,
    },
    {
      name: PREFIX + '3. Sınıf Ekonomik',
      price: 1200,
      desc: 'Sadece ders kitapları.',
      itemCount: 4,
    },
    {
      name: PREFIX + '4. Sınıf Premium Paket',
      price: 3500,
      desc: 'Premium kalite + ek kaynaklar.',
      itemCount: 18,
    },
    {
      name: PREFIX + '5. Sınıf Standart',
      price: 2800,
      desc: '5. sınıf paketi.',
      itemCount: 14,
    },
    {
      name: PREFIX + '6. Sınıf Anadolu',
      price: 3000,
      desc: 'Anadolu lisesi hazırlık ek kaynaklarıyla.',
      itemCount: 16,
    },
    {
      name: PREFIX + '7. Sınıf Yoğun Paket',
      price: 4200,
      desc: 'LGS hazırlık dahil.',
      itemCount: 22,
    },
    {
      name: PREFIX + '8. Sınıf LGS Paketi',
      price: 5500,
      desc: 'LGS sınavına hazırlık paketi.',
      itemCount: 25,
    },
    {
      // Boş içerikli paket — edge case
      name: PREFIX + 'Boş İçerikli Paket (item=0)',
      price: 100,
      desc: 'Test için boş paket.',
      itemCount: 0,
    },
    {
      // Çok uzun açıklama (5000+ char)
      name: PREFIX + 'Aşırı Uzun Açıklamalı Paket',
      price: 50000,
      desc: 'Çok uzun açıklama testi. ' + 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(100),
      itemCount: 30,
    },
  ]

  const result = []
  for (const p of packages) {
    const items = []
    for (let i = 0; i < p.itemCount; i++) {
      items.push({
        name: `Test Ürün ${i + 1} (Türkçe: ı-ş-ğ-ü-ö-ç)`,
        quantity: rint(1, 5),
        price: rint(20, 500),
      })
    }
    const pkg = await prisma.package.create({
      data: {
        name: p.name,
        description: p.desc,
        note: 'Audit test paketi notu',
        price: p.price,
        isActive: true,
        items: items.length > 0 ? { create: items } : undefined,
      }
    })
    result.push(pkg)
  }
  log(`${result.length} paket oluşturuldu (${result.reduce((a, p) => a + 0, 0)} ürün dahil)`)
  return result
}

// ============================================================
// 4. SINIFLAR (her okul 4-6, 1 pasif, 1 packageId=null)
// ============================================================
async function createClasses(schools: { id: string; isActive: boolean }[], packages: { id: string }[]) {
  log('Sınıflar oluşturuluyor...')
  const classNames = ['1. Sınıf', '2. Sınıf', '3. Sınıf', '4. Sınıf', '5. Sınıf', '6. Sınıf', '7. Sınıf', '8. Sınıf']
  const classes = []

  for (const school of schools) {
    const count = rint(4, 6)
    const usedNames = new Set<string>()
    for (let i = 0; i < count; i++) {
      let name: string
      do {
        name = pick(classNames)
      } while (usedNames.has(name))
      usedNames.add(name)

      const isPackageNull = i === 0 && school.isActive  // her aktif okulun 1 sınıfı paketsiz
      const isInactive = i === 1                         // her okulun 1 sınıfı pasif

      const cls = await prisma.class.create({
        data: {
          name,
          schoolId: school.id,
          packageId: isPackageNull ? null : pick(packages).id,
          commissionAmount: rint(50, 500),
          isActive: !isInactive,
        }
      })
      classes.push(cls)
    }
  }
  log(`${classes.length} sınıf oluşturuldu`)
  return classes
}

// ============================================================
// 5. İNDİRİM KODLARI
// ============================================================
async function createDiscounts() {
  log('İndirim kodları oluşturuluyor...')
  const now = new Date()
  const future = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)
  const past = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const farPast = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)

  const data = [
    {
      code: PREFIX + 'YUZDE10',
      type: DiscountType.PERCENTAGE,
      value: 10,
      validFrom: past,
      validUntil: future,
      description: '%10 indirim',
      isActive: true,
    },
    {
      code: PREFIX + 'SABIT500',
      type: DiscountType.FIXED,
      value: 500,
      validFrom: past,
      validUntil: future,
      minAmount: 1000,
      description: '500 TL sabit indirim',
      isActive: true,
    },
    {
      code: PREFIX + 'LIMIT5',
      type: DiscountType.PERCENTAGE,
      value: 15,
      validFrom: past,
      validUntil: future,
      usageLimit: 5,
      description: '5 kullanım limitli',
      isActive: true,
    },
    {
      code: PREFIX + 'EXPIRED',
      type: DiscountType.PERCENTAGE,
      value: 20,
      validFrom: farPast,
      validUntil: past,  // süresi DOLMUŞ
      description: 'Süresi dolmuş kod',
      isActive: true,
    },
  ]

  const result = []
  for (const d of data) result.push(await prisma.discount.create({ data: d }))
  log(`${result.length} indirim kodu oluşturuldu`)
  return result
}

// ============================================================
// 6. SİPARİŞLER (200+, her durumdan en az 15)
// ============================================================
const STATUS_COUNTS: Record<OrderStatus, number> = {
  NEW: 15,
  PAYMENT_PENDING: 15,
  PAID: 20,
  CONFIRMED: 25,
  INVOICED: 30,
  SHIPPED: 30,
  DELIVERED: 20,
  COMPLETED: 35,
  CANCELLED: 15,
  REFUNDED: 10,
}

async function createOrders(
  classes: { id: string; packageId: string | null; isActive: boolean; school?: { isActive: boolean }; schoolId: string }[],
  packages: { id: string; price: { toString(): string } }[],
  discounts: { id: string; code: string }[]
) {
  log('Siparişler oluşturuluyor...')

  // Sadece aktif sınıf + paketli sınıfları kullan
  const usableClasses = classes.filter(c => c.isActive && c.packageId)
  if (usableClasses.length === 0) throw new Error('Kullanılabilir sınıf yok')

  // Sınıfların hangi paket fiyatına sahip olduğunu cache'le
  const pkgById = new Map(packages.map(p => [p.id, Number(p.price)]))

  const ordersToCreate: Array<{ status: OrderStatus; idx: number }> = []
  for (const [status, count] of Object.entries(STATUS_COUNTS) as [OrderStatus, number][]) {
    for (let i = 0; i < count; i++) ordersToCreate.push({ status, idx: i })
  }

  let createdCount = 0
  let multiStudentCount = 0
  let withDiscountCount = 0
  let altAddressCount = 0
  const usedTcByClass = new Map<string, Set<string>>()  // class başına TC tekilliği

  for (const job of ordersToCreate) {
    const cls = pick(usableClasses)
    const unitPrice = pkgById.get(cls.packageId!) ?? 1000

    // Çoklu öğrenci dağılımı: %50 tek, %30 iki, %15 üç, %5 dört-beş
    const r = Math.random()
    const studentCount = r < 0.5 ? 1 : r < 0.8 ? 2 : r < 0.95 ? 3 : rint(4, 5)
    if (studentCount > 1) multiStudentCount++

    const totalBase = Math.round(unitPrice * studentCount * 100) / 100

    // %30 indirim uygula (sadece aktif kodlardan)
    const useDiscount = chance(0.3) ? pick(discounts.filter(d => !d.code.includes('EXPIRED'))) : null
    let discountAmount: number | null = null
    let totalAmount = totalBase
    if (useDiscount) {
      const code = useDiscount.code
      if (code.includes('YUZDE10')) discountAmount = Math.round(totalBase * 10) / 100
      else if (code.includes('SABIT500')) discountAmount = totalBase >= 1000 ? 500 : null
      else if (code.includes('LIMIT5')) discountAmount = Math.round(totalBase * 15) / 100
      if (discountAmount) {
        totalAmount = Math.round((totalBase - discountAmount) * 100) / 100
        withDiscountCount++
      }
    }

    // Bireysel/kurumsal mix
    const isCorporate = chance(0.25)
    // TC tekilliği: aynı class'ta aynı TC olamaz (DB constraint yok ama veli/order route kontrolü var)
    if (!usedTcByClass.has(cls.id)) usedTcByClass.set(cls.id, new Set())
    const usedTcs = usedTcByClass.get(cls.id)!
    let taxNumber = ''
    for (let attempts = 0; attempts < 50; attempts++) {
      const candidate = pick(VALID_TC_POOL)
      if (!usedTcs.has(candidate)) { taxNumber = candidate; break }
    }
    if (!taxNumber) taxNumber = pick(VALID_TC_POOL)  // havuz dolduysa, fallback duplicate
    usedTcs.add(taxNumber)

    // Veli/öğrenci adları
    const parentFirst = pick(TR_FIRST_NAMES)
    const parentLast = pick(TR_LAST_NAMES)
    const parentName = `${parentFirst} ${parentLast}`

    // Adres
    const address = pick(ADDRESSES)
    const altAddress = chance(0.2) ? pick(ADDRESSES) : null
    if (altAddress) altAddressCount++

    // Tarihler — 6 ay içinde
    const createdAt = randomDateLast6Months()
    const dataExtras: Record<string, Date | null> = {}
    if (['PAID', 'CONFIRMED', 'INVOICED', 'SHIPPED', 'DELIVERED', 'COMPLETED', 'CANCELLED', 'REFUNDED'].includes(job.status)) {
      dataExtras.paidAt = new Date(createdAt.getTime() + rint(60_000, 3600_000))
    }
    if (['CONFIRMED', 'INVOICED', 'SHIPPED', 'DELIVERED', 'COMPLETED'].includes(job.status)) {
      dataExtras.confirmedAt = new Date(createdAt.getTime() + 3600_000)
    }
    if (['INVOICED', 'SHIPPED', 'DELIVERED', 'COMPLETED'].includes(job.status)) {
      dataExtras.invoicedAt = new Date(createdAt.getTime() + 7200_000)
    }
    if (['SHIPPED', 'DELIVERED', 'COMPLETED'].includes(job.status)) {
      dataExtras.shippedAt = new Date(createdAt.getTime() + 86400_000)
    }
    if (['DELIVERED', 'COMPLETED'].includes(job.status)) {
      dataExtras.deliveredAt = new Date(createdAt.getTime() + 3 * 86400_000)
    }
    if (['CANCELLED', 'REFUNDED'].includes(job.status)) {
      dataExtras.cancelledAt = new Date(createdAt.getTime() + 86400_000)
    }
    if (job.status === 'REFUNDED') {
      dataExtras.refundedAt = new Date(createdAt.getTime() + 2 * 86400_000)
    }

    // Öğrenciler
    const students = []
    for (let s = 0; s < studentCount; s++) {
      students.push({
        firstName: pick(TR_FIRST_NAMES),
        lastName: parentLast,
        section: pick(['A', 'B', 'C', 'D', 'E']),
      })
    }

    // Sipariş oluştur
    const orderNumber = genOrderNumber()
    await prisma.order.create({
      data: {
        orderNumber,
        parentName,
        studentName: `${students[0].firstName} ${students[0].lastName}`,
        studentSection: students[0].section,
        phone: '055' + String(rint(10000000, 99999999)),
        email: `audit-veli-${createdCount}@test.local`,
        address,
        deliveryAddress: altAddress,
        invoiceAddressSame: !altAddress,
        totalAmount,
        status: job.status,
        paymentMethod: 'CREDIT_CARD',
        isCorporateInvoice: isCorporate,
        companyTitle: isCorporate ? `${parentLast} Ticaret Ltd. Şti.` : null,
        taxNumber,
        taxOffice: isCorporate ? 'Çankaya Vergi Dairesi' : null,
        discountCode: useDiscount?.code ?? null,
        discountAmount,
        trackingNo: ['SHIPPED', 'DELIVERED', 'COMPLETED'].includes(job.status) ? `KRG2026AUDIT${String(createdCount).padStart(6, '0')}` : null,
        invoiceNo: ['INVOICED', 'SHIPPED', 'DELIVERED', 'COMPLETED'].includes(job.status) ? `INV-2026-AUDIT-${String(createdCount).padStart(6, '0')}` : null,
        orderNote: createdCount === 0 ? 'Emoji testi 🎒📚✏️' : (createdCount === 1 ? ('Uzun not testi: ' + 'a'.repeat(480)) : null),
        createdAt,
        updatedAt: createdAt,
        ...dataExtras,
        classId: cls.id,
        packageId: cls.packageId!,
        students: {
          create: students.map(s => ({
            firstName: s.firstName,
            lastName: s.lastName,
            section: s.section,
          })),
        },
      },
    })

    createdCount++
    if ((createdCount % 50) === 0) log(`  ${createdCount} sipariş ekledi…`)
  }

  log(`Toplam ${createdCount} sipariş eklendi`)
  log(`  • Çoklu öğrenci: ${multiStudentCount}`)
  log(`  • İndirim uygulanmış: ${withDiscountCount}`)
  log(`  • Alternatif adresli: ${altAddressCount}`)
  return createdCount
}

// ============================================================
// 7. İPTAL TALEPLERİ (5 adet)
// ============================================================
async function createCancelRequests() {
  log('İptal talepleri oluşturuluyor...')

  // 5 farklı sipariş seç (henüz cancelRequest'i olmayanlardan)
  const candidates = await prisma.order.findMany({
    where: {
      orderNumber: { startsWith: 'ORD-2026-AUDIT-' },
      status: { in: ['NEW', 'PAYMENT_PENDING', 'PAID', 'CONFIRMED'] },
      cancelRequest: null,
    },
    take: 5,
  })

  const statusDist: CancelRequestStatus[] = ['PENDING', 'APPROVED', 'APPROVED', 'REJECTED', 'REJECTED']
  for (let i = 0; i < Math.min(5, candidates.length); i++) {
    const order = candidates[i]
    const status = statusDist[i]
    await prisma.cancelRequest.create({
      data: {
        orderId: order.id,
        reason: `AUDIT test iptal nedeni #${i + 1} (Türkçe: çocuğum okul değiştirdi)`,
        status,
        adminNote: status !== 'PENDING' ? 'Audit admin notu' : null,
        processedAt: status !== 'PENDING' ? new Date() : null,
        processedBy: status !== 'PENDING' ? 'audit-admin' : null,
      },
    })
  }
  log(`${Math.min(5, candidates.length)} iptal talebi oluşturuldu`)
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  console.time('AUDIT seed')

  await cleanup()
  const schools = await createSchools()
  const packages = await createPackages()
  const classes = await createClasses(schools, packages)
  const discounts = await createDiscounts()
  const orderCount = await createOrders(classes, packages, discounts)
  await createCancelRequests()

  console.log('\n=================================')
  console.log('  AUDIT SEED ÖZET')
  console.log('=================================')
  console.log(`  Okul        : ${schools.length}`)
  console.log(`  Sınıf       : ${classes.length}`)
  console.log(`  Paket       : ${packages.length}`)
  console.log(`  İndirim     : ${discounts.length}`)
  console.log(`  Sipariş     : ${orderCount}`)
  console.log(`  İptal talebi: 5`)
  console.log('=================================\n')

  console.timeEnd('AUDIT seed')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
