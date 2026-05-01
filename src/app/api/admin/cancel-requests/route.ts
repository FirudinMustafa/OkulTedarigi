import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/auth'

export async function GET() {
  try {
    const session = await getAdminSession()
    if (!session) {
      return NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 401 })
    }

    const requests = await prisma.cancelRequest.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        order: {
          include: {
            class: {
              include: {
                school: { select: { name: true } }
              }
            }
          }
        }
      }
    })

    // Frontend icin map et
    const mappedRequests = requests.map(request => ({
      id: request.id,
      reason: request.reason,
      status: request.status,
      adminNote: request.adminNote,
      createdAt: request.createdAt.toISOString(),
      processedAt: request.processedAt?.toISOString() || null,
      order: {
        id: request.order.id,
        orderNumber: request.order.orderNumber,
        studentName: request.order.studentName,
        parentName: request.order.parentName,
        parentPhone: request.order.phone,
        totalAmount: Number(request.order.totalAmount),
        class: {
          name: request.order.class.name,
          school: { name: request.order.class.school.name }
        }
      }
    }))

    return NextResponse.json({ requests: mappedRequests })
  } catch (error) {
    console.error('Iptal talepleri listelenemedi:', error)
    return NextResponse.json(
      { error: 'Talepler yuklenemedi' },
      { status: 500 }
    )
  }
}
