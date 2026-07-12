import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateOrderNumber } from '@/lib/order-number'
import { buildHostedPaymentForm } from '@/lib/paynkolay'
import { isValidTCKimlik } from '@/lib/utils'
import { checkRateLimit, recordFailedAttempt, resetRateLimit } from '@/lib/rate-limit'
import { getClientIp, generateOrderAccessToken } from '@/lib/security'
import { veliOrderBodySchema, formatZodError } from '@/lib/validators'
import { getApiLocale } from '@/lib/api-locale'
import { getTranslations } from 'next-intl/server'

export const runtime = 'nodejs'

/**
 * PayNKolay "Ortak Odeme Sayfasi (Form Gondererek)" — ODEME BASLATMA (initiate).
 *
 * Akis: dogrula -> fiyat hesapla (SUNUCUDA) -> siparisi PAYMENT_PENDING olarak yaz ->
 *   hosted form alanlarini + hashDataV2 uret -> {actionUrl, fields} dondur.
 *   Tarayici bu form'u PayNKolay'a POST eder; kart + taksit Nkolay sayfasinda alinir.
 *   Sonuc /api/payment/paynkolay/callback adresine POST edilir (orada PAID'e cevrilir).
 *
 * KART bu endpoint'e GELMEZ — PCI yuku Nkolay'da. Indirim sayaci ve fatura/mail callback'te.
 */
