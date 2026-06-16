import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/auth'
import { logAction } from '@/lib/logger'
import { COMMISSION_STATUSES } from '@/lib/constants'
import type { OrderStatus } from '@prisma/client'
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

    // Okulu komisyon hesabı için ihtiyaç duyulan ilişkilerle çek
    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      include: {
        classes: {
          include: {
            orders: {
              where: {
                status: {
                  in: COMMISSION_STATUSES as OrderStatus[]
                }
              },
              select: { id: true }
            }
          }
        },
        schoolPayments: { select: { amount: true, status: true } }
      }
    })
    if (!school) {
      return NextResponse.json({ error: t('adminMisc.schoolNotFound') }, { status: 404 })
    }

    // Server-side over-commitment guard:
    // amount + (mevcut PAID + PENDING) <= toplam komisyon olmalı.
    let totalCommission = 0
    for (const c of school.classes) {
      totalCommission += Number(c.commissionAmount) * c.orders.length
    }
    const alreadyCommitted = school.schoolPayments.reduce(
      (acc, p) => acc + Number(p.amount), 0
    )
    const remaining = totalCommission - alreadyCommitted
    if (numericAmount > remaining + 0.001) {
      return NextResponse.json(
        {
          error: t('adminMisc.amountExceedsCommission', {
            total: totalCommission.toFixed(2),
            committed: alreadyCommitted.toFixed(2),
            remaining: remaining.toFixed(2)
          })
        },
        { status: 400 }
      )
    }

    const now = new Date()
    const period = now.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })

    const payment = await prisma.schoolPayment.create({
      data: {
        schoolId,
        amount: numericAmount,
        description: description?.trim() || null,
        period,
        status: 'PENDING',
        paymentDate: now
      },
      include: {
        school: { select: { id: true, name: true } }
      }
    })

    await logAction({
      userId: session.id,
      userType: 'ADMIN',
      action: 'CREATE',
      entity: 'PAYMENT',
      entityId: payment.id,
      details: {
        schoolName: payment.school.name,
        amount
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
