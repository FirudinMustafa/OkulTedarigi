import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/auth'
import { logAction } from '@/lib/logger'
import { generateDeliveryDocumentNumber } from '@/lib/order-number'

export async function GET() {
  try {
    const session = await getAdminSession()
    if (!session) {
      return NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 401 })
    }

    const documents = await prisma.deliveryDocument.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        orders: {
          select: {
            id: true,
            orderNumber: true,
            studentName: true,
            parentName: true,
            status: true,
            totalAmount: true,
            class: {
              select: {
                name: true,
                school: { select: { name: true } }
              }
            }
          }
        }
      }
    })

    return NextResponse.json({ documents })
  } catch (error) {
    console.error('Teslim tutanaklari yuklenemedi:', error)
    return NextResponse.json({ error: 'Veri yuklenemedi' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await getAdminSession()
    if (!session) {
      return NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Gecersiz istek' }, { status: 400 })
    }

    const { schoolId, classId, orderIds, receivedBy, deliveryDate, notes } = body

    // Input validation
    if (!Array.isArray(orderIds) || orderIds.length === 0 || orderIds.length > 500) {
      return NextResponse.json(
        { error: 'Siparis ID listesi gerekli (max 500)' },
        { status: 400 }
      )
    }
    if (!orderIds.every(id => typeof id === 'string' && id.length > 0 && id.length <= 40)) {
      return NextResponse.json({ error: 'Gecersiz siparis ID' }, { status: 400 })
    }
    if (!receivedBy || typeof receivedBy !== 'string' || receivedBy.trim().length < 2 || receivedBy.length > 100) {
      return NextResponse.json({ error: 'Teslim alan kisi adi 2-100 karakter olmali' }, { status: 400 })
    }
    if (!deliveryDate || isNaN(new Date(deliveryDate).getTime())) {
      return NextResponse.json({ error: 'Gecerli teslim tarihi gerekli' }, { status: 400 })
    }
    if (notes != null && (typeof notes !== 'string' || notes.length > 2000)) {
      return NextResponse.json({ error: 'Not max 2000 karakter olabilir' }, { status: 400 })
    }
    if (schoolId != null && typeof schoolId !== 'string') {
      return NextResponse.json({ error: 'Gecersiz okul ID' }, { status: 400 })
    }
    if (classId != null && typeof classId !== 'string') {
      return NextResponse.json({ error: 'Gecersiz sinif ID' }, { status: 400 })
    }

    // Siparisleri getir + yetki/durum kontrolu
    const orders = await prisma.order.findMany({
      where: { id: { in: orderIds } },
      select: {
        id: true,
        orderNumber: true,
        studentName: true,
        parentName: true,
        totalAmount: true,
        classId: true,
        status: true,
        deliveryDocumentId: true,
        class: {
          select: {
            name: true,
            schoolId: true,
            school: { select: { name: true, deliveryType: true } }
          }
        }
      }
    })

    // Tum orderId'lerin DB'de var olduğunu doğrula
    if (orders.length !== orderIds.length) {
      return NextResponse.json(
        { error: 'Bazi siparisler bulunamadi' },
        { status: 404 }
      )
    }

    // schoolId verildiyse, tum orderlar ayni okuldan olmali
    if (schoolId) {
      const wrongSchool = orders.filter(o => o.class.schoolId !== schoolId)
      if (wrongSchool.length > 0) {
        return NextResponse.json(
          { error: 'Tum siparisler ayni okuldan olmali' },
          { status: 400 }
        )
      }
    }

    // classId verildiyse, tum orderlar ayni siniftan olmali
    if (classId) {
      const wrongClass = orders.filter(o => o.classId !== classId)
      if (wrongClass.length > 0) {
        return NextResponse.json(
          { error: 'Tum siparisler ayni siniftan olmali' },
          { status: 400 }
        )
      }
    }

    // Sadece SCHOOL_DELIVERY tipindeki okullar icin teslim tutanagi
    const wrongDeliveryType = orders.filter(o => o.class.school.deliveryType !== 'SCHOOL_DELIVERY')
    if (wrongDeliveryType.length > 0) {
      return NextResponse.json(
        { error: 'Teslim tutanagi sadece okula teslim siparisleri icin olusturulabilir' },
        { status: 400 }
      )
    }

    // Sadece teslim edilebilir durumlardakiler
    const validStatuses = ['CONFIRMED', 'INVOICED', 'PREPARING']
    const invalidStatus = orders.filter(o => !validStatuses.includes(o.status))
    if (invalidStatus.length > 0) {
      const numbers = invalidStatus.map(o => o.orderNumber).join(', ')
      return NextResponse.json(
        { error: `Bu siparisler teslim edilebilir durumda degil: ${numbers}` },
        { status: 400 }
      )
    }

    // Onceden teslim edilmis siparisler
    const alreadyDelivered = orders.filter(o => o.deliveryDocumentId !== null)
    if (alreadyDelivered.length > 0) {
      const names = alreadyDelivered.map(o => o.studentName).join(', ')
      return NextResponse.json(
        { error: `Bu ogrencilere daha once teslim yapilmis: ${names}` },
        { status: 400 }
      )
    }

    // Belge numarasi olustur — yil + sequential, race condition'a dayanikli
    const docNo = await generateDeliveryDocumentNumber()

    // PDF: Vercel'de filesystem read-only oldugu icin DB'de olusturma anini belirt;
    // PDF gerekirse on-demand olarak ayri bir endpoint'te uretilebilir (delivery-pdf.ts)
    // Bu degisiklik: PDF dosyasini diske yazmiyoruz. URL bos, frontend on-demand cagirir.
    const pdfPath: string | null = null

    // Transaction: belge olustur + siparisleri DELIVERED'a cek
    const document = await prisma.$transaction(async (tx) => {
      const doc = await tx.deliveryDocument.create({
        data: {
          documentNo: docNo,
          deliveryDate: new Date(deliveryDate),
          receivedBy: receivedBy.trim(),
          totalPackages: orderIds.length,
          schoolId: schoolId || null,
          classId: classId || null,
          notes: notes?.trim() || null,
          pdfPath,
          orders: {
            connect: orderIds.map((id: string) => ({ id }))
          }
        }
      })

      // Siparisleri DELIVERED + tarih
      await tx.order.updateMany({
        where: { id: { in: orderIds } },
        data: {
          status: 'DELIVERED',
          deliveredAt: new Date(deliveryDate),
          deliveredBy: receivedBy.trim()
        }
      })

      return doc
    })

    await logAction({
      userId: session.id,
      userType: 'ADMIN',
      action: 'CREATE',
      entity: 'DELIVERY_DOCUMENT',
      entityId: document.id,
      details: { documentNo: docNo, orderCount: orderIds.length, receivedBy: receivedBy.trim() }
    })

    return NextResponse.json({ success: true, document })
  } catch (error) {
    console.error('Teslim tutanagi olusturulamadi:', error)
    return NextResponse.json({ error: 'Teslim tutanagi olusturulamadi' }, { status: 500 })
  }
}
