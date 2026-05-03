import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/auth'

export async function GET(request: Request) {
  try {
    const session = await getAdminSession()
    if (!session) {
      return NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const schoolId = searchParams.get('schoolId')
    const classId = searchParams.get('classId')

    const where: Record<string, unknown> = {
      deliveryDocumentId: null,
      status: { in: ['CONFIRMED', 'INVOICED'] },
      class: { school: { deliveryType: 'SCHOOL_DELIVERY' } }
    }

    if (schoolId) {
      where.class = { ...where.class as object, schoolId }
    }
    if (classId) {
      where.classId = classId
    }

    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        orderNumber: true,
        studentName: true,
        parentName: true,
        phone: true,
        status: true,
        totalAmount: true,
        createdAt: true,
        class: {
          select: {
            id: true,
            name: true,
            school: {
              select: { id: true, name: true }
            }
          }
        },
        package: {
          select: { name: true }
        }
      }
    })

    // Okul ve sinif listesi (filtreleme icin)
    const schools = await prisma.school.findMany({
      where: { deliveryType: 'SCHOOL_DELIVERY', isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' }
    })

    const classes = await prisma.class.findMany({
      where: schoolId ? { schoolId, isActive: true } : { isActive: true },
      select: { id: true, name: true, schoolId: true },
      orderBy: { name: 'asc' }
    })

    return NextResponse.json({ orders, schools, classes })
  } catch (error) {
    console.error('Bekleyen siparisler yuklenemedi:', error)
    return NextResponse.json({ error: 'Veri yuklenemedi' }, { status: 500 })
  }
}
