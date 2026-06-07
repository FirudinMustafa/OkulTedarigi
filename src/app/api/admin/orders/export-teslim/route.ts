import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/auth'
import { buildContentDisposition } from '@/lib/security'
import { buildTeslimExcel } from '@/lib/teslim-excel'

// Secime gore Teslim Excel'i — Gelen Siparis sekmesinde secilen siparisleri indirir.
// Ayni sutunlar: Okul | Ad | Soyad | Sinif | Sube | Siparis Adedi | Teslim Tarihi (bos) | ✓
export async function POST(request: Request) {
  try {
    const session = await getAdminSession()
    if (!session) {
      return NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    const orderIds = body?.orderIds
    if (!Array.isArray(orderIds) || orderIds.length === 0 || orderIds.length > 2000) {
      return NextResponse.json({ error: 'Siparis ID listesi gerekli (max 2000)' }, { status: 400 })
    }
    if (!orderIds.every((id: unknown) => typeof id === 'string' && id.length > 0 && id.length <= 40)) {
      return NextResponse.json({ error: 'Gecersiz siparis ID' }, { status: 400 })
    }

    const orders = await prisma.order.findMany({
      where: { id: { in: orderIds } },
      include: {
        class: { include: { school: { select: { name: true } } } },
        students: { select: { firstName: true, lastName: true, section: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    const buffer = await buildTeslimExcel(orders)
    const filename = `teslim_listesi_secili_${new Date().toISOString().slice(0, 10)}.xlsx`

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': buildContentDisposition(filename),
        'Content-Length': String(buffer.byteLength),
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('Secili teslim export hatasi:', error)
    return NextResponse.json({ error: 'Export basarisiz' }, { status: 500 })
  }
}
