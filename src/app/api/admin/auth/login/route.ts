import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyPassword, createToken } from '@/lib/auth'
import { logAction } from '@/lib/logger'
import { checkRateLimit, recordFailedAttempt, resetRateLimit } from '@/lib/rate-limit'
import { cookies } from 'next/headers'
import { getClientIp } from '@/lib/security'
import { loginBodySchema, formatZodError } from '@/lib/validators'

const GENERIC_LOGIN_ERROR = 'Gecersiz email veya sifre'

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)
    const parsed = loginBodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: formatZodError(parsed.error) },
        { status: 400 }
      )
    }
    const { email, password } = parsed.data

    const ip = getClientIp(request)

    // İki katmanlı rate limit:
    //   (IP+email): 5 yanlış deneme / 15 dk → spesifik hesap brute-force
    //   (IP):       30 yanlış deneme / 30 dk → password spraying
    const rlSpecific = `admin-login:${ip}:${email}`
    const rlGlobal = `admin-login-ip:${ip}`

    const [specific, global] = await Promise.all([
      checkRateLimit(rlSpecific, 5, 15),
      checkRateLimit(rlGlobal, 30, 30),
    ])

    if (!specific.allowed || !global.allowed) {
      const blockedUntil = !specific.allowed ? specific.blockedUntil : global.blockedUntil
      const waitMinutes = blockedUntil
        ? Math.ceil((blockedUntil.getTime() - Date.now()) / 60000)
        : 15
      return NextResponse.json(
        { error: `Cok fazla basarisiz deneme. ${waitMinutes} dakika sonra tekrar deneyin.` },
        { status: 429 }
      )
    }

    const admin = await prisma.admin.findUnique({
      where: { email }
    })

    // Kullanici-enumeration koruması: hesap yok / pasif / yanlış sifre — hep aynı mesaj
    const isValid = admin && admin.isActive && await verifyPassword(password, admin.password)

    if (!isValid) {
      await Promise.all([
        recordFailedAttempt(rlSpecific),
        recordFailedAttempt(rlGlobal),
      ])
      return NextResponse.json(
        { error: GENERIC_LOGIN_ERROR },
        { status: 401 }
      )
    }

    await Promise.all([
      resetRateLimit(rlSpecific),
      resetRateLimit(rlGlobal),
    ])

    const token = await createToken({
      id: admin.id,
      email: admin.email,
      type: 'admin',
      name: admin.name
    })

    await prisma.admin.update({
      where: { id: admin.id },
      data: { lastLogin: new Date() }
    })

    await logAction({
      userId: admin.id,
      userType: 'ADMIN',
      action: 'LOGIN',
      entity: 'USER',
      entityId: admin.id,
      ipAddress: ip,
      details: { email: admin.email }
    })

    const cookieStore = await cookies()
    cookieStore.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7 // 7 gun
    })

    return NextResponse.json({
      success: true,
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email
      }
    })

  } catch (error) {
    console.error('Admin login hatasi:', error)
    return NextResponse.json(
      { error: 'Giris yapilamadi' },
      { status: 500 }
    )
  }
}
