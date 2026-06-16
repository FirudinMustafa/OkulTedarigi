import { NextResponse } from 'next/server'
import { Prisma, OrderStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/auth'
import { UNPAID_STATUSES } from '@/lib/constants'
import { getApiLocale } from '@/lib/api-locale'
import { getTranslations } from 'next-intl/server'

export async function GET(request: Request) {
  const t = await getTranslations({ locale: await getApiLocale(), namespace: 'apiErrors' })
  try {
    const session = await getAdminSession()
    if (!session) {
      return NextResponse.json({ error: t('orders.unauthorized') }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const schoolId = searchParams.get('schoolId')
    const search = searchParams.get('search')?.trim()
    const startStr = searchParams.get('start') || undefined
    const endStr = searchParams.get('end') || undefined

    // Pagination: limit max 100, default 50
    const rawLimit = parseInt(searchParams.get('limit') || '50', 10)
    const limit = Math.min(Math.max(isNaN(rawLimit) ? 50 : rawLimit, 1), 100)
    const rawPage = parseInt(searchParams.get('page') || '1', 10)
    const page = Math.max(isNaN(rawPage) ? 1 : rawPage, 1)
    const skip = (page - 1) * limit

    const where: Prisma.OrderWhereInput = {}
    if (status) {
      where.status = status as Prisma.EnumOrderStatusFilter
    } else {
      // Status filtresi verilmediyse odenmemis (NEW/PAYMENT_PENDING) siparisleri gizle —
      // odenmemis hicbir siparis admin panele dusmemeli.
      where.status = { notIn: UNPAID_STATUSES as OrderStatus[] }
    }
    if (schoolId) where.class = { schoolId }

    // Tarih bazli filtreleme (start/end; date veya datetime-local).
    //   "2026-05-03"       -> tum gunu kapsar
    //   "2026-05-03T14:30" -> tam o ana kadar
    const isDateOnly = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s)
    const dateWhere: { gte?: Date; lte?: Date } = {}
    if (startStr) {
      const d = new Date(startStr)
      if (!isNaN(d.getTime())) dateWhere.gte = d
    }
    if (endStr) {
      const d = new Date(endStr)
      if (!isNaN(d.getTime())) {
        if (isDateOnly(endStr)) d.setHours(23, 59, 59, 999)
        dateWhere.lte = d
      }
    }
    if (dateWhere.gte || dateWhere.lte) where.createdAt = dateWhere

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
      { error: t('orders.ordersLoadFailed') },
      { status: 500 }
    )
  }
}
