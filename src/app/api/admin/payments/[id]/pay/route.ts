import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/auth'
import { logAction } from '@/lib/logger'
import { getApiLocale } from '@/lib/api-locale'
import { getTranslations } from 'next-intl/server'

// Odemeyi tamamla (PAID olarak isaretle)
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

    // Idempotency: zaten PAID ise tekrar update etme
    const existing = await prisma.schoolPayment.findUnique({
      where: { id },
      select: { id: true, status: true }
    })
    if (!existing) {
      return NextResponse.json({ error: t('adminMisc.paymentNotFound') }, { status: 404 })
    }
    if (existing.status === 'PAID') {
      return NextResponse.json({ error: t('adminMisc.alreadyPaid') }, { status: 400 })
    }

    // Atomic update with status guard
    const updateResult = await prisma.schoolPayment.updateMany({
      where: { id, status: 'PENDING' },
      data: {
        status: 'PAID',
        paidAt: new Date()
      }
    })

    if (updateResult.count === 0) {
      return NextResponse.json(
        { error: t('adminMisc.paymentBeingProcessed') },
        { status: 409 }
      )
    }

    const payment = await prisma.schoolPayment.findUnique({
      where: { id },
      include: {
        school: { select: { id: true, name: true } }
      }
    })

    if (!payment) {
      return NextResponse.json({ error: t('adminMisc.paymentNotFound') }, { status: 404 })
    }

    await logAction({
      userId: session.id,
      userType: 'ADMIN',
      action: 'UPDATE',
      entity: 'PAYMENT',
      entityId: payment.id,
      details: {
        schoolName: payment.school.name,
        amount: payment.amount,
        action: 'marked_as_paid'
      }
    })

    return NextResponse.json({ payment, success: true })
  } catch (error) {
    console.error('Odeme tamamlanamadi:', error)
    return NextResponse.json(
      { error: t('adminMisc.paymentCompleteFailed') },
      { status: 500 }
    )
  }
}

// SchoolPayment kaydini sil (iptal)
export async function DELETE(
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

    // Yalnizca onaylanmamis (PENDING) kayit silinebilir; PAID kayit izsiz silinirse
    // "Kalan" yeniden acilir ve cift odeme mumkun olur.
    const existing = await prisma.schoolPayment.findUnique({
      where: { id },
      select: { id: true, status: true, amount: true, school: { select: { name: true } } }
    })
    if (!existing) {
      return NextResponse.json({ error: t('adminMisc.paymentNotFound') }, { status: 404 })
    }
    if (existing.status !== 'PENDING') {
      return NextResponse.json({ error: t('adminMisc.alreadyPaid') }, { status: 400 })
    }
    const deleted = await prisma.schoolPayment.deleteMany({ where: { id, status: 'PENDING' } })
    if (deleted.count === 0) {
      return NextResponse.json({ error: t('adminMisc.paymentBeingProcessed') }, { status: 409 })
    }

    await logAction({
      userId: session.id,
      userType: 'ADMIN',
      action: 'DELETE',
      entity: 'PAYMENT',
      entityId: id,
      details: { schoolName: existing.school.name, amount: existing.amount }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Odeme silinemedi:', error)
    return NextResponse.json(
      { error: t('adminMisc.paymentDeleteFailed') },
      { status: 500 }
    )
  }
}
