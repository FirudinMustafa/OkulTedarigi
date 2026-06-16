import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/auth'
import { logAction } from '@/lib/logger'
import { adminClassUpdateSchema, formatZodError } from '@/lib/validators'
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

    const classData = await prisma.class.findUnique({
      where: { id },
      include: {
        school: true,
        package: { include: { items: true } },
        orders: {
          take: 10,
          orderBy: { createdAt: 'desc' }
        }
      }
    })

    if (!classData) {
      return NextResponse.json({ error: t('catalog.classNotFound') }, { status: 404 })
    }

    return NextResponse.json({ class: classData })
  } catch (error) {
    console.error('Sinif getirilemedi:', error)
    return NextResponse.json(
      { error: t('catalog.classLoadFailed') },
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
    const parsed = adminClassUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: formatZodError(parsed.error, await getApiLocale()) },
        { status: 400 }
      )
    }

    // Izin verilen alanlari filtrele
    const allowedFields = ['name', 'schoolId', 'packageId', 'isActive', 'commissionAmount']
    const updateData: Record<string, unknown> = {}

    for (const key of Object.keys(parsed.data as Record<string, unknown>)) {
      if (allowedFields.includes(key)) {
        updateData[key] = (parsed.data as Record<string, unknown>)[key]
      }
    }

    // Cok dilli sinif adi cevirileri (varsa) — bos string -> null
    const pdata = parsed.data as Record<string, unknown>
    if ('name_en' in pdata || 'name_de' in pdata || 'name_ar' in pdata) {
      Object.assign(updateData, buildTranslationData('name', {
        en: pdata.name_en as string | null | undefined,
        de: pdata.name_de as string | null | undefined,
        ar: pdata.name_ar as string | null | undefined,
      }))
    }

    // packageId bos string ise null yap
    if (updateData.packageId === "") {
      updateData.packageId = null
    }

    // Validation: name, commissionAmount
    if (typeof updateData.name === 'string' && (!updateData.name.trim() || updateData.name.length > 100)) {
      return NextResponse.json({ error: t('catalog.classNameLength') }, { status: 400 })
    }
    if (updateData.commissionAmount !== undefined) {
      const c = Number(updateData.commissionAmount)
      if (!isFinite(c) || c < 0 || c > 1_000_000) {
        return NextResponse.json({ error: t('catalog.commissionRange') }, { status: 400 })
      }
      updateData.commissionAmount = c
    }

    // FK existence checks (kullanici dostu hata mesaji icin)
    if (typeof updateData.schoolId === 'string') {
      const school = await prisma.school.findUnique({
        where: { id: updateData.schoolId as string },
        select: { id: true }
      })
      if (!school) {
        return NextResponse.json({ error: t('catalog.schoolNotFound') }, { status: 404 })
      }
    }
    if (typeof updateData.packageId === 'string') {
      const pkg = await prisma.package.findUnique({
        where: { id: updateData.packageId as string },
        select: { id: true }
      })
      if (!pkg) {
        return NextResponse.json({ error: t('catalog.packageNotFound') }, { status: 404 })
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: t('catalog.noFieldsToUpdate') }, { status: 400 })
    }

    const classData = await prisma.class.update({
      where: { id },
      data: updateData
    })

    await logAction({
      userId: session.id,
      userType: 'ADMIN',
      action: 'UPDATE',
      entity: 'CLASS',
      entityId: classData.id,
      details: { name: classData.name }
    })

    return NextResponse.json({ class: classData })
  } catch (error) {
    console.error('Sinif guncellenemedi:', error)
    return NextResponse.json(
      { error: t('catalog.classUpdateFailed') },
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

    // Sinif bilgisini al
    const classData = await prisma.class.findUnique({
      where: { id }
    })

    if (!classData) {
      return NextResponse.json({ error: t('catalog.classNotFound') }, { status: 404 })
    }

    // Aktif (iptal edilmemis ve iade edilmemis) siparis varsa hard delete reddet
    const activeOrderCount = await prisma.order.count({
      where: {
        classId: id,
        status: { notIn: ['CANCELLED', 'REFUNDED'] }
      }
    })

    if (activeOrderCount > 0) {
      return NextResponse.json(
        {
          error: t('catalog.classHasActiveOrders', { count: activeOrderCount }),
          activeOrderCount
        },
        { status: 409 }
      )
    }

    // Hicbir order yoksa hard delete; iptal/iade gecmisi varsa soft delete
    const totalOrderCount = await prisma.order.count({
      where: { classId: id }
    })

    if (totalOrderCount === 0) {
      // Tamamen bos sinif - hard delete
      await prisma.class.delete({ where: { id } })

      await logAction({
        userId: session.id,
        userType: 'ADMIN',
        action: 'DELETE',
        entity: 'CLASS',
        entityId: id,
        details: { name: classData.name, hardDelete: true }
      })

      return NextResponse.json({ success: true, mode: 'hard_delete' })
    }

    // Iptal/iade gecmisi var - tarihsel veriyi koru, soft delete
    await prisma.class.update({
      where: { id },
      data: { isActive: false }
    })

    await logAction({
      userId: session.id,
      userType: 'ADMIN',
      action: 'DEACTIVATE',
      entity: 'CLASS',
      entityId: id,
      details: { name: classData.name, reason: 'historical_orders_exist', historicalOrderCount: totalOrderCount }
    })

    return NextResponse.json({ success: true, mode: 'soft_delete', message: t('catalog.classDeactivated') })
  } catch (error) {
    console.error('Sinif silinemedi:', error)
    return NextResponse.json(
      { error: t('catalog.classDeleteFailed') },
      { status: 500 }
    )
  }
}
