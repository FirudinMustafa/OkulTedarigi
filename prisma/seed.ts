/**
 * Prisma Seed - Production
 * Sadece admin hesabi olusturur.
 * Okullar, siniflar, paketler, siparisler admin panelinden eklenir.
 *
 * Kullanim:  npx prisma db seed
 * Gerekli env: ADMIN_EMAIL, ADMIN_PASSWORD (en az 12 karakter)
 */

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL
  const adminPassword = process.env.ADMIN_PASSWORD
  const adminName = process.env.ADMIN_NAME || 'Sistem Yoneticisi'

  if (!adminEmail || !adminPassword) {
    console.error('HATA: ADMIN_EMAIL ve ADMIN_PASSWORD env degiskenleri zorunludur.')
    process.exit(1)
  }

  if (adminPassword.length < 12) {
    console.error('HATA: ADMIN_PASSWORD en az 12 karakter olmalidir.')
    process.exit(1)
  }

  // Admin zaten var mi kontrol et
  const existing = await prisma.admin.findUnique({
    where: { email: adminEmail }
  })

  if (existing) {
    console.log('Admin zaten mevcut. Seed islemi atlandi.')
    return
  }

  // Admin olustur
  const hashedPassword = await bcrypt.hash(adminPassword, 12)
  const admin = await prisma.admin.create({
    data: {
      name: adminName,
      email: adminEmail,
      password: hashedPassword
    }
  })

  console.log('==========================================')
  console.log('  ADMIN HESABI OLUSTURULDU')
  console.log('==========================================')
  console.log('  Email:', admin.email)
  console.log('  (Sifre console\'a yazilmaz; .env dosyasindan kontrol edin.)')
  console.log('==========================================')
}

main()
  .catch((e) => {
    console.error('Seed hatasi:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
