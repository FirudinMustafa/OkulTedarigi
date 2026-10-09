import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/auth'
import { logAction } from '@/lib/logger'
import { getSchoolPayoutSummary, round2, toKurus } from '@/lib/commission'
import { formatPrice } from '@/lib/utils'
import { getApiLocale } from '@/lib/api-locale'
import { getTranslations } from 'next-intl/server'

export async function GET() {
  const t = await getTranslations({ locale: await getApiLocale(), namespace: 'apiErrors' })
  try {
    const session = await getAdminSession()
    if (!session) {
      return NextResponse.json({ error: t('adminMisc.unauthorized') }, { status: 401 })
    }

    const payments = await prisma.schoolPayment.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        school: { select: { id: true, name: true } }
      }
    })

    // Frontend icin map et
    const mappedPayments = payments.map(payment => ({
      id: payment.id,
      school: payment.school,
      amount: payment.amount,
      period: payment.period || new Date(payment.createdAt).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' }),
      status: payment.status,
      paidAt: payment.paidAt?.toISOString() || null,
      createdAt: payment.createdAt.toISOString()
    }))

    return NextResponse.json({ payments: mappedPayments })
  } catch (error) {
    console.error('Odemeler listelenemedi:', error)
    return NextResponse.json(
      { error: t('adminMisc.paymentsLoadFailed') },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const t = await getTranslations({ locale: await getApiLocale(), namespace: 'apiErrors' })
  try {
    const session = await getAdminSession()
    if (!session) {
      return NextResponse.json({ error: t('adminMisc.unauthorized') }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: t('adminMisc.invalidRequest') }, { status: 400 })
    }
    const { schoolId, amount, description } = body

    // Validation
    if (!schoolId || typeof schoolId !== 'string') {
      return NextResponse.json({ error: t('adminMisc.schoolRequired') }, { status: 400 })
    }
    const numericAmount = Number(amount)
    if (!isFinite(numericAmount) || numericAmount <= 0 || numericAmount > 10_000_000) {
      return NextResponse.json(
        { error: t('adminMisc.amountOutOfRange') },
        { status: 400 }
      )
    }
    if (description != null && (typeof description !== 'string' || description.length > 500)) {
      return NextResponse.json({ error: t('adminMisc.descriptionTooLong') }, { status: 400 })
    }

    const amountKurus = toKurus(numericAmount)
    const now = new Date()
    const period = now.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric', timeZone: 'Europe/Istanbul' })

    // Over-commitment guard + kayit TEK transaction icinde, okul satiri kilitli:
    // iki sekme/iki admin ayni anda "Tamami" derse ikincisi birincinin kaydini gorur.
    type Result =
      | { kind: 'notFound' }
      | { kind: 'exceeds'; total: number; committed: number; remaining: number }
      | { kind: 'ok'; payment: { id: string; school: { id: string; name: string } } }
    const result: Result = await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM schools WHERE id = ${schoolId} FOR UPDATE`
      if (locked.length === 0) return { kind: 'notFound' }

      const summary = await getSchoolPayoutSummary(schoolId, tx)
      if (!summary) return { kind: 'notFound' }

      // amount + (mevcut PAID + PENDING) <= toplam hakedis (kurus bazinda)
      const committed = round2(summary.paid + summary.pendingPayments)
      if (amountKurus > toKurus(summary.commission) - toKurus(committed)) {
        return { kind: 'exceeds', total: summary.commission, committed, remaining: summary.remaining }
      }

      const payment = await tx.schoolPayment.create({
        data: {
          schoolId,
          amount: amountKurus / 100,
          description: description?.trim() || null,
          period,
          // Tek adim: admin "Odeme Yap" dediginde odeme yapilmis sayilir
          status: 'PAID',
          paymentDate: now,
          paidAt: now
        },
        select: { id: true, school: { select: { id: true, name: true } } }
      })
      return { kind: 'ok', payment }
    })

    if (result.kind === 'notFound') {
      return NextResponse.json({ error: t('adminMisc.schoolNotFound') }, { status: 404 })
    }
    if (result.kind === 'exceeds') {
      return NextResponse.json(
        {
          error: t('adminMisc.amountExceedsCommission', {
            total: formatPrice(result.total, 'tr'),
            committed: formatPrice(result.committed, 'tr'),
            remaining: formatPrice(result.remaining, 'tr')
          })
        },
        { status: 400 }
      )
    }
    const payment = result.payment

    await logAction({
      userId: session.id,
      userType: 'ADMIN',
      action: 'CREATE',
      entity: 'PAYMENT',
      entityId: payment.id,
      details: {
        schoolName: payment.school.name,
        amount,
        action: 'created_as_paid'
      }
    })

    return NextResponse.json({ payment })
  } catch (error) {
    console.error('Odeme olusturulamadi:', error)
    return NextResponse.json(
      { error: t('adminMisc.paymentCreateFailed') },
      { status: 500 }
    )
  }
}
