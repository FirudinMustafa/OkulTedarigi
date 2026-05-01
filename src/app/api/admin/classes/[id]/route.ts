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
      return NextResponse.json({ error: 'Sinif bulunamadi' }, { status: 404 })
    }

    return NextResponse.json({ class: classData })
  } catch (error) {
    console.error('Sinif getirilemedi:', error)
    return NextResponse.json(
      { error: 'Sinif yuklenemedi' },
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

    // Izin verilen alanlari filtrele
    const allowedFields = ['name', 'schoolId', 'packageId', 'isActive', 'commissionAmount']
    const updateData: Record<string, unknown> = {}

    for (const key of Object.keys(body)) {
      if (allowedFields.includes(key)) {
        updateData[key] = body[key]
      }
    }

    // packageId bos string ise null yap
    if (updateData.packageId === "") {
      updateData.packageId = null
    }

    // Validation: name, commissionAmount
    if (typeof updateData.name === 'string' && (!updateData.name.trim() || updateData.name.length > 100)) {
      return NextResponse.json({ error: 'Sinif adi 1-100 karakter olmali' }, { status: 400 })
    }
    if (updateData.commissionAmount !== undefined) {
      const c = Number(updateData.commissionAmount)
      if (!isFinite(c) || c < 0 || c > 1_000_000) {
        return NextResponse.json({ error: 'Komisyon 0 ile 1.000.000 arasinda olmali' }, { status: 400 })
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
        return NextResponse.json({ error: 'Okul bulunamadi' }, { status: 404 })
      }
    }
    if (typeof updateData.packageId === 'string') {
      const pkg = await prisma.package.findUnique({
        where: { id: updateData.packageId as string },
        select: { id: true }
      })
      if (!pkg) {
        return NextResponse.json({ error: 'Paket bulunamadi' }, { status: 404 })
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'Guncellenecek alan bulunamadi' }, { status: 400 })
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
      { error: 'Sinif guncellenemedi' },
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

    // Sinif bilgisini al
    const classData = await prisma.class.findUnique({
      where: { id }
    })

    if (!classData) {
      return NextResponse.json({ error: 'Sinif bulunamadi' }, { status: 404 })
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
          error: `Bu sinifa bagli ${activeOrderCount} aktif siparis var. Once siparisleri iptal etmeli veya sinifi pasiflestirmelisiniz.`,
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

    return NextResponse.json({ success: true, mode: 'soft_delete', message: 'Sinif gecmis siparis icerdigi icin pasiflestirildi.' })
  } catch (error) {
    console.error('Sinif silinemedi:', error)
    return NextResponse.json(
      { error: 'Sinif silinemedi' },
      { status: 500 }
    )
  }
}
