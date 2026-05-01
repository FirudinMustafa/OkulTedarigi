const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Turkish names for realistic data
const parentNames = [
  'Ahmet Yilmaz', 'Mehmet Demir', 'Ayse Kaya', 'Fatma Celik', 'Ali Ozturk',
  'Emine Arslan', 'Hasan Sahin', 'Zeynep Yildiz', 'Mustafa Aydin', 'Hatice Kurt',
  'Huseyin Ozkan', 'Elif Korkmaz', 'Ibrahim Aksoy', 'Merve Polat', 'Osman Dogan',
  'Selin Erdogan', 'Yusuf Kilic', 'Derya Aslan', 'Kemal Cinar', 'Busra Tekin'
];

const studentNames = [
  'Efe Yilmaz', 'Can Demir', 'Defne Kaya', 'Zeynep Celik', 'Beren Ozturk',
  'Yigit Arslan', 'Ada Sahin', 'Kerem Yildiz', 'Ela Aydin', 'Mert Kurt',
  'Asya Ozkan', 'Emir Korkmaz', 'Nehir Aksoy', 'Arda Polat', 'Maya Dogan',
  'Atlas Erdogan', 'Lina Kilic', 'Alperen Aslan', 'Derin Cinar', 'Masal Tekin'
];

const statuses = [
  'PAYMENT_RECEIVED', 'CONFIRMED', 'INVOICED', 'CARGO_SHIPPED',
  'DELIVERED_TO_SCHOOL', 'DELIVERED_BY_CARGO', 'COMPLETED'
];

function randomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function generateOrderNumber() {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `ORD-${dateStr}-${code}`;
}

async function main() {
  console.log('Fetching classes...');

  // Get all classes with their packages and schools
  const classes = await prisma.class.findMany({
    include: {
      school: true,
      package: true
    }
  });

  if (classes.length === 0) {
    console.log('No classes found. Please seed classes first.');
    return;
  }

  console.log(`Found ${classes.length} classes`);

  const ordersToCreate = [];
  const now = new Date();
  const threeMonthsAgo = new Date(now);
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  // Create 50 orders spread across classes and time
  for (let i = 0; i < 50; i++) {
    const cls = classes[Math.floor(Math.random() * classes.length)];
    if (!cls.package) continue;

    const parentIndex = Math.floor(Math.random() * parentNames.length);
    const studentIndex = Math.floor(Math.random() * studentNames.length);
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const createdAt = randomDate(threeMonthsAgo, now);

    const isCargo = cls.school.deliveryType === 'CARGO';
    const paymentMethod = Math.random() > 0.3 ? 'CREDIT_CARD' : 'CASH_ON_DELIVERY';

    // Generate dates based on status
    let paidAt = null;
    let confirmedAt = null;
    let invoicedAt = null;
    let shippedAt = null;
    let deliveredAt = null;

    if (['PAYMENT_RECEIVED', 'CONFIRMED', 'INVOICED', 'CARGO_SHIPPED', 'DELIVERED_TO_SCHOOL', 'DELIVERED_BY_CARGO', 'COMPLETED'].includes(status)) {
      paidAt = new Date(createdAt.getTime() + Math.random() * 3600000); // within 1 hour
    }
    if (['CONFIRMED', 'INVOICED', 'CARGO_SHIPPED', 'DELIVERED_TO_SCHOOL', 'DELIVERED_BY_CARGO', 'COMPLETED'].includes(status)) {
      confirmedAt = new Date(paidAt.getTime() + Math.random() * 86400000); // within 1 day
    }
    if (['INVOICED', 'CARGO_SHIPPED', 'DELIVERED_TO_SCHOOL', 'DELIVERED_BY_CARGO', 'COMPLETED'].includes(status)) {
      invoicedAt = new Date(confirmedAt.getTime() + Math.random() * 86400000);
    }
    if (['CARGO_SHIPPED', 'DELIVERED_BY_CARGO', 'COMPLETED'].includes(status) && isCargo) {
      shippedAt = new Date(invoicedAt.getTime() + Math.random() * 86400000);
    }
    if (['DELIVERED_TO_SCHOOL', 'DELIVERED_BY_CARGO', 'COMPLETED'].includes(status)) {
      deliveredAt = new Date((shippedAt || invoicedAt || confirmedAt).getTime() + Math.random() * 172800000); // within 2 days
    }

    const cities = ['Istanbul', 'Ankara', 'Izmir', 'Bursa', 'Antalya'];
    const districts = ['Kadikoy', 'Besiktas', 'Uskudar', 'Sisli', 'Bakirkoy', 'Fatih', 'Beyoglu'];

    ordersToCreate.push({
      orderNumber: generateOrderNumber(),
      parentName: parentNames[parentIndex],
      studentName: studentNames[studentIndex],
      phone: `053${Math.floor(10000000 + Math.random() * 90000000)}`,
      email: `${parentNames[parentIndex].toLowerCase().replace(' ', '.')}@gmail.com`,
      address: isCargo ? `${districts[Math.floor(Math.random() * districts.length)]} Mah. ${Math.floor(100 + Math.random() * 900)} Sok. No: ${Math.floor(1 + Math.random() * 50)}, ${cities[Math.floor(Math.random() * cities.length)]}` : null,
      totalAmount: cls.package.price,
      status: status,
      paymentMethod: paymentMethod,
      paidAt: paidAt,
      confirmedAt: confirmedAt,
      invoicedAt: invoicedAt,
      shippedAt: shippedAt,
      deliveredAt: deliveredAt,
      trackingNo: shippedAt ? `TR${Math.floor(100000000000 + Math.random() * 900000000000)}` : null,
      createdAt: createdAt,
      classId: cls.id,
      packageId: cls.package.id
    });
  }

  console.log(`Creating ${ordersToCreate.length} orders...`);

  // Create orders one by one to avoid duplicate order number issues
  let created = 0;
  for (const order of ordersToCreate) {
    try {
      await prisma.order.create({ data: order });
      created++;
    } catch (e) {
      // Skip if order number already exists
      if (e.code === 'P2002') {
        console.log(`Skipping duplicate order: ${order.orderNumber}`);
      } else {
        console.error(`Error creating order: ${e.message}`);
      }
    }
  }

  console.log(`Created ${created} orders successfully!`);

  // Show summary
  const orderStats = await prisma.order.groupBy({
    by: ['status'],
    _count: { status: true }
  });

  console.log('\n=== ORDER SUMMARY ===');
  orderStats.forEach(stat => {
    console.log(`${stat.status}: ${stat._count.status}`);
  });

  const totalRevenue = await prisma.order.aggregate({
    _sum: { totalAmount: true }
  });
  console.log(`\nTotal Revenue: ${Number(totalRevenue._sum.totalAmount || 0).toLocaleString('tr-TR')} TL`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
