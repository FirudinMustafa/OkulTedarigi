import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const expected = process.env.BOOTSTRAP_TOKEN
  if (!expected) return NextResponse.json({ error: 'disabled' }, { status: 404 })

  const provided = request.headers.get('x-bootstrap-token')
  if (!provided || provided !== expected) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const email = process.env.ADMIN_EMAIL
  const password = process.env.ADMIN_PASSWORD
  const name = process.env.ADMIN_NAME || 'Admin'

  if (!email || !password) {
    return NextResponse.json({ error: 'env_missing' }, { status: 500 })
  }

  const hashed = await hashPassword(password)

  const admin = await prisma.admin.upsert({
    where: { email },
    update: { password: hashed, isActive: true, name },
    create: { email, password: hashed, name, isActive: true },
  })

  return NextResponse.json({
    ok: true,
    adminId: admin.id,
    email: admin.email,
    name: admin.name,
  })
}
