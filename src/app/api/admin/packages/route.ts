import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/auth'
import { logAction } from '@/lib/logger'

export async function GET() {
  try {
    const session = await getAdminSession()
    if (!session) {
      return NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 401 })
    }

    const packages = await prisma.package.findMany({
      orderBy: { name: 'asc' },
      include: {
        items: true,
        _count: { select: { classes: true } }
      }
    })

    // Frontend icin map et
    const mappedPackages = packages.map(pkg => ({
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
      _count: pkg._count
    }))

    return NextResponse.json({ packages: mappedPackages })
  } catch (error) {
    console.error('Paketler listelenemedi:', error)
    return NextResponse.json(
      { error: 'Paketler yuklenemedi' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const session = await getAdminSession()
    if (!session) {
      return NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 401 })
    }

    const body = await request.json()
    const { name, description, basePrice, price, items } = body

    // basePrice veya price kabul et (frontend uyumlulugu)
    const finalPrice = basePrice !== undefined ? basePrice : price

    if (!name || typeof name !== 'string' || !name.trim() || finalPrice === undefined) {
      return NextResponse.json(
        { error: 'Paket adi ve fiyat gerekli' },
        { status: 400 }
      )
    }
    if (name.length > 200) {
      return NextResponse.json({ error: 'Paket adi max 200 karakter olabilir' }, { status: 400 })
    }

    const numericPrice = Number(finalPrice)
    if (!isFinite(numericPrice) || numericPrice < 0) {
      return NextResponse.json(
        { error: 'Fiyat negatif olamaz' },
        { status: 400 }
      )
    }
    if (numericPrice > 1_000_000) {
      return NextResponse.json(
        { error: 'Fiyat cok yuksek' },
        { status: 400 }
      )
    }

    // Minimum 1 urun kontrolu
    const validItems = items?.filter((item: { name: string }) => item.name?.trim()) || []
    if (validItems.length === 0) {
      return NextResponse.json(
        { error: 'Pakette en az bir urun olmalidir' },
        { status: 400 }
      )
    }
    if (validItems.length > 100) {
      return NextResponse.json({ error: 'Bir pakette en fazla 100 urun olabilir' }, { status: 400 })
    }

    // Item fiyatlari negatif olamaz
    for (const item of validItems) {
      const itemPrice = Number(item.unitPrice ?? item.price ?? 0)
      if (!isFinite(itemPrice) || itemPrice < 0) {
        return NextResponse.json(
          { error: `Urun fiyati negatif olamaz (${item.name})` },
          { status: 400 }
        )
      }
      const itemQty = Number(item.quantity ?? 1)
      if (!Number.isInteger(itemQty) || itemQty < 1 || itemQty > 1000) {
        return NextResponse.json(
          { error: `Urun adedi 1 ile 1000 arasinda olmalidir (${item.name})` },
          { status: 400 }
        )
      }
    }

    const pkg = await prisma.package.create({
      data: {
        name,
        description: description || null,
        note: body.note || null,
        price: finalPrice,
        items: {
          create: items?.map((item: { name: string; quantity: number; unitPrice?: number; price?: number }) => ({
            name: item.name,
            quantity: item.quantity || 1,
            price: item.unitPrice !== undefined ? item.unitPrice : (item.price || 0)
          })) || []
        }
      },
      include: { items: true }
    })

    await logAction({
      userId: session.id,
      userType: 'ADMIN',
      action: 'CREATE',
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
    console.error('Paket olusturulamadi:', error)
    return NextResponse.json(
      { error: 'Paket olusturulamadi' },
      { status: 500 }
    )
  }
}
