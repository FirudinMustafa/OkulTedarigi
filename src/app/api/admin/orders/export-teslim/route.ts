import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/auth'
import { buildContentDisposition } from '@/lib/security'
import { buildTeslimExcel } from '@/lib/teslim-excel'
import { getApiLocale } from '@/lib/api-locale'
import { getTranslations } from 'next-intl/server'

// Secime gore Teslim Excel'i — Gelen Siparis sekmesinde secilen siparisleri indirir.
// Ayni sutunlar: Okul | Ad | Soyad | Sinif | Sube | Siparis Adedi | Teslim Tarihi (bos) | ✓
export async function POST(request: Request) {
  const t = await getTranslations({ locale: await getApiLocale(), namespace: 'apiErrors' })
  try {
    const session = await getAdminSession()
    if (!session) {
      return NextResponse.json({ error: t('orders.unauthorized') }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    const orderIds = body?.orderIds
    if (!Array.isArray(orderIds) || orderIds.length === 0 || orderIds.length > 2000) {
      return NextResponse.json({ error: t('orders.idListRequired2000') }, { status: 400 })
    }
    if (!orderIds.every((id: unknown) => typeof id === 'string' && id.length > 0 && id.length <= 40)) {
      return NextResponse.json({ error: t('orders.invalidOrderId') }, { status: 400 })
    }

    const orders = await prisma.order.findMany({
      where: { id: { in: orderIds } },
      include: {
        class: { include: { school: { select: { name: true } } } },
        students: { select: { firstName: true, lastName: true, section: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    const buffer = await buildTeslimExcel(orders, (await getApiLocale()) as 'tr' | 'en' | 'de' | 'ar')
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
    return NextResponse.json({ error: t('orders.exportFailed') }, { status: 500 })
  }
}
