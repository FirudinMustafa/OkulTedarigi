import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/auth'
import { logAction } from '@/lib/logger'
import { refundCancelledOrder } from '@/lib/refund'
import { sendCancellationRejected } from '@/lib/email'
import { CANCELLABLE_STATUSES } from '@/lib/constants'
import type { OrderStatus } from '@prisma/client'
import { getApiLocale } from '@/lib/api-locale'
import { getTranslations } from 'next-intl/server'

class OrderChangedError extends Error {}

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
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: t('adminMisc.invalidRequest') }, { status: 400 })
    }

    const { status, adminNote } = body
    if (!status || !['APPROVED', 'REJECTED'].includes(status)) {
      return NextResponse.json({ error: t('adminMisc.invalidStatus') }, { status: 400 })
    }
    if (adminNote != null && (typeof adminNote !== 'string' || adminNote.length > 2000)) {
      return NextResponse.json({ error: t('adminMisc.adminNoteTooLong') }, { status: 400 })
    }
    // Reddetmede neden zorunlu — veli niye reddedildigini bilsin (en az 5 karakter).
    if (status === 'REJECTED') {
      const trimmedNote = typeof adminNote === 'string' ? adminNote.trim() : ''
      if (trimmedNote.length < 5) {
        return NextResponse.json(
          { error: t('adminMisc.rejectReasonRequired') },
          { status: 400 }
        )
      }
    }

    // Race condition korumasi: status check + update'i tek transaction'da
    // Eger zaten processed ise (PENDING degil) baska transaction tarafindan
    // tamamlanmis demektir, idempotent olarak NOT-FOUND donelim.
    const result = await prisma.$transaction(async (tx) => {
      const cancelRequest = await tx.cancelRequest.findUnique({
        where: { id },
        include: { order: true }
      })

      if (!cancelRequest) {
        return { error: t('adminMisc.cancelRequestNotFound'), status: 404 as const }
      }

      // Atomic status check: sadece PENDING -> APPROVED/REJECTED
      if (cancelRequest.status !== 'PENDING') {
        return { error: t('adminMisc.requestAlreadyProcessed', { status: cancelRequest.status }), status: 400 as const }
      }

      // APPROVED durumunda siparis iptal edilebilir mi?
      if (status === 'APPROVED' && !CANCELLABLE_STATUSES.includes(cancelRequest.order.status)) {
        return {
          error: t('adminMisc.orderNotCancellable', { status: cancelRequest.order.status }),
          status: 400 as const
        }
      }

      // Atomic update: WHERE status='PENDING' kosulu ile race condition'i engelle
      const updateResult = await tx.cancelRequest.updateMany({
        where: { id, status: 'PENDING' },
        data: {
          status,
          adminNote: adminNote?.trim() || null,
          processedAt: new Date(),
          processedBy: session.id
        }
      })

      if (updateResult.count === 0) {
        // Bir baska transaction ayni anda process etti
        return { error: t('adminMisc.requestBeingProcessed'), status: 409 as const }
      }

      const updatedRequest = await tx.cancelRequest.findUnique({ where: { id } })

      if (status === 'APPROVED') {
        // Siparis once CANCELLED olur; REFUNDED'a ancak PayNKolay iadesi basarili olunca
        // gecer (asagida). Status guard: bu arada kargolanan/degisen siparis iptal edilmez.
        const cancelled = await tx.order.updateMany({
          where: { id: cancelRequest.orderId, status: { in: CANCELLABLE_STATUSES as OrderStatus[] } },
          data: { status: 'CANCELLED', cancelledAt: new Date() }
        })
        if (cancelled.count === 0) {
          throw new OrderChangedError()
        }
      }

      return { request: updatedRequest, order: cancelRequest.order, status: 200 as const }
    })

    if (result.status !== 200) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    let finalRequest = result.request
    let refundFailed: string | null = null

    // PayNKolay iadesi — DB transaction'in disinda (external call). Basariliysa siparis
    // REFUNDED olur, iptal talebine refundId yazilir ve veliye mail gider (lib/refund).
    // Basarisizsa siparis CANCELLED kalir; admin Siparisler > "Iade Et" ile tekrar dener.
    if (status === 'APPROVED') {
      try {
        const outcome = await refundCancelledOrder(result.order!.id, session.id)
        if (!outcome.ok) {
          refundFailed = outcome.reason === 'gatewayFailed' ? outcome.message : outcome.reason
        }
      } catch (refundErr) {
        refundFailed = String(refundErr)
      }
      if (refundFailed) {
        console.error('[REFUND] Iptal onaylandi ama iade basarisiz:', refundFailed)
        await logAction({
          userId: session.id,
          userType: 'ADMIN',
          action: 'REFUND_FAILED',
          entity: 'CANCEL_REQUEST',
          entityId: id,
          details: { orderNumber: result.order?.orderNumber, message: refundFailed }
        })
      }
      finalRequest = await prisma.cancelRequest.findUnique({ where: { id } })
    }

    await logAction({
      userId: session.id,
      userType: 'ADMIN',
      action: status === 'APPROVED' ? 'APPROVE' : 'REJECT',
      entity: 'CANCEL_REQUEST',
      entityId: id,
      details: {
        orderNumber: result.order?.orderNumber,
        status,
        adminNote: adminNote?.trim() || null
      }
    })

    // Veliye bildirim maili (best-effort). Onay maili lib/refund icinde, iade BASARILI
    // olunca gider (iade basarisizken "X TL iade edilecek" sozu verilmez).
    if (result.order?.email) {
      const orderEmail = result.order.email
      if (status === 'REJECTED') {
        sendCancellationRejected({
          email: orderEmail,
          orderNumber: result.order.orderNumber,
          parentName: result.order.parentName,
          reason: adminNote?.trim() || 'Reddedilme nedeni belirtilmedi.',
          locale: (result.order.locale ?? undefined) as ('tr'|'en'|'de'|'ar' | undefined)
        }).catch(err => console.error('[email] sendCancellationRejected hatasi:', err))
      }
    }

    return NextResponse.json({ request: finalRequest, refundFailed })
  } catch (error) {
    if (error instanceof OrderChangedError) {
      return NextResponse.json({ error: t('adminMisc.orderChangedRetry') }, { status: 409 })
    }
    console.error('Iptal talebi islenemedi:', error)
    return NextResponse.json(
      { error: t('adminMisc.processFailed') },
      { status: 500 }
    )
  }
}
