import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/auth'
import { logAction } from '@/lib/logger'
import { adminClassCreateSchema, formatZodError } from '@/lib/validators'
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

    const classes = await prisma.class.findMany({
      orderBy: [{ school: { name: 'asc' } }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        name_en: true,
        name_de: true,
        name_ar: true,
        commissionAmount: true,
        isActive: true,
        school: { select: { id: true, name: true, password: true } },
        package: { select: { id: true, name: true } },
        _count: { select: { orders: true } }
      }
    })

    return NextResponse.json({ classes })
  } catch (error) {
    console.error('Siniflar listelenemedi:', error)
    return NextResponse.json(
      { error: t('catalog.classesLoadFailed') },
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

    const body = await request.json().catch(() => null)
    const parsed = adminClassCreateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: formatZodError(parsed.error, await getApiLocale()) },
        { status: 400 }
      )
    }
    const { name, schoolId, packageId, commissionAmount, name_en, name_de, name_ar } = parsed.data

    // Foreign key existence check (kullanici-dostu hata mesaji icin)
    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      select: { id: true }
    })
    if (!school) {
      return NextResponse.json({ error: t('catalog.schoolNotFound') }, { status: 404 })
    }
    if (packageId) {
      const pkg = await prisma.package.findUnique({
        where: { id: packageId },
        select: { id: true }
      })
      if (!pkg) {
        return NextResponse.json({ error: t('catalog.packageNotFound') }, { status: 404 })
      }
    }

    // Komisyon negatif olamaz
    const commission = commissionAmount ? Number(commissionAmount) : 0
    if (!isFinite(commission) || commission < 0) {
      return NextResponse.json({ error: t('catalog.commissionNegative') }, { status: 400 })
    }

    const classData = await prisma.class.create({
      data: {
        name: name.trim(),
        ...buildTranslationData('name', { en: name_en, de: name_de, ar: name_ar }),
        schoolId,
        packageId: packageId || null,
        commissionAmount: commission
      },
      include: {
        school: { select: { id: true, name: true } },
        package: { select: { id: true, name: true } }
      }
    })

    await logAction({
      userId: session.id,
      userType: 'ADMIN',
      action: 'CREATE',
      entity: 'CLASS',
      entityId: classData.id,
      details: { name: classData.name, schoolId }
    })

    return NextResponse.json({ class: classData })
  } catch (error) {
    console.error('Sinif olusturulamadi:', error)
    return NextResponse.json(
      { error: t('catalog.classCreateFailed') },
      { status: 500 }
    )
  }
}
