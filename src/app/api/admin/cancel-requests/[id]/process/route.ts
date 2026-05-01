import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/auth'
import { logAction } from '@/lib/logger'
import { processRefund } from '@/lib/iyzico'
import { CANCELLABLE_STATUSES } from '@/lib/constants'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession()
    if (!session) {
      return NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Gecersiz istek' }, { status: 400 })
    }

    const { status, adminNote } = body
    if (!status || !['APPROVED', 'REJECTED'].includes(status)) {
      return NextResponse.json({ error: 'Gecersiz durum' }, { status: 400 })
    }
    if (adminNote != null && (typeof adminNote !== 'string' || adminNote.length > 2000)) {
      return NextResponse.json({ error: 'Admin notu max 2000 karakter olabilir' }, { status: 400 })
    }
    // Reddetmede neden zorunlu — veli niye reddedildigini bilsin (en az 5 karakter).
    if (status === 'REJECTED') {
      const trimmedNote = typeof adminNote === 'string' ? adminNote.trim() : ''
      if (trimmedNote.length < 5) {
        return NextResponse.json(
          { error: 'Iptal talebini reddederken neden belirtilmesi zorunludur (en az 5 karakter)' },
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
        return { error: 'Iptal talebi bulunamadi', status: 404 as const }
      }

      // Atomic status check: sadece PENDING -> APPROVED/REJECTED
      if (cancelRequest.status !== 'PENDING') {
        return { error: `Bu talep zaten ${cancelRequest.status} durumunda`, status: 400 as const }
      }

      // APPROVED durumunda siparis iptal edilebilir mi?
      if (status === 'APPROVED' && !CANCELLABLE_STATUSES.includes(cancelRequest.order.status)) {
        return {
          error: `Bu siparis artik iptal edilemez (mevcut durum: ${cancelRequest.order.status})`,
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
        return { error: 'Bu talep su anda baska bir admin tarafindan isleniyor', status: 409 as const }
      }

      const updatedRequest = await tx.cancelRequest.findUnique({ where: { id } })

      if (status === 'APPROVED') {
        await tx.order.update({
          where: { id: cancelRequest.orderId },
          data: {
            status: 'CANCELLED',
            cancelledAt: new Date()
          }
        })
      }

      return { request: updatedRequest, order: cancelRequest.order, status: 200 as const }
    })

    if (result.status !== 200) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    let finalRequest = result.request

    // Mock iade islemi - DB transaction'in disinda (external call)
    if (status === 'APPROVED' && result.order?.paymentId) {
      try {
        const refundResult = await processRefund({
          paymentId: result.order.paymentId,
          amount: Number(result.order.totalAmount)
        })

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
        }
      } catch (refundErr) {
        console.error('Iade isleminde hata (siparis zaten CANCELLED):', refundErr)
        // Order zaten CANCELLED, refund manuel takip edilmeli
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

    return NextResponse.json({ request: finalRequest })
  } catch (error) {
    console.error('Iptal talebi islenemedi:', error)
    return NextResponse.json(
      { error: 'Islem yapilamadi' },
      { status: 500 }
    )
  }
}
