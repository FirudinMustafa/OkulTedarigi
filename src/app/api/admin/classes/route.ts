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

    const classes = await prisma.class.findMany({
      orderBy: [{ school: { name: 'asc' } }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
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
      { error: 'Siniflar yuklenemedi' },
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
    const { name, schoolId, packageId, commissionAmount } = body

    if (!name || typeof name !== 'string' || !name.trim() || !schoolId) {
      return NextResponse.json(
        { error: 'Sinif adi ve okul gerekli' },
        { status: 400 }
      )
    }

    // Foreign key existence check (kullanici-dostu hata mesaji icin)
    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      select: { id: true }
    })
    if (!school) {
      return NextResponse.json({ error: 'Okul bulunamadi' }, { status: 404 })
    }
    if (packageId) {
      const pkg = await prisma.package.findUnique({
        where: { id: packageId },
        select: { id: true }
      })
      if (!pkg) {
        return NextResponse.json({ error: 'Paket bulunamadi' }, { status: 404 })
      }
    }

    // Komisyon negatif olamaz
    const commission = commissionAmount ? Number(commissionAmount) : 0
    if (!isFinite(commission) || commission < 0) {
      return NextResponse.json({ error: 'Komisyon negatif olamaz' }, { status: 400 })
    }

    const classData = await prisma.class.create({
      data: {
        name: name.trim(),
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
      { error: 'Sinif olusturulamadi' },
      { status: 500 }
    )
  }
}
