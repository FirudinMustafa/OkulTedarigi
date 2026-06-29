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

  // GUVENLIK: yalnizca ILK kurulum. Admin zaten varsa reddet — token sizsa bile
  // mevcut admin sifresi EZILEMEZ (hesap ele gecirme onlenir).
  const adminCount = await prisma.admin.count()
  if (adminCount > 0) {
    return NextResponse.json({ error: 'already_initialized' }, { status: 403 })
  }

  // Cift onay: kazara/otomatik tetiklemeye karsi ek bariyer.
  const reqBody = await request.json().catch(() => ({})) as { confirm?: string }
  if (reqBody?.confirm !== 'BOOTSTRAP_ADMIN_INIT') {
    return NextResponse.json(
      { error: 'Confirmation token required. Send: {"confirm":"BOOTSTRAP_ADMIN_INIT"}' },
      { status: 400 }
    )
  }

  const email = process.env.ADMIN_EMAIL
  const password = process.env.ADMIN_PASSWORD
  const name = process.env.ADMIN_NAME || 'Admin'

  if (!email || !password) {
    return NextResponse.json({ error: 'env_missing' }, { status: 500 })
  }

  const hashed = await hashPassword(password)

  // upsert degil create — sadece admin yokken calisir (yukarida garanti edildi).
  const admin = await prisma.admin.create({
    data: { email, password: hashed, name, isActive: true },
  })

  return NextResponse.json({
    ok: true,
    adminId: admin.id,
    email: admin.email,
    name: admin.name,
  })
}
