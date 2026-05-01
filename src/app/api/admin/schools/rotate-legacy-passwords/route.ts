import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/auth'
import { logAction } from '@/lib/logger'
import { generateSchoolPassword, isLegacySchoolPassword } from '@/lib/password-generator'

/**
 * Eski format (SFR-1234, 9000 kombinasyon — enumeration zafiyetli) okul sifrelerini
 * yeni 12 karakterlik guclu formata toplu yeniler.
 *
 * Sadece SUPERADMIN tarafindan calistirilmali. Sonuc: yeni sifreler liste halinde
 * doner. Admin bu listeyi mudurler ile paylasir, sonra response veriyi sifirlar.
 */
export async function POST() {
  try {
    const session = await getAdminSession()
    if (!session) {
      return NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 401 })
    }

    const schools = await prisma.school.findMany({
      select: { id: true, name: true, password: true }
    })

    const legacy = schools.filter(s => isLegacySchoolPassword(s.password))
    if (legacy.length === 0) {
      return NextResponse.json({
        rotated: 0,
        message: 'Eski formatta sifresi olan okul bulunmadi'
      })
    }

    const results: Array<{ schoolId: string; schoolName: string; newPassword: string }> = []

    for (const school of legacy) {
      // Benzersiz yeni sifre uret (collision olasiligi 1.15 * 10^-18 ama yine de check)
      let newPassword = ''
      let isUnique = false
      let attempt = 0

      while (!isUnique && attempt < 5) {
        newPassword = generateSchoolPassword()
        const conflict = await prisma.school.findFirst({
          where: { password: newPassword, NOT: { id: school.id } }
        })
        if (!conflict) isUnique = true
        attempt++
      }

      if (!isUnique) {
        // Cok dusuk olasilikli — log'la, atla
        console.error(`[ROTATE-PWD] ${school.id} icin benzersiz sifre uretilemedi`)
        continue
      }

      await prisma.school.update({
        where: { id: school.id },
        data: { password: newPassword }
      })

      results.push({
        schoolId: school.id,
        schoolName: school.name,
        newPassword
      })

      await logAction({
        userId: session.id,
        userType: 'ADMIN',
        action: 'UPDATE',
        entity: 'SCHOOL',
        entityId: school.id,
        details: { action: 'legacy_password_rotated' }
      })
    }

    return NextResponse.json({
      rotated: results.length,
      results,
      warning: 'Bu sifreler veliye iletilmek uzere bir kez gosteriliyor. Liste sayfayi terk edince tekrar erisilemeyecek.'
    })

  } catch (error) {
    console.error('Toplu sifre yenileme hatasi:', error)
    return NextResponse.json(
      { error: 'Toplu sifre yenileme basarisiz' },
      { status: 500 }
    )
  }
}
