import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/auth'
import { logAction } from '@/lib/logger'
import { NO_HTML_REGEX } from '@/lib/validators'
import { buildTranslationData } from '@/lib/i18n-content'
import { getApiLocale } from '@/lib/api-locale'
import { getTranslations } from 'next-intl/server'

export async function GET() {
  const t = await getTranslations({ locale: await getApiLocale(), namespace: 'apiErrors' })
  try {
    const session = await getAdminSession()
    if (!session) {
      return NextResponse.json({ error: t('catalog.unauthorized') }, { status: 401 })
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
      name_en: pkg.name_en,
      name_de: pkg.name_de,
      name_ar: pkg.name_ar,
      description: pkg.description,
      description_en: pkg.description_en,
      description_de: pkg.description_de,
      description_ar: pkg.description_ar,
      note: pkg.note,
      note_en: pkg.note_en,
      note_de: pkg.note_de,
      note_ar: pkg.note_ar,
      basePrice: Number(pkg.price),
      isActive: pkg.isActive,
      isCustomizable: pkg.isCustomizable,
      items: pkg.items.map(item => ({
        id: item.id,
        name: item.name,
        name_en: item.name_en,
        name_de: item.name_de,
        name_ar: item.name_ar,
        quantity: item.quantity,
        unitPrice: Number(item.price)
      })),
      _count: pkg._count
    }))

    return NextResponse.json({ packages: mappedPackages })
  } catch (error) {
    console.error('Paketler listelenemedi:', error)
    return NextResponse.json(
      { error: t('catalog.packagesLoadFailed') },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const t = await getTranslations({ locale: await getApiLocale(), namespace: 'apiErrors' })
  try {
    const session = await getAdminSession()
    if (!session) {
      return NextResponse.json({ error: t('catalog.unauthorized') }, { status: 401 })
    }

    const body = await request.json()
    const { name, description, basePrice, price, isCustomizable, items } = body

    // basePrice veya price kabul et (frontend uyumlulugu)
    const finalPrice = basePrice !== undefined ? basePrice : price

    if (!name || typeof name !== 'string' || !name.trim() || finalPrice === undefined) {
      return NextResponse.json(
        { error: t('catalog.packageNameAndPriceRequired') },
        { status: 400 }
      )
    }
    if (name.length > 200) {
      return NextResponse.json({ error: t('catalog.packageNameMax200') }, { status: 400 })
    }
    if (!NO_HTML_REGEX.test(name)) {
      return NextResponse.json({ error: t('catalog.packageNameNoHtml') }, { status: 400 })
    }
    if (typeof description === 'string' && !NO_HTML_REGEX.test(description)) {
      return NextResponse.json({ error: t('catalog.descriptionNoHtml') }, { status: 400 })
    }
    if (typeof body.note === 'string' && !NO_HTML_REGEX.test(body.note)) {
      return NextResponse.json({ error: t('catalog.noteNoHtml') }, { status: 400 })
    }

    const numericPrice = Number(finalPrice)
    if (!isFinite(numericPrice) || numericPrice < 0) {
      return NextResponse.json(
        { error: t('catalog.priceNegative') },
        { status: 400 }
      )
    }
    if (numericPrice > 1_000_000) {
      return NextResponse.json(
        { error: t('catalog.priceTooHigh') },
        { status: 400 }
      )
    }

    // Minimum 1 urun kontrolu
    const validItems = items?.filter((item: { name: string }) => item.name?.trim()) || []
    if (validItems.length === 0) {
      return NextResponse.json(
        { error: t('catalog.packageNeedsItem') },
        { status: 400 }
      )
    }
    if (validItems.length > 100) {
      return NextResponse.json({ error: t('catalog.packageMax100Items') }, { status: 400 })
    }

    // Item adlari HTML icermemeli
    for (const item of validItems) {
      if (typeof item.name === 'string' && !NO_HTML_REGEX.test(item.name)) {
        return NextResponse.json({ error: t('catalog.itemNameNoHtml', { name: item.name }) }, { status: 400 })
      }
    }

    // Item fiyatlari negatif olamaz
    for (const item of validItems) {
      const itemPrice = Number(item.unitPrice ?? item.price ?? 0)
      if (!isFinite(itemPrice) || itemPrice < 0) {
        return NextResponse.json(
          { error: t('catalog.itemPriceNegative', { name: item.name }) },
          { status: 400 }
        )
      }
      const itemQty = Number(item.quantity ?? 1)
      if (!Number.isInteger(itemQty) || itemQty < 1 || itemQty > 1000) {
        return NextResponse.json(
          { error: t('catalog.itemQtyRange', { name: item.name }) },
          { status: 400 }
        )
      }
    }

    const pkg = await prisma.package.create({
      data: {
        name,
        description: description || null,
        note: body.note || null,
        ...buildTranslationData('name', { en: body.name_en, de: body.name_de, ar: body.name_ar }),
        ...buildTranslationData('description', { en: body.description_en, de: body.description_de, ar: body.description_ar }),
        ...buildTranslationData('note', { en: body.note_en, de: body.note_de, ar: body.note_ar }),
        price: finalPrice,
        isCustomizable: Boolean(isCustomizable),
        items: {
          create: items?.map((item: { name: string; quantity: number; unitPrice?: number; price?: number; name_en?: string; name_de?: string; name_ar?: string }) => ({
            name: item.name,
            ...buildTranslationData('name', { en: item.name_en, de: item.name_de, ar: item.name_ar }),
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
      { error: t('catalog.packageCreateFailed') },
      { status: 500 }
    )
  }
}
