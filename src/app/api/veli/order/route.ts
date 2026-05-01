import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withOrderNumberRetry } from '@/lib/order-number'
import { initializePayment } from '@/lib/iyzico'
import { logAction } from '@/lib/logger'
import { isValidTCKimlik } from '@/lib/utils'
import { checkRateLimit, recordFailedAttempt, resetRateLimit } from '@/lib/rate-limit'
import { getClientIp, generateOrderAccessToken } from '@/lib/security'
import { veliOrderBodySchema, formatZodError } from '@/lib/validators'

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)
    const parsed = veliOrderBodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: formatZodError(parsed.error) },
        { status: 400 }
      )
    }
    const {
      classId,
      parentName,
      studentName,
      studentSection,
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
      discountCode
    } = parsed.data

    // IP basina rate limit (10 siparis denemesi / 10 dakika)
    const ip = getClientIp(request)
    const rlIdentifier = `veli-order:${ip}`
    const rateLimitResult = await checkRateLimit(rlIdentifier, 10, 10)
    if (!rateLimitResult.allowed) {
      const waitMinutes = rateLimitResult.blockedUntil
        ? Math.ceil((rateLimitResult.blockedUntil.getTime() - Date.now()) / 60000)
        : 10
      return NextResponse.json(
        { error: `Cok fazla siparis denemesi. ${waitMinutes} dakika sonra tekrar deneyin.` },
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
        package: {
          include: { items: true }
        }
      }
    })

    if (!classData || !classData.package) {
      await recordFailedAttempt(rlIdentifier)
      return NextResponse.json(
        { error: 'Sinif veya paket bulunamadi' },
        { status: 404 }
      )
    }

    if (!classData.isActive || !classData.school.isActive) {
      await recordFailedAttempt(rlIdentifier)
      return NextResponse.json(
        { error: 'Bu sinif veya okul aktif degil' },
        { status: 403 }
      )
    }

    // Ayni TC ile tekrar siparis kontrolu (TC daha güvenilir bir tekillik anahtarı)
    const existingOrder = await prisma.order.findFirst({
      where: {
        classId,
        taxNumber: String(taxNumber),
        status: {
          notIn: ['CANCELLED']
        }
      }
    })

    if (existingOrder) {
      return NextResponse.json(
        {
          error: 'Bu ogrenci icin zaten bir siparis mevcut',
          orderNumber: existingOrder.orderNumber
        },
        { status: 409 }
      )
    }

    let finalAmount = Number(classData.package.price)
    let discountAmount: number | null = null
    let validDiscountCode: string | null = null
    let discountId: string | null = null
    let discountWarning: string | null = null

    if (discountCode) {
      const normalizedCode = String(discountCode).toUpperCase().trim()
      const discount = await prisma.discount.findUnique({
        where: { code: normalizedCode }
      })

      if (!discount) {
        discountWarning = 'Indirim kodu bulunamadi'
      } else if (!discount.isActive) {
        discountWarning = 'Bu indirim kodu artik aktif degil'
      } else {
        const now = new Date()
        if (now < discount.validFrom) {
          discountWarning = 'Bu indirim kodu henuz baslamadi'
        } else if (now > discount.validUntil) {
          discountWarning = 'Bu indirim kodunun suresi dolmus'
        } else if (discount.usageLimit && discount.usedCount >= discount.usageLimit) {
          discountWarning = 'Bu indirim kodunun kullanim limiti dolmus'
        } else if (discount.minAmount && finalAmount < Number(discount.minAmount)) {
          discountWarning = `Bu indirim kodu icin minimum siparis tutari ${Number(discount.minAmount)} TL olmalidir`
        } else {
          if (discount.type === 'PERCENTAGE') {
            discountAmount = finalAmount * Number(discount.value) / 100
            if (discount.maxDiscount && discountAmount > Number(discount.maxDiscount)) {
              discountAmount = Number(discount.maxDiscount)
            }
          } else {
            discountAmount = Number(discount.value)
          }

          if (discountAmount > finalAmount) {
            discountAmount = finalAmount
          }

          discountAmount = Math.round(discountAmount * 100) / 100
          finalAmount = Math.round((finalAmount - discountAmount) * 100) / 100
          validDiscountCode = discount.code
          discountId = discount.id
        }
      }
    }

    // Atomik: indirim limit kontrolu + kullanim sayisi + siparis olustur.
    // Concurrent siparislerde usageLimit asilmasin diye DB-level atomic conditional UPDATE kullanilir.
    // updated=0 ise: limit dolmus, indirim uygulanmaz, siparis indirimsiz devam eder.
    let limitExceeded = false
    const order = await withOrderNumberRetry((orderNumber) =>
      prisma.$transaction(async (tx) => {
        if (discountId) {
          // Raw SQL: column-to-column comparison (usageLimit > usedCount) Prisma where ile mumkun degil.
          // executeRaw atomic INCREMENT yapar; affected row sayisi 1 ise basarili, 0 ise limit asildi.
          const updated = await tx.$executeRaw`
            UPDATE discounts
            SET usedCount = usedCount + 1, updatedAt = NOW(3)
            WHERE id = ${discountId}
              AND isActive = true
              AND (usageLimit IS NULL OR usedCount < usageLimit)
          `
          if (updated === 0) {
            // Limit dolmus / indirim deaktive edilmis; siparis indirimsiz devam eder.
            limitExceeded = true
          }
        }

        // Limit asildiysa indirimi geri al (orijinal paket fiyatina don)
        const effectiveTotal = limitExceeded ? Number(classData.package!.price) : finalAmount
        const effectiveDiscountCode = limitExceeded ? null : validDiscountCode
        const effectiveDiscountAmount = limitExceeded ? null : discountAmount

        return tx.order.create({
          data: {
            orderNumber,
            parentName: parentName.trim(),
            studentName: studentName.trim(),
            studentSection: studentSection || null,
            phone,
            email: email || null,
            address: address || null,
            deliveryAddress: deliveryAddress || null,
            invoiceAddress: invoiceAddress || null,
            invoiceAddressSame: invoiceAddressSame ?? true,
            orderNote: orderNote || null,
            totalAmount: effectiveTotal,
            discountCode: effectiveDiscountCode,
            discountAmount: effectiveDiscountAmount,
            status: 'PAYMENT_PENDING',
            paymentMethod: 'CREDIT_CARD',
            isCorporateInvoice: isCorporateInvoice || false,
            companyTitle: isCorporateInvoice ? (companyTitle || null) : null,
            taxNumber: taxNumber || null,
            taxOffice: isCorporateInvoice ? (taxOffice || null) : null,
            classId,
            packageId: classData.package!.id
          }
        })
      })
    )

    const orderNumber = order.orderNumber

    // Limit asildiysa effective total kullan (DB'ye yazilan deger)
    const effectiveAmount = Number(order.totalAmount)
    if (limitExceeded) {
      discountWarning = 'Bu indirim kodunun kullanim limiti dolmus, siparis indirimsiz olarak olusturuldu'
    }

    // Başarılı sipariş — meşru kullanıcının rate-limit sayacı sıfırlansın
    await resetRateLimit(rlIdentifier)

    await logAction({
      action: 'ORDER_CREATED',
      entity: 'ORDER',
      entityId: order.id,
      ipAddress: ip,
      details: {
        orderNumber,
        studentName,
        paymentMethod: 'CREDIT_CARD',
        amount: effectiveAmount
      }
    })

    const paymentResult = await initializePayment({
      orderNumber,
      amount: effectiveAmount,
      buyerName: parentName,
      buyerEmail: email || `${phone}@temp.com`,
      buyerPhone: phone,
      buyerAddress: address,
      items: classData.package.items.map(item => ({
        name: item.name,
        price: Number(item.price),
        quantity: item.quantity
      }))
    })

    if (!paymentResult.success) {
      return NextResponse.json(
        { error: 'Odeme baslatilamadi' },
        { status: 500 }
      )
    }

    await prisma.order.update({
      where: { id: order.id },
      data: { paymentUrl: paymentResult.paymentUrl }
    })

    // Defense-in-depth: order'a erişim için HMAC-imzalı access token ver.
    // Frontend bu token'ı sonraki isteklerde (cancel-request, payment) yollar.
    const accessToken = generateOrderAccessToken(order.id)

    return NextResponse.json({
      success: true,
      orderNumber,
      orderId: order.id,
      accessToken,
      totalAmount: finalAmount,
      paymentUrl: paymentResult.paymentUrl,
      discountWarning
    })

  } catch (error) {
    console.error('Siparis olusturma hatasi:', error)
    return NextResponse.json(
      { error: 'Siparis olusturulamadi' },
      { status: 500 }
    )
  }
}

