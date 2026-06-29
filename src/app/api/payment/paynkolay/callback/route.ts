import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { evaluateCallback } from '@/lib/paynkolay'
import { createInvoice } from '@/lib/kolaybi'
import { sendOrderConfirmation } from '@/lib/email'
import { logAction } from '@/lib/logger'
import { getLocalized } from '@/lib/i18n-content'
import { getClientIp } from '@/lib/security'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '')

function redirectTo(path: string): NextResponse {
  // 303 => tarayici POST'tan sonra GET ile yonlenir.
  return NextResponse.redirect(`${APP_URL}${path}`, 303)
}

/**
 * PayNKolay Ortak Odeme Sayfasi geri donus (successUrl + failUrl ayni adres).
 * Nkolay/banka sonucu buraya form-data POST eder. Burada:
 *   - sonuc dogrulanir (response hash + responseCode)
 *   - siparis PAYMENT_PENDING -> PAID (atomik, idempotent)
 *   - indirim usedCount (best-effort), KolayBi fatura (best-effort), onay e-postasi (best-effort)
 *   - veli onay/hata sayfasina yonlendirilir
 */
export async function POST(request: Request) {
  let body: Record<string, string> = {}
  try {
    const form = await request.formData()
    for (const [k, v] of form.entries()) body[k] = typeof v === 'string' ? v : ''
  } catch {
    // form-data degilse query/json denenebilir; basitlik icin bos birak.
  }

  const verdict = evaluateCallback(body)
  const refCode = verdict.clientRefCode

  if (!refCode) {
    // Tum govdeyi loglama; sadece guvenli/tani alanlari.
    console.error('[paynkolay/callback] clientRefCode yok', { responseCode: body.RESPONSE_CODE, message: body.RESPONSE_DATA })
    return redirectTo('/tr/odeme?reason=failed')
  }

  const order = await prisma.order.findUnique({
    where: { orderNumber: refCode },
    include: {
      class: { include: { package: true, school: true } },
      items: true,
      students: true,
    },
  })

  if (!order) {
    console.error('[paynkolay/callback] Siparis bulunamadi:', refCode)
    return redirectTo('/tr/odeme?reason=failed')
  }

  const locale = (order.locale as 'tr' | 'en' | 'de' | 'ar') || 'tr'
  const ip = getClientIp(request)

  // Basarisiz / dogrulanamayan => siparis PENDING kalir, indirim artmaz.
  if (!verdict.success) {
    return redirectTo(`/${locale}/odeme?reason=failed`)
  }

  // Tutar tutarliligi (taksitte vade farki ile AUTHORIZATION_AMOUNT >= principal olabilir).
  // Eksik tahsilati reddet (taksitte vade farki ile USTUNE cikabilir; ALTINA inemez). Epsilon yalniz float toleransi.
  if (verdict.authorizationAmount != null && verdict.authorizationAmount + 0.001 < Number(order.totalAmount)) {
    console.error('[paynkolay/callback] Tutar uyusmazligi:', { refCode, beklenen: Number(order.totalAmount), gelen: verdict.authorizationAmount })
    return redirectTo(`/${locale}/odeme?reason=failed`)
  }

  // Idempotent claim: yalnizca PAYMENT_PENDING ise PAID'e cevir.
  const claim = await prisma.order.updateMany({
    where: { id: order.id, status: 'PAYMENT_PENDING' },
    data: {
      status: 'PAID',
      paidAt: new Date(),
      paymentId: verdict.paynkolayReference || `PNK_${Date.now()}`,
    },
  })

  if (claim.count === 0) {
    // Zaten islenmis (cift callback) — dogrudan onay sayfasina.
    return redirectTo(`/${locale}/siparis-onay/${order.orderNumber}`)
  }

  const studentCount = order.students.length
  const effectiveAmount = Number(order.totalAmount)

  // Indirim usedCount (best-effort, guarded). Odeme alindigi icin limit asilsa bile honor edilir.
  if (order.discountCode) {
    try {
      await prisma.$executeRaw`
        UPDATE discounts
        SET usedCount = usedCount + 1, updatedAt = NOW(3)
        WHERE code = ${order.discountCode} AND isActive = true
      `
    } catch (err) {
      console.error('[paynkolay/callback] indirim usedCount artirilamadi:', err)
    }
  }

  await logAction({
    action: 'PAYMENT_RECEIVED',
    entity: 'ORDER',
    entityId: order.id,
    ipAddress: ip,
    details: {
      orderNumber: order.orderNumber,
      paymentId: verdict.paynkolayReference,
      amount: effectiveAmount,
      installment: verdict.installment,
    },
  }).catch(() => {})

  // KolayBi fatura (best-effort). Adetler ogrenci sayisiyla carpilir.
  try {
    const invoiceResult = await createInvoice({
      orderNumber: order.orderNumber,
      customerName: order.parentName,
      customerEmail: order.email || undefined,
      customerPhone: order.phone,
      customerAddress: order.invoiceAddress || order.address || order.class.school.address || undefined,
      isCorporate: order.isCorporateInvoice || false,
      taxNumber: order.taxNumber || undefined,
      taxOffice: order.isCorporateInvoice ? (order.taxOffice || undefined) : undefined,
      city: order.city || undefined,
      district: order.district || undefined,
      items: order.items.map(it => ({
        name: it.name,
        quantity: it.quantity * studentCount,
        unitPrice: Number(it.price),
        totalPrice: Math.round(Number(it.price) * it.quantity * studentCount * 100) / 100,
      })),
      totalAmount: effectiveAmount,
    })
    if (invoiceResult.success && invoiceResult.invoiceNo) {
      await prisma.order.update({
        where: { id: order.id },
        data: {
          invoiceNo: invoiceResult.invoiceNo,
          invoicePdfPath: invoiceResult.invoiceUrl,
          invoiceDate: new Date(),
          invoicedAt: new Date(),
        },
      })
      logAction({
        action: 'INVOICE_CREATED',
        entity: 'ORDER',
        entityId: order.id,
        ipAddress: ip,
        details: { orderNumber: order.orderNumber, invoiceNo: invoiceResult.invoiceNo, auto: true },
      }).catch(() => {})
    } else {
      console.error('[paynkolay/callback] KolayBi gonderimi basarisiz:', invoiceResult.errorMessage)
    }
  } catch (err) {
    console.error('[paynkolay/callback] KolayBi gonderim hatasi:', err)
  }

  // Onay e-postasi (best-effort).
  if (order.email && order.class.package) {
    sendOrderConfirmation({
      email: order.email,
      orderNumber: order.orderNumber,
      parentName: order.parentName,
      studentName: order.studentName,
      packageName: getLocalized(order.class.package, 'name', locale),
      totalAmount: effectiveAmount,
      isSchoolDelivery: order.class.school.deliveryType === 'SCHOOL_DELIVERY',
      locale,
    }).catch(err => console.error('[email] sendOrderConfirmation hatasi:', err))
  }

  return redirectTo(`/${locale}/siparis-onay/${order.orderNumber}`)
}

// Bazi POS akislari GET ile de donebilir; guvenli tarafta onay/hata yonlendir.
export async function GET(request: Request) {
  const url = new URL(request.url)
  const ref = url.searchParams.get('clientRefCode')
  if (ref) {
    const order = await prisma.order.findUnique({ where: { orderNumber: ref }, select: { orderNumber: true, status: true, locale: true } })
    if (order) {
      const locale = order.locale || 'tr'
      if (order.status === 'PAID' || order.status === 'CONFIRMED') {
        return redirectTo(`/${locale}/siparis-onay/${order.orderNumber}`)
      }
      return redirectTo(`/${locale}/odeme?reason=failed`)
    }
  }
  return redirectTo('/tr/odeme?reason=failed')
}
