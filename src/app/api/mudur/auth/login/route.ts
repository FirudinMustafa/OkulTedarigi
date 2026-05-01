import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createToken, verifyPassword } from '@/lib/auth'
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

    // İki katmanlı rate limit (password spraying koruması)
    const rlSpecific = `mudur-login:${ip}:${email}`
    const rlGlobal = `mudur-login-ip:${ip}`

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

    const school = await prisma.school.findFirst({
      where: {
        directorEmail: email,
        isActive: true
      }
    })

    // Kullanici-enumeration koruması: hesap yok / pasif / yanlış sifre — hep aynı mesaj
    const isValid = school && await verifyPassword(password, school.directorPassword)

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
      id: school.id,
      email: school.directorEmail,
      type: 'mudur',
      name: school.directorName || 'Mudur',
      schoolId: school.id
    })

    await prisma.school.update({
      where: { id: school.id },
      data: { directorLastLogin: new Date() }
    })

    await logAction({
      userId: school.id,
      userType: 'MUDUR',
      action: 'LOGIN',
      entity: 'USER',
      entityId: school.id,
      ipAddress: ip,
      details: { email, schoolName: school.name }
    })

    const cookieStore = await cookies()
    cookieStore.set('mudur_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7 // 7 gun
    })

    return NextResponse.json({
      success: true,
      school: {
        id: school.id,
        name: school.name,
        directorName: school.directorName
      }
    })

  } catch (error) {
    console.error('Mudur login hatasi:', error)
    return NextResponse.json(
      { error: 'Giris yapilamadi' },
      { status: 500 }
    )
  }
}
