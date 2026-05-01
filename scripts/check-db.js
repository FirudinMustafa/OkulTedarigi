const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Get all classes with passwords
  const classes = await prisma.class.findMany({
    include: {
      school: { select: { name: true } },
      package: { select: { name: true, price: true } }
    }
  });

  console.log('=== SINIFLAR ve ŞİFRELER ===');
  classes.forEach(c => {
    console.log(`Şifre: ${c.password} | Sınıf: ${c.name} | Okul: ${c.school?.name} | Paket: ${c.package?.name} | Fiyat: ${c.package?.price}`);
  });

  // Get admin users
  const admins = await prisma.admin.findMany({
    select: { email: true, name: true, isActive: true }
  });

  console.log('\n=== ADMİN KULLANICILARI ===');
  admins.forEach(a => {
    console.log(`Email: ${a.email} | Ad: ${a.name} | Aktif: ${a.isActive}`);
  });

  // Get schools
  const schools = await prisma.school.findMany({
    select: { id: true, name: true, deliveryType: true, isActive: true }
  });

  console.log('\n=== OKULLAR ===');
  schools.forEach(s => {
    console.log(`ID: ${s.id} | Ad: ${s.name} | Teslimat: ${s.deliveryType} | Aktif: ${s.isActive}`);
  });

  // Get packages
  const packages = await prisma.package.findMany({
    include: { items: true }
  });

  console.log('\n=== PAKETLER ===');
  packages.forEach(p => {
    console.log(`ID: ${p.id} | Ad: ${p.name} | Fiyat: ${p.price} | Ürünler: ${p.items.map(i => i.name).join(', ')}`);
  });

  // Get orders
  const orders = await prisma.order.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    select: { orderNumber: true, status: true, studentName: true, totalAmount: true }
  });

  console.log('\n=== SON SİPARİŞLER ===');
  orders.forEach(o => {
    console.log(`Sipariş No: ${o.orderNumber} | Durum: ${o.status} | Öğrenci: ${o.studentName} | Tutar: ${o.totalAmount}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