export async function POST(request: Request) {
  const t = await getTranslations({ locale: await getApiLocale(), namespace: 'apiErrors' })
  try {
    const body = await request.json().catch(() => null)
    const reqLocale: 'tr' | 'en' | 'de' | 'ar' =
      ['tr', 'en', 'de', 'ar'].includes(body?.locale) ? body.locale : 'tr'
    const parsed = veliOrderBodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: formatZodError(parsed.error, await getApiLocale()) },
        { status: 400 }
      )
    }
    const {
      classId,
      parentName,
      students,
      phone,
      email,
      address,
      deliveryAddress,
      invoiceAddress,
      invoiceAddressSame,
      isCorporateInvoice,
      companyTitle,
      taxNumber,
      taxOffice,
      orderNote,
      discountCode,
      selectedItemIds,
      city,
      district,
    } = parsed.data

    const primaryStudent = students[0]
    const studentCount = students.length

    // IP basina rate limit (10 deneme / 10 dakika)
    const ip = getClientIp(request)
    const rlIdentifier = `veli-checkout:${ip}`
    const rateLimitResult = await checkRateLimit(rlIdentifier, 10, 10)
    if (!rateLimitResult.allowed) {
      const waitMinutes = rateLimitResult.blockedUntil
        ? Math.ceil((rateLimitResult.blockedUntil.getTime() - Date.now()) / 60000)
        : 10
      return NextResponse.json(
        { error: t('veli.tooManyAttempts', { minutes: waitMinutes }) },
        { status: 429 }
      )
    }

    // Bireysel fatura icin TC kimlik no zorunlu
    if (!isCorporateInvoice) {
      if (!taxNumber || !isValidTCKimlik(String(taxNumber))) {
        await recordFailedAttempt(rlIdentifier)
        return NextResponse.json({ error: t('veli.invalidTcKimlik') }, { status: 400 })
      }
    } else {
      if (!companyTitle || !taxNumber || !taxOffice) {
        await recordFailedAttempt(rlIdentifier)
        return NextResponse.json({ error: t('veli.corporateInvoiceRequired') }, { status: 400 })
      }
    }

    const classData = await prisma.class.findUnique({
      where: { id: classId },
      include: { school: true, package: { include: { items: true } } }
    })

    if (!classData || !classData.package) {
      await recordFailedAttempt(rlIdentifier)
      return NextResponse.json({ error: t('veli.classOrPackageNotFound') }, { status: 404 })
    }
    if (!classData.isActive || !classData.school.isActive) {
      await recordFailedAttempt(rlIdentifier)
      return NextResponse.json({ error: t('veli.classOrSchoolInactive') }, { status: 403 })
    }

    // Fiyat hesabi (SUNUCUDA dogrulanir; client'tan gelen tutara guvenilmez)
    let unitPrice: number
    let orderItemsSnapshot: { name: string; quantity: number; price: number }[] = []
    if (classData.package.isCustomizable) {
      const allItems = classData.package.items
      const requestedIds = Array.isArray(selectedItemIds) && selectedItemIds.length > 0
        ? selectedItemIds
        : allItems.map(it => it.id)
      const chosen = allItems.filter(it => requestedIds.includes(it.id))
      if (chosen.length === 0) {
        await recordFailedAttempt(rlIdentifier)
        return NextResponse.json({ error: t('veli.selectAtLeastOneItem') }, { status: 400 })
      }
      unitPrice = chosen.reduce((sum, it) => sum + Number(it.price) * it.quantity, 0)
      orderItemsSnapshot = chosen.map(it => ({ name: it.name, quantity: it.quantity, price: Number(it.price) }))
    } else {
      unitPrice = Number(classData.package.price)
      orderItemsSnapshot = classData.package.items.map(it => ({ name: it.name, quantity: it.quantity, price: Number(it.price) }))
    }

    const baseTotal = Math.round(unitPrice * studentCount * 100) / 100
    let finalAmount = baseTotal
    let discountAmount: number | null = null
    let validDiscountCode: string | null = null

    // Indirim SADECE fiyati belirlemek icin uygulanir; usedCount artisi callback'te (odeme onayinda).
    if (discountCode) {
      const normalizedCode = String(discountCode).toUpperCase().trim()
      const discount = await prisma.discount.findUnique({ where: { code: normalizedCode } })
      if (discount && discount.isActive) {
        const now = new Date()
        const limitOk = !discount.usageLimit || discount.usedCount < discount.usageLimit
        const minOk = !discount.minAmount || finalAmount >= Number(discount.minAmount)
        if (now >= discount.validFrom && now <= discount.validUntil && limitOk && minOk) {
          if (discount.type === 'PERCENTAGE') {
            discountAmount = finalAmount * Number(discount.value) / 100
            if (discount.maxDiscount && discountAmount > Number(discount.maxDiscount)) {
              discountAmount = Number(discount.maxDiscount)
            }
          } else {
            discountAmount = Number(discount.value)
          }
          if (discountAmount > finalAmount) discountAmount = finalAmount
          discountAmount = Math.round(discountAmount * 100) / 100
          finalAmount = Math.round((finalAmount - discountAmount) * 100) / 100
          validDiscountCode = discount.code
        }
      }
    }

    if (finalAmount <= 0) {
      await recordFailedAttempt(rlIdentifier)
      return NextResponse.json({ error: t('veli.checkoutFailed') }, { status: 400 })
    }

    const primaryStudentName = `${primaryStudent.firstName.trim()} ${primaryStudent.lastName.trim()}`.trim()

    // Siparisi PAYMENT_PENDING olarak olustur (odeme oncesi). orderNumber = clientRefCode.
    // Odenmemis PENDING siparisler admin'de gizlidir (UNPAID_STATUSES).
    let order: { id: string; orderNumber: string } | null = null
    let orderNumber = await generateOrderNumber()
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        order = await prisma.order.create({
          data: {
            orderNumber,
            parentName: parentName.trim(),
            studentName: primaryStudentName,
            studentSection: primaryStudent.section || null,
            phone,
            email: email || null,
            address: address || null,
            deliveryAddress: deliveryAddress || null,
            invoiceAddress: invoiceAddress || null,
            invoiceAddressSame: invoiceAddressSame ?? true,
            city: city || null,
            district: district || null,
            orderNote: orderNote || null,
            totalAmount: finalAmount,
            discountCode: validDiscountCode,
            discountAmount: discountAmount,
            status: 'PAYMENT_PENDING',
            paymentMethod: 'CREDIT_CARD',
            locale: reqLocale,
            isCorporateInvoice: isCorporateInvoice || false,
            companyTitle: isCorporateInvoice ? (companyTitle || null) : null,
            taxNumber: taxNumber || null,
            taxOffice: isCorporateInvoice ? (taxOffice || null) : null,
            classId,
            packageId: classData.package!.id,
            students: {
              create: students.map(s => ({
                firstName: s.firstName.trim(),
                lastName: s.lastName.trim(),
                section: s.section || null,
              }))
            },
            items: {
              create: orderItemsSnapshot.map(it => ({ name: it.name, quantity: it.quantity, price: it.price }))
            }
          },
          select: { id: true, orderNumber: true }
        })
        break
      } catch (err) {
        const code = (err as { code?: string })?.code
        if (code === 'P2002' && attempt < 4) {
          orderNumber = await generateOrderNumber()
          continue
        }
        throw err
      }
    }

    if (!order) {
      return NextResponse.json({ error: t('veli.orderSaveFailed') }, { status: 500 })
    }

    await resetRateLimit(rlIdentifier)

    // PayNKolay hosted form alanlari (kartsiz) + hashDataV2.
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '')
    const callbackUrl = `${appUrl}/api/payment/paynkolay/callback`
    const { actionUrl, fields } = buildHostedPaymentForm({
      clientRefCode: order.orderNumber,
      amount: finalAmount,
      successUrl: callbackUrl,
      failUrl: callbackUrl,
      cardHolderIP: ip,
      locale: reqLocale,
    })

    return NextResponse.json({
      success: true,
      orderNumber: order.orderNumber,
      orderId: order.id,
      accessToken: generateOrderAccessToken(order.id),
      actionUrl,
      fields,
    })
  } catch (error) {
    console.error('Checkout (initiate) hatasi:', error)
    return NextResponse.json({ error: t('veli.checkoutFailed') }, { status: 500 })
  }
}
