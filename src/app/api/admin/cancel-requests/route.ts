import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/auth'
import { getApiLocale } from '@/lib/api-locale'
import { getTranslations } from 'next-intl/server'

export async function GET() {
  const t = await getTranslations({ locale: await getApiLocale(), namespace: 'apiErrors' })
  try {
    const session = await getAdminSession()
    if (!session) {
      return NextResponse.json({ error: t('adminMisc.unauthorized') }, { status: 401 })
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
      refundId: request.refundId,
      order: {
        id: request.order.id,
        orderNumber: request.order.orderNumber,
        studentName: request.order.studentName,
        parentName: request.order.parentName,
        parentPhone: request.order.phone,
        totalAmount: Number(request.order.totalAmount),
        paidAt: request.order.paidAt?.toISOString() || null,
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
      { error: t('adminMisc.cancelRequestsLoadFailed') },
      { status: 500 }
    )
  }
}
