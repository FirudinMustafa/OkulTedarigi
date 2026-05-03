import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/auth'

export async function GET(request: Request) {
  try {
    const session = await getAdminSession()
    if (!session) {
      return NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const schoolId = searchParams.get('schoolId')
    const search = searchParams.get('search')?.trim()

    // Pagination: limit max 100, default 50
    const rawLimit = parseInt(searchParams.get('limit') || '50', 10)
    const limit = Math.min(Math.max(isNaN(rawLimit) ? 50 : rawLimit, 1), 100)
    const rawPage = parseInt(searchParams.get('page') || '1', 10)
    const page = Math.max(isNaN(rawPage) ? 1 : rawPage, 1)
    const skip = (page - 1) * limit

    const where: Prisma.OrderWhereInput = {}
    if (status) where.status = status as Prisma.EnumOrderStatusFilter
    if (schoolId) where.class = { schoolId }
    if (search) {
      where.OR = [
        { orderNumber: { contains: search } },
        { parentName: { contains: search } },
        { studentName: { contains: search } },
        { phone: { contains: search } },
        { email: { contains: search } }
      ]
    }

    const [orders, totalCount] = await prisma.$transaction([
      prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          class: {
            include: {
              school: { select: { id: true, name: true, deliveryType: true } }
            }
          },
          package: {
            select: { name: true }
          },
          students: {
            select: { id: true, firstName: true, lastName: true, section: true },
            orderBy: { createdAt: 'asc' }
          }
        }
      }),
      prisma.order.count({ where })
    ])

    // Map to expected format for admin panel
    const mappedOrders = orders.map(order => ({
      ...order,
      parentPhone: order.phone,
      parentEmail: order.email,
      deliveryType: order.class.school.deliveryType,
      deliveryAddress: order.deliveryAddress || order.address
    }))

    return NextResponse.json({
      orders: mappedOrders,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    })
  } catch (error) {
    console.error('Siparisler listelenemedi:', error)
    return NextResponse.json(
      { error: 'Siparisler yuklenemedi' },
      { status: 500 }
    )
  }
}
