import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/auth'
import { buildContentDisposition } from '@/lib/security'
import { buildTeslimExcel } from '@/lib/teslim-excel'
import { UNPAID_STATUSES } from '@/lib/constants'
import type { OrderStatus } from '@prisma/client'
import { getApiLocale } from '@/lib/api-locale'
import { getTranslations } from 'next-intl/server'

// Teslim Excel'i — tarih + saat araligiyla indirme ("Okul Teslim Raporu" yerine).
// Sutunlar: Okul | Ad | Soyad | Sinif | Sube | Siparis Adedi | Teslim Tarihi (bos) | ✓
export async function GET(request: Request) {
  const t = await getTranslations({ locale: await getApiLocale(), namespace: 'apiErrors' })
  try {
    const session = await getAdminSession()
    if (!session) {
      return NextResponse.json({ error: t('adminMisc.unauthorized') }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const schoolId = searchParams.get('schoolId') || undefined
    const startStr = searchParams.get('start') || undefined
    const endStr = searchParams.get('end') || undefined

    // Tarih veya tarih+saat girisini destekle
    const isDateOnly = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s)

    let start: Date | undefined
    let end: Date | undefined
    if (startStr) {
      const d = new Date(startStr)
      if (!isNaN(d.getTime())) start = d
    }
    if (endStr) {
      const d = new Date(endStr)
      if (!isNaN(d.getTime())) {
        if (isDateOnly(endStr)) d.setHours(23, 59, 59, 999)
        end = d
      }
    }

    const dateWhere: { gte?: Date; lte?: Date } = {}
    if (start) dateWhere.gte = start
    if (end) dateWhere.lte = end

    const orders = await prisma.order.findMany({
      where: {
        // Odenmemis siparisleri haric tut
        status: { notIn: UNPAID_STATUSES as OrderStatus[] },
        ...(schoolId ? { class: { schoolId } } : {}),
        ...(start || end ? { createdAt: dateWhere } : {}),
      },
      include: {
        class: { include: { school: { select: { name: true } } } },
        students: { select: { firstName: true, lastName: true, section: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    const buffer = await buildTeslimExcel(orders, (await getApiLocale()) as 'tr' | 'en' | 'de' | 'ar')

    // Filename: datetime-local'daki ':' Windows'ta gecersiz; '-' ile degistir
    const safeForFilename = (s: string) => s.replace(/[:T]/g, '-')
    const filenameBits = ['teslim_listesi']
    if (startStr) filenameBits.push(safeForFilename(startStr))
    if (endStr) filenameBits.push(safeForFilename(endStr))
    if (!startStr && !endStr) filenameBits.push(new Date().toISOString().slice(0, 10))
    const filename = filenameBits.join('_') + '.xlsx'

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': buildContentDisposition(filename),
        'Content-Length': String(buffer.byteLength),
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('Teslim listesi export hatasi:', error)
    return NextResponse.json({ error: t('adminMisc.exportFailed') }, { status: 500 })
  }
}
