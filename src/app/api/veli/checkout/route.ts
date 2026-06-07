import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateOrderNumber } from '@/lib/order-number'
import { processPayment } from '@/lib/iyzico'
import { createInvoice } from '@/lib/kolaybi'
import { logAction } from '@/lib/logger'
import { isValidTCKimlik } from '@/lib/utils'
import { checkRateLimit, recordFailedAttempt, resetRateLimit } from '@/lib/rate-limit'
import { getClientIp, generateOrderAccessToken } from '@/lib/security'
import { veliCheckoutBodySchema, formatZodError } from '@/lib/validators'
import { sendOrderConfirmation } from '@/lib/email'

/**
 * Birlesik checkout: siparis + odeme TEK istekte.
 *
 * KRITIK: Siparis SADECE odeme basariyla alindiktan sonra DB'ye yazilir.
 * Odeme basarisizsa hicbir kayit olusmaz, indirim sayaci artmaz, mail gitmez.
 * Boylece odenmemis hicbir siparis admin panele dusmez.
 *
 * Akis: dogrula -> fiyat hesapla (SUNUCUDA) -> processPayment ->
 *   (basarili) order.create(PAID) + indirim usedCount++ (atomik) ->
 *   KolayBi'ye gonder (best-effort) -> TEK "siparisiniz alindi" maili.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)
    const parsed = veliCheckoutBodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: formatZodError(parsed.error) },
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
      cardNumber,
      cardHolder,
      expiry,
      cvv,
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
        { error: `Cok fazla deneme. ${waitMinutes} dakika sonra tekrar deneyin.` },
        { status: 429 }
      )
    }

    // Bireysel fatura icin TC kimlik no zorunlu
    if (!isCorporateInvoice) {
      if (!taxNumber || !isValidTCKimlik(String(taxNumber))) {
        await recordFailedAttempt(rlIdentifier)
        return NextResponse.json(
          { error: 'Gecerli bir TC Kimlik Numarasi giriniz' },
          { status: 400 }
        )
      }
    } else {
      if (!companyTitle || !taxNumber || !taxOffice) {
        await recordFailedAttempt(rlIdentifier)
        return NextResponse.json(
          { error: 'Kurumsal fatura icin Vergi No, Firma Unvani ve Vergi Dairesi zorunludur' },
          { status: 400 }
        )
      }
    }

    const classData = await prisma.class.findUnique({
      where: { id: classId },
      include: {
        school: true,
        package: { include: { items: true } }
      }
    })

    if (!classData || !classData.package) {
      await recordFailedAttempt(rlIdentifier)
      return NextResponse.json({ error: 'Sinif veya paket bulunamadi' }, { status: 404 })
    }
    if (!classData.isActive || !classData.school.isActive) {
      await recordFailedAttempt(rlIdentifier)
      return NextResponse.json({ error: 'Bu sinif veya okul aktif degil' }, { status: 403 })
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
        return NextResponse.json({ error: 'En az bir urun secmelisiniz' }, { status: 400 })
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
    let discountId: string | null = null

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
          discountId = discount.id
        }
      }
    }

    // === ODEME ONCE ALINIR — basarisizsa hicbir kayit olusmaz ===
    const orderNumberForPayment = await generateOrderNumber()
    const paymentResult = await processPayment({
      amount: finalAmount,
      currency: 'TRY',
      cardNumber,
      cardHolder,
      expiry,
      cvv,
      orderId: orderNumberForPayment,
      orderNumber: orderNumberForPayment,
      buyerName: parentName,
      buyerEmail: email || `${phone}@temp.com`,
      buyerPhone: phone,
    })

    if (!paymentResult.success) {
      await recordFailedAttempt(rlIdentifier)
      return NextResponse.json(
        { error: paymentResult.errorMessage || 'Odeme islemi basarisiz' },
        { status: 400 }
      )
    }

    const paymentId: string = paymentResult.paymentId || `PAY_${Date.now()}`
    const primaryStudentName = `${primaryStudent.firstName.trim()} ${primaryStudent.lastName.trim()}`.trim()

    // === Odeme alindi: siparisi PAID olarak olustur (indirim atomik) ===
    // orderNumber collision (~1/1.1T) icin tekrar dene; payment referansi ilk numara kalir (loglanir).
    let order: { id: string; orderNumber: string; totalAmount: unknown } | null = null
    let limitExceeded = false
    let orderNumber = orderNumberForPayment
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        order = await prisma.$transaction(async (tx) => {
          if (discountId) {
            const updated = await tx.$executeRaw`
              UPDATE discounts
              SET usedCount = usedCount + 1, updatedAt = NOW(3)
              WHERE id = ${discountId}
                AND isActive = true
                AND (usageLimit IS NULL OR usedCount < usageLimit)
            `
            if (updated === 0) limitExceeded = true
          }

          const effectiveTotal = limitExceeded ? baseTotal : finalAmount
          const effectiveDiscountCode = limitExceeded ? null : validDiscountCode
          const effectiveDiscountAmount = limitExceeded ? null : discountAmount

          return tx.order.create({
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
              totalAmount: effectiveTotal,
              discountCode: effectiveDiscountCode,
              discountAmount: effectiveDiscountAmount,
              status: 'PAID',
              paymentMethod: 'CREDIT_CARD',
              paymentId,
              paidAt: new Date(),
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
                create: orderItemsSnapshot.map(it => ({
                  name: it.name,
                  quantity: it.quantity,
                  price: it.price,
                }))
              }
            },
            select: { id: true, orderNumber: true, totalAmount: true }
          })
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
      // Odeme alindi ama siparis yazilamadi — KRITIK, manuel mudahale icin logla
      console.error('[checkout] Odeme alindi fakat siparis olusturulamadi:', { paymentId, orderNumberForPayment })
      return NextResponse.json(
        { error: 'Odeme alindi ancak siparis kaydedilemedi. Lutfen destek ile iletisime gecin.' },
        { status: 500 }
      )
    }

    await resetRateLimit(rlIdentifier)

    const effectiveAmount = Number(order.totalAmount)
    const accessToken = generateOrderAccessToken(order.id)

    await logAction({
      action: 'ORDER_CREATED',
      entity: 'ORDER',
      entityId: order.id,
      ipAddress: ip,
      details: {
        orderNumber: order.orderNumber,
        studentName: primaryStudentName,
        studentCount,
        paymentId,
        amount: effectiveAmount,
        discountApplied: !limitExceeded && !!validDiscountCode,
      }
    })

    // KolayBi'ye gonder — odeme alinir alinmaz (best-effort, hata order'i bozmaz).
    // Adetler ogrenci sayisiyla carpilir (toplam siparis adedi).
    try {
      const invoiceResult = await createInvoice({
        orderNumber: order.orderNumber,
        customerName: parentName,
        customerEmail: email || undefined,
        customerPhone: phone,
        customerAddress: invoiceAddress || address || classData.school.address || undefined,
        isCorporate: isCorporateInvoice || false,
        taxNumber: taxNumber || undefined,
        taxOffice: isCorporateInvoice ? (taxOffice || undefined) : undefined,
        city: city || undefined,
        district: district || undefined,
        items: orderItemsSnapshot.map(it => ({
          name: it.name,
          quantity: it.quantity * studentCount,
          unitPrice: it.price,
          totalPrice: Math.round(it.price * it.quantity * studentCount * 100) / 100,
        })),
        totalAmount: effectiveAmount,
      })
      if (invoiceResult.success && invoiceResult.invoiceNo) {
        await prisma.order.update({
          where: { id: order.id, },
          data: {
            invoiceNo: invoiceResult.invoiceNo,
            invoicePdfPath: invoiceResult.invoiceUrl,
            invoiceDate: new Date(),
            invoicedAt: new Date(),
          }
        })
        logAction({
          action: 'INVOICE_CREATED',
          entity: 'ORDER',
          entityId: order.id,
          ipAddress: ip,
          details: { orderNumber: order.orderNumber, invoiceNo: invoiceResult.invoiceNo, auto: true },
        }).catch(() => {})
      } else {
        console.error('[checkout] KolayBi gonderimi basarisiz:', invoiceResult.errorMessage)
      }
    } catch (err) {
      console.error('[checkout] KolayBi gonderim hatasi:', err)
    }

    // TEK mail: odeme sonrasi "siparisiniz alindi" (best-effort). SMS/admin/diger mail YOK.
    if (email) {
      sendOrderConfirmation({
        email,
        orderNumber: order.orderNumber,
        parentName,
        studentName: primaryStudentName,
        packageName: classData.package.name,
        totalAmount: effectiveAmount,
      }).catch(err => console.error('[email] sendOrderConfirmation hatasi:', err))
    }

    return NextResponse.json({
      success: true,
      orderNumber: order.orderNumber,
      orderId: order.id,
      accessToken,
      totalAmount: effectiveAmount,
    })

  } catch (error) {
    console.error('Checkout hatasi:', error)
    return NextResponse.json(
      { error: 'Siparis tamamlanamadi' },
      { status: 500 }
    )
  }
}
