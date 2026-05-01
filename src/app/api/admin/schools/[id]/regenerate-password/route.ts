import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/auth'
import { logAction } from '@/lib/logger'
import { generateSchoolPassword } from '@/lib/password-generator'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession()
    if (!session) {
      return NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 401 })
    }

    const { id } = await params

    // Okulu bul
    const school = await prisma.school.findUnique({
      where: { id }
    })

    if (!school) {
      return NextResponse.json({ error: 'Okul bulunamadi' }, { status: 404 })
    }

    // Benzersiz sifre olustur (12 karakter random — collision olasiligi 10^-18)
    let newPassword: string = ''
    let isUnique = false
    let attempt = 0

    while (!isUnique && attempt < 5) {
      newPassword = generateSchoolPassword()
      const existing = await prisma.school.findFirst({
        where: {
          password: newPassword,
          id: { not: id }
        }
      })
      if (!existing) isUnique = true
      attempt++
    }

    if (!newPassword || !isUnique) {
      return NextResponse.json(
        { error: 'Benzersiz sifre olusturulamadi, tekrar deneyin' },
        { status: 500 }
      )
    }

    // Sifreyi guncelle
    const updatedSchool = await prisma.school.update({
      where: { id },
      data: { password: newPassword }
    })

    await logAction({
      userId: session.id,
      userType: 'ADMIN',
      action: 'UPDATE',
      entity: 'SCHOOL',
      entityId: school.id,
      details: { action: 'password_regenerated' }
    })

    return NextResponse.json({
      success: true,
      password: updatedSchool.password
    })
  } catch (error) {
    console.error('Sifre yenilenemedi:', error)
    return NextResponse.json(
      { error: 'Sifre yenilenemedi' },
      { status: 500 }
    )
  }
}
