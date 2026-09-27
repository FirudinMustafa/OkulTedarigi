import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Veli formunda indirim kodu kutusunun gosterilip gosterilmeyecegini belirler:
// bu okulda su an gecerli/kullanilabilir en az bir indirim kodu var mi?
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const schoolId = searchParams.get('schoolId')
    if (!schoolId) {
      return NextResponse.json({ available: false })
    }

    const now = new Date()
    const discounts = await prisma.discount.findMany({
      where: {
        isActive: true,
        validFrom: { lte: now },
        validUntil: { gte: now }
      },
      select: {
        usageLimit: true,
        usedCount: true,
        schools: { select: { schoolId: true } }
      }
    })

    const available = discounts.some(d => {
      const usageOk = !d.usageLimit || d.usedCount < d.usageLimit
      const schoolOk = d.schools.length === 0 || d.schools.some(s => s.schoolId === schoolId)
      return usageOk && schoolOk
    })

    return NextResponse.json({ available })
  } catch (error) {
    console.error('Indirim uygunlugu kontrol edilemedi:', error)
    return NextResponse.json({ available: false })
  }
}
