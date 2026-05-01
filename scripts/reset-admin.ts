import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const email = process.env.ADMIN_EMAIL!
  const password = process.env.ADMIN_PASSWORD!
  const hashed = await bcrypt.hash(password, 12)
  const result = await prisma.admin.update({
    where: { email: email.toLowerCase() },
    data: { password: hashed, isActive: true }
  })
  console.log('Admin sifresi sifirlandi:', result.email)
}

main().finally(() => prisma.$disconnect())
