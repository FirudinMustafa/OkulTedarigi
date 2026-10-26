import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/auth'
import { logAction } from '@/lib/logger'
import { getApiLocale } from '@/lib/api-locale'
import { getTranslations } from 'next-intl/server'

// Hatali/mukerrer hakedis kaydini iptal et. Kayit silinmez (iz kalir); CANCELLED
// kayitlar lib/commission hesabina girmez, boylece "Kalan" yeniden acilir.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const t = await getTranslations({ locale: await getApiLocale(), namespace: 'apiErrors' })
  try {
    const session = await getAdminSession()
    if (!session) {
      return NextResponse.json({ error: t('adminMisc.unauthorized') }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json().catch(() => null)
    const reason = typeof body?.reason === 'string' ? body.reason.trim() : ''
    if (reason.length < 3 || reason.length > 500) {
      return NextResponse.json({ error: t('adminMisc.cancelReasonRequired') }, { status: 400 })
    }

    const existing = await prisma.schoolPayment.findUnique({
      where: { id },
      select: { id: true, status: true, amount: true, school: { select: { name: true } } }
    })
    if (!existing) {
      return NextResponse.json({ error: t('adminMisc.paymentNotFound') }, { status: 404 })
    }
    if (existing.status === 'CANCELLED') {
      return NextResponse.json({ error: t('adminMisc.paymentAlreadyCancelled') }, { status: 400 })
    }

    // Atomic: ayni anda iki iptal / iptal+onay yarisinda yalniz biri gecer
    const updated = await prisma.schoolPayment.updateMany({
      where: { id, status: { in: ['PENDING', 'PAID'] } },
      data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: reason }
    })
    if (updated.count === 0) {
      return NextResponse.json({ error: t('adminMisc.paymentBeingProcessed') }, { status: 409 })
    }

    await logAction({
      userId: session.id,
      userType: 'ADMIN',
      action: 'UPDATE',
      entity: 'PAYMENT',
      entityId: id,
      details: {
        schoolName: existing.school.name,
        amount: existing.amount,
        previousStatus: existing.status,
        action: 'cancelled',
        reason
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Odeme iptal edilemedi:', error)
    return NextResponse.json({ error: t('adminMisc.paymentCancelFailed') }, { status: 500 })
  }
}
