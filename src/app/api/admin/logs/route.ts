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

    // Pagination (max 100 per page, default 50)
    const rawLimit = parseInt(searchParams.get('limit') || '50', 10)
    const limit = Math.min(Math.max(isNaN(rawLimit) ? 50 : rawLimit, 1), 100)
    const rawPage = parseInt(searchParams.get('page') || '1', 10)
    const page = Math.max(isNaN(rawPage) ? 1 : rawPage, 1)
    const skip = (page - 1) * limit

    // Filters
    const userType = searchParams.get('userType')
    const action = searchParams.get('action')
    const entity = searchParams.get('entity')
    const userId = searchParams.get('userId')

    const where: Record<string, unknown> = {}
    if (userType && typeof userType === 'string') where.userType = userType
    if (action && typeof action === 'string') where.action = action
    if (entity && typeof entity === 'string') where.entity = entity
    if (userId && typeof userId === 'string') where.userId = userId

    const [logs, totalCount] = await prisma.$transaction([
      prisma.systemLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.systemLog.count({ where })
    ])

    return NextResponse.json({
      logs,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    })
  } catch (error) {
    console.error('Loglar listelenemedi:', error)
    return NextResponse.json(
      { error: 'Loglar yuklenemedi' },
      { status: 500 }
    )
  }
}
