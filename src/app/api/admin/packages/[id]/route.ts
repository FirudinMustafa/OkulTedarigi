import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/auth'
import { logAction } from '@/lib/logger'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession()
    if (!session) {
      return NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 401 })
    }

    const { id } = await params

    const pkg = await prisma.package.findUnique({
      where: { id },
      include: {
        items: true,
        classes: {
          include: {
            school: { select: { name: true } }
          }
        }
      }
    })

    if (!pkg) {
      return NextResponse.json({ error: 'Paket bulunamadi' }, { status: 404 })
    }

    // Frontend icin map et
    const mappedPackage = {
      id: pkg.id,
      name: pkg.name,
      description: pkg.description,
      note: pkg.note,
      basePrice: Number(pkg.price),
      isActive: pkg.isActive,
      items: pkg.items.map(item => ({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        unitPrice: Number(item.price)
      })),
      classes: pkg.classes
    }

    return NextResponse.json({ package: mappedPackage })
  } catch (error) {
    console.error('Paket getirilemedi:', error)
    return NextResponse.json(
      { error: 'Paket yuklenemedi' },
      { status: 500 }
    )
  }
}

export async function PUT(
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
    const { items, basePrice, ...otherData } = body

    // Izin verilen alanlari filtrele
    const allowedFields = ['name', 'description', 'note', 'isActive']
    const packageData: Record<string, unknown> = {}

    for (const key of Object.keys(otherData)) {
      if (allowedFields.includes(key)) {
        packageData[key] = otherData[key]
      }
    }

    // Validation
    if (typeof packageData.name === 'string' && (!packageData.name.trim() || packageData.name.length > 200)) {
      return NextResponse.json({ error: 'Paket adi 1-200 karakter olmali' }, { status: 400 })
    }

    // basePrice varsa price olarak kaydet
    if (basePrice !== undefined) {
      const numericPrice = Number(basePrice)
      if (!isFinite(numericPrice) || numericPrice < 0 || numericPrice > 1_000_000) {
        return NextResponse.json({ error: 'Fiyat 0 ile 1.000.000 arasinda olmali' }, { status: 400 })
      }
      packageData.price = numericPrice
    }

    // Items validation
    if (items) {
      if (!Array.isArray(items)) {
        return NextResponse.json({ error: 'Items array olmali' }, { status: 400 })
      }
      if (items.length > 100) {
        return NextResponse.json({ error: 'Bir pakette en fazla 100 urun olabilir' }, { status: 400 })
      }
      for (const item of items) {
        if (!item.name || typeof item.name !== 'string' || !item.name.trim() || item.name.length > 200) {
          return NextResponse.json({ error: 'Urun adi 1-200 karakter olmali' }, { status: 400 })
        }
        const itemPrice = Number(item.unitPrice ?? item.price ?? 0)
        if (!isFinite(itemPrice) || itemPrice < 0 || itemPrice > 1_000_000) {
          return NextResponse.json({ error: `Urun fiyati gecersiz (${item.name})` }, { status: 400 })
        }
        const itemQty = Number(item.quantity ?? 1)
        if (!Number.isInteger(itemQty) || itemQty < 1 || itemQty > 1000) {
          return NextResponse.json({ error: `Urun adedi 1-1000 olmali (${item.name})` }, { status: 400 })
        }
      }

      await prisma.packageItem.deleteMany({
        where: { packageId: id }
      })

      await prisma.packageItem.createMany({
        data: items.map((item: { name: string; quantity: number; unitPrice?: number; price?: number }) => ({
          packageId: id,
          name: item.name.trim(),
          quantity: item.quantity || 1,
          price: item.unitPrice !== undefined ? item.unitPrice : (item.price || 0)
        }))
      })
    }

    const pkg = await prisma.package.update({
      where: { id },
      data: packageData,
      include: { items: true }
    })

    await logAction({
      userId: session.id,
      userType: 'ADMIN',
      action: 'UPDATE',
      entity: 'PACKAGE',
      entityId: pkg.id,
      details: { name: pkg.name }
    })

    // Frontend icin map et
    const mappedPkg = {
      ...pkg,
      basePrice: Number(pkg.price),
      items: pkg.items.map(item => ({
        ...item,
        unitPrice: Number(item.price)
      }))
    }

    return NextResponse.json({ package: mappedPkg })
  } catch (error) {
    console.error('Paket guncellenemedi:', error)
    return NextResponse.json(
      { error: 'Paket guncellenemedi' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession()
    if (!session) {
      return NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 401 })
    }

    const { id } = await params

    // Paket bilgisini al
    const pkg = await prisma.package.findUnique({
      where: { id }
    })

    if (!pkg) {
      return NextResponse.json({ error: 'Paket bulunamadi' }, { status: 404 })
    }

    // Aktif siparis kontrolu
    const activeOrders = await prisma.order.count({
      where: {
        packageId: id,
        status: { notIn: ['COMPLETED', 'CANCELLED', 'REFUNDED'] }
      }
    })

    if (activeOrders > 0) {
      return NextResponse.json(
        { error: `Bu pakete ait ${activeOrders} aktif siparis bulunuyor. Silmeden once siparislerin tamamlanmasi veya iptal edilmesi gerekiyor.` },
        { status: 400 }
      )
    }

    // Bagli verileri sirayla sil
    // 1. Bu pakete ait siparis iptal taleplerini sil
    await prisma.cancelRequest.deleteMany({
      where: { order: { packageId: id } }
    })

    // 2. Bu pakete ait siparisleri sil (sadece tamamlanmis/iptal/iade)
    await prisma.order.deleteMany({
      where: { packageId: id }
    })

    // 3. Siniflardaki paket atamasini kaldir
    await prisma.class.updateMany({
      where: { packageId: id },
      data: { packageId: null }
    })

    // 4. Paket itemlarini sil
    await prisma.packageItem.deleteMany({
      where: { packageId: id }
    })

    // 5. Paketi sil
    await prisma.package.delete({
      where: { id }
    })

    await logAction({
      userId: session.id,
      userType: 'ADMIN',
      action: 'DELETE',
      entity: 'PACKAGE',
      entityId: id,
      details: { name: pkg.name }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Paket silinemedi:', error)
    return NextResponse.json(
      { error: 'Paket silinemedi' },
      { status: 500 }
    )
  }
}
