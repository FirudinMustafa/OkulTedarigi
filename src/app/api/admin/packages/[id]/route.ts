import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/auth'
import { logAction } from '@/lib/logger'
import { NO_HTML_REGEX } from '@/lib/validators'
import { buildTranslationData } from '@/lib/i18n-content'
import { getApiLocale } from '@/lib/api-locale'
import { getTranslations } from 'next-intl/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const t = await getTranslations({ locale: await getApiLocale(), namespace: 'apiErrors' })
  try {
    const session = await getAdminSession()
    if (!session) {
      return NextResponse.json({ error: t('catalog.unauthorized') }, { status: 401 })
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
      return NextResponse.json({ error: t('catalog.packageNotFound') }, { status: 404 })
    }

    // Frontend icin map et
    const mappedPackage = {
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
      classes: pkg.classes
    }

    return NextResponse.json({ package: mappedPackage })
  } catch (error) {
    console.error('Paket getirilemedi:', error)
    return NextResponse.json(
      { error: t('catalog.packageLoadFailed') },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const t = await getTranslations({ locale: await getApiLocale(), namespace: 'apiErrors' })
  try {
    const session = await getAdminSession()
    if (!session) {
      return NextResponse.json({ error: t('catalog.unauthorized') }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: t('catalog.invalidRequest') }, { status: 400 })
    }
    const { items, basePrice, isCustomizable, ...otherData } = body

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
      return NextResponse.json({ error: t('catalog.packageNameLength') }, { status: 400 })
    }
    if (typeof packageData.name === 'string' && !NO_HTML_REGEX.test(packageData.name)) {
      return NextResponse.json({ error: t('catalog.packageNameNoHtml') }, { status: 400 })
    }
    if (typeof packageData.description === 'string' && !NO_HTML_REGEX.test(packageData.description)) {
      return NextResponse.json({ error: t('catalog.descriptionNoHtml') }, { status: 400 })
    }
    if (typeof packageData.note === 'string' && !NO_HTML_REGEX.test(packageData.note)) {
      return NextResponse.json({ error: t('catalog.noteNoHtml') }, { status: 400 })
    }

    // basePrice varsa price olarak kaydet
    if (basePrice !== undefined) {
      const numericPrice = Number(basePrice)
      if (!isFinite(numericPrice) || numericPrice < 0 || numericPrice > 1_000_000) {
        return NextResponse.json({ error: t('catalog.priceRange') }, { status: 400 })
      }
      packageData.price = numericPrice
    }

    // isCustomizable opsiyonel; gonderildiyse guncelle
    if (isCustomizable !== undefined) {
      packageData.isCustomizable = Boolean(isCustomizable)
    }

    // Ceviri alanlari (EN/DE/AR) - sadece body'de varsa ekle
    if (body.name_en !== undefined || body.name_de !== undefined || body.name_ar !== undefined) {
      Object.assign(packageData, buildTranslationData('name', { en: body.name_en, de: body.name_de, ar: body.name_ar }))
    }
    if (body.description_en !== undefined || body.description_de !== undefined || body.description_ar !== undefined) {
      Object.assign(packageData, buildTranslationData('description', { en: body.description_en, de: body.description_de, ar: body.description_ar }))
    }
    if (body.note_en !== undefined || body.note_de !== undefined || body.note_ar !== undefined) {
      Object.assign(packageData, buildTranslationData('note', { en: body.note_en, de: body.note_de, ar: body.note_ar }))
    }

    // Items validation
    if (items) {
      if (!Array.isArray(items)) {
        return NextResponse.json({ error: t('catalog.itemsMustBeArray') }, { status: 400 })
      }
      if (items.length > 100) {
        return NextResponse.json({ error: t('catalog.packageMax100Items') }, { status: 400 })
      }
      for (const item of items) {
        if (!item.name || typeof item.name !== 'string' || !item.name.trim() || item.name.length > 200) {
          return NextResponse.json({ error: t('catalog.itemNameLength') }, { status: 400 })
        }
        if (!NO_HTML_REGEX.test(item.name)) {
          return NextResponse.json({ error: t('catalog.itemNameNoHtml', { name: item.name }) }, { status: 400 })
        }
        const itemPrice = Number(item.unitPrice ?? item.price ?? 0)
        if (!isFinite(itemPrice) || itemPrice < 0 || itemPrice > 1_000_000) {
          return NextResponse.json({ error: t('catalog.itemPriceInvalid', { name: item.name }) }, { status: 400 })
        }
        const itemQty = Number(item.quantity ?? 1)
        if (!Number.isInteger(itemQty) || itemQty < 1 || itemQty > 1000) {
          return NextResponse.json({ error: t('catalog.itemQtyRange', { name: item.name }) }, { status: 400 })
        }
      }

      await prisma.packageItem.deleteMany({
        where: { packageId: id }
      })

      await prisma.packageItem.createMany({
        data: items.map((item: { name: string; quantity: number; unitPrice?: number; price?: number; name_en?: string; name_de?: string; name_ar?: string }) => ({
          packageId: id,
          name: item.name.trim(),
          ...buildTranslationData('name', { en: item.name_en, de: item.name_de, ar: item.name_ar }),
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
      { error: t('catalog.packageUpdateFailed') },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const t = await getTranslations({ locale: await getApiLocale(), namespace: 'apiErrors' })
  try {
    const session = await getAdminSession()
    if (!session) {
      return NextResponse.json({ error: t('catalog.unauthorized') }, { status: 401 })
    }

    const { id } = await params

    // Paket bilgisini al
    const pkg = await prisma.package.findUnique({
      where: { id }
    })

    if (!pkg) {
      return NextResponse.json({ error: t('catalog.packageNotFound') }, { status: 404 })
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
        { error: t('catalog.packageHasActiveOrders', { count: activeOrders }) },
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
      { error: t('catalog.packageDeleteFailed') },
      { status: 500 }
    )
  }
}