// Siparis sorgulama (GET)
// Guvenlik notu: orderNumber cryptographic random (32^8 ~= 1.1T) + IP rate-limit ile brute-force engellenir.
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const orderNumber = searchParams.get('orderNumber')
    const orderId = searchParams.get('id')

    if (!orderNumber && !orderId) {
      return NextResponse.json(
        { error: 'Siparis numarasi gerekli' },
        { status: 400 }
      )
    }

    // IP başına 30 sorgu / 5 dk — orderNumber brute-force koruması
    const ip = getClientIp(request)
    const rlIdentifier = `veli-order-get:${ip}`
    const rateLimitResult = await checkRateLimit(rlIdentifier, 30, 5)
    if (!rateLimitResult.allowed) {
      const waitMinutes = rateLimitResult.blockedUntil
        ? Math.ceil((rateLimitResult.blockedUntil.getTime() - Date.now()) / 60000)
        : 5
      return NextResponse.json(
        { error: `Cok fazla deneme. ${waitMinutes} dakika sonra tekrar deneyin.` },
        { status: 429 }
      )
    }

    const order = await prisma.order.findUnique({
      where: orderNumber ? { orderNumber } : { id: orderId! },
      include: {
        class: {
          include: {
            school: {
              select: {
                name: true,
                deliveryType: true,
                isActive: true
              }
            }
          }
        },
        package: {
          select: {
            name: true,
            price: true
          }
        },
        cancelRequest: {
          select: {
            id: true,
            status: true,
            adminNote: true,
            processedAt: true,
            reason: true
          }
        }
      }
    })

    if (!order) {
      // Yanlış sorgu — sayaç artsın (brute-force tespit)
      await recordFailedAttempt(rlIdentifier)
      return NextResponse.json(
        { error: 'Siparis bulunamadi' },
        { status: 404 }
      )
    }

    // Başarılı sorgu — meşru kullanıcı cezalandırılmasın
    await resetRateLimit(rlIdentifier)

    // Order GET response'unda da accessToken ver (frontend takip sayfasinda kullanir)
    const accessToken = generateOrderAccessToken(order.id)

    return NextResponse.json({
      id: order.id,
      orderNumber: order.orderNumber,
      accessToken,
      status: order.status,
      parentName: order.parentName,
      studentName: order.studentName,
      totalAmount: order.totalAmount,
      paymentMethod: order.paymentMethod,
      schoolName: order.class.school.name,
      schoolActive: order.class.school.isActive,
      className: order.class.name,
      packageName: order.package?.name || 'N/A',
      deliveryType: order.class.school.deliveryType,
      trackingNo: order.trackingNo,
      invoiceNo: order.invoiceNo,
      invoicedAt: order.invoicedAt,
      discountCode: order.discountCode,
      discountAmount: order.discountAmount ? Number(order.discountAmount) : null,
      createdAt: order.createdAt,
      paidAt: order.paidAt,
      shippedAt: order.shippedAt,
      deliveredAt: order.deliveredAt,
      cancelRequest: order.cancelRequest ? {
        status: order.cancelRequest.status,
        adminNote: order.cancelRequest.adminNote,
        processedAt: order.cancelRequest.processedAt,
        reason: order.cancelRequest.reason
      } : null
    })

  } catch (error) {
    console.error('Siparis sorgulama hatasi:', error)
    return NextResponse.json(
      { error: 'Bir hata olustu' },
      { status: 500 }
    )
  }
}
