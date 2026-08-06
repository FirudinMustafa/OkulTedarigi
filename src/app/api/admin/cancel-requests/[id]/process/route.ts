import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/auth'
import { logAction } from '@/lib/logger'
import { refundOrderPayment } from '@/lib/paynkolay'
import { sendCancellationConfirmation, sendCancellationRejected } from '@/lib/email'
import { CANCELLABLE_STATUSES } from '@/lib/constants'
import { getApiLocale } from '@/lib/api-locale'
import { getTranslations } from 'next-intl/server'

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
        // Odenmis siparis (PAID ve sonrasi) -> REFUNDED. Aksi halde -> CANCELLED.
        const wasPaid = cancelRequest.order.paidAt !== null
        const newStatus = wasPaid ? 'REFUNDED' : 'CANCELLED'
        const now = new Date()
        await tx.order.update({
          where: { id: cancelRequest.orderId },
          data: {
            status: newStatus,
            cancelledAt: now,
            ...(wasPaid ? { refundedAt: now } : {})
          }
        })
      }

      return { request: updatedRequest, order: cancelRequest.order, status: 200 as const }
    })

    if (result.status !== 200) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    let finalRequest = result.request

    // PayNKolay iade/iptal - DB transaction'in disinda (external call).
    // referenceCode = PayNKolay referansi (callback'te paymentId'ye yazilir, IKSIRPF...).
    // Ayni gun cekim ise "cancel" (iptal), sonraki gunler "refund" (iade).
    if (status === 'APPROVED' && result.order?.paymentId) {
      try {
        const refundResult = await refundOrderPayment(result.order)

        if (refundResult.success && refundResult.refundId) {
          const refundedAt = new Date()
          const [persistedRequest] = await prisma.$transaction([
            prisma.cancelRequest.update({
              where: { id },
              data: {
                refundId: refundResult.refundId,
                refundAmount: Number(result.order.totalAmount),
                refundedAt
              }
            }),
            prisma.order.update({
              where: { id: result.order.id },
              data: { refundedAt }
            })
          ])
          finalRequest = persistedRequest
        } else {
          // PayNKolay istegi atildi ama basarisiz sonuc dondu (exception firlatmadi) —
          // order zaten CANCELLED/REFUNDED isaretlendi, refundId hic yazilmadi. Admin
          // panelde "Iade Basarisiz" rozetiyle gorunur olmasi icin loglanir (invoiceMissing ile
          // ayni desen: derived-state, refundId null kaldigi surece rozet gozukur).
          console.error('[REFUND] PayNKolay basarisiz sonuc dondu:', refundResult)
          await logAction({
            userId: session.id,
            userType: 'ADMIN',
            action: 'REFUND_FAILED',
            entity: 'CANCEL_REQUEST',
            entityId: id,
            details: {
              orderNumber: result.order?.orderNumber,
              message: refundResult.message || 'PayNKolay basarisiz sonuc dondu'
            }
          })
        }
      } catch (refundErr) {
        console.error('Iade isleminde hata (siparis zaten CANCELLED):', refundErr)
        // Order zaten CANCELLED, refund manuel takip edilmeli — admin panelde rozetle gorunur olsun.
        await logAction({
          userId: session.id,
          userType: 'ADMIN',
          action: 'REFUND_FAILED',
          entity: 'CANCEL_REQUEST',
          entityId: id,
          details: {
            orderNumber: result.order?.orderNumber,
            message: String(refundErr)
          }
        })
      }
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

    // Veliye bildirim maili (best-effort)
    if (result.order?.email) {
      const orderEmail = result.order.email
      if (status === 'APPROVED') {
        sendCancellationConfirmation({
          email: orderEmail,
          orderNumber: result.order.orderNumber,
          parentName: result.order.parentName,
          refundAmount: result.order.paidAt ? Number(result.order.totalAmount) : undefined,
          locale: (result.order.locale ?? undefined) as ('tr'|'en'|'de'|'ar' | undefined)
        }).catch(err => console.error('[email] sendCancellationConfirmation hatasi:', err))
      } else if (status === 'REJECTED') {
        sendCancellationRejected({
          email: orderEmail,
          orderNumber: result.order.orderNumber,
          parentName: result.order.parentName,
          reason: adminNote?.trim() || 'Reddedilme nedeni belirtilmedi.',
          locale: (result.order.locale ?? undefined) as ('tr'|'en'|'de'|'ar' | undefined)
        }).catch(err => console.error('[email] sendCancellationRejected hatasi:', err))
      }
    }

    return NextResponse.json({ request: finalRequest })
  } catch (error) {
    console.error('Iptal talebi islenemedi:', error)
    return NextResponse.json(
      { error: t('adminMisc.processFailed') },
      { status: 500 }
    )
  }
}
