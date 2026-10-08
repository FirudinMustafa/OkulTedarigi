import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/auth'
import { buildContentDisposition } from '@/lib/security'
import { buildTeslimExcel, type DocLocale } from '@/lib/teslim-excel'
import { getTeslimPackageColumns } from '@/lib/teslim-packages'
import { REVENUE_STATUSES } from '@/lib/constants'
import { parseYmd, endOfDay } from '@/lib/report-range'
import type { OrderStatus } from '@prisma/client'
import { getApiLocale } from '@/lib/api-locale'
import { getTranslations } from 'next-intl/server'
import { MAX_EXPORT_ROWS } from '@/lib/export-limits'

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
    // "YYYY-MM-DD" yerel gun olarak okunur (new Date('YYYY-MM-DD') UTC gece yarisi = TR 03:00
    // olur ve 00:00-03:00 arasi siparisler listeden duserdi).
    if (startStr) {
      const d = isDateOnly(startStr) ? parseYmd(startStr) : new Date(startStr)
      if (d && !isNaN(d.getTime())) start = d
    }
    if (endStr) {
      const d = isDateOnly(endStr) ? (parseYmd(endStr) && endOfDay(parseYmd(endStr)!)) : new Date(endStr)
      if (d && !isNaN(d.getTime())) end = d
    }

    const dateWhere: { gte?: Date; lte?: Date } = {}
    if (start) dateWhere.gte = start
    if (end) dateWhere.lte = end

    const teslimWhere = {
      // Yalniz teslim edilecek (ciroya dahil) siparisler: odenmemis + iptal/iade HARIC —
      // iptal edilmis siparisin ogrencisi sahada teslim listesinde gorunmesin
      status: { in: REVENUE_STATUSES as OrderStatus[] },
      ...(schoolId ? { class: { schoolId } } : {}),
      ...(start || end ? { createdAt: dateWhere } : {}),
    }

    // Teslim listesi bir teslimat/operasyon belgesi — kismi (kesilmis) bir liste
    // sahada eksik ogrenci gibi gorunup zarar verebilir; kesmek yerine daralt.
    const teslimCount = await prisma.order.count({ where: teslimWhere })
    if (teslimCount > MAX_EXPORT_ROWS) {
      return NextResponse.json(
        { error: `${teslimCount} kayit cok fazla — lutfen tarih araligini veya okulu daraltin (limit: ${MAX_EXPORT_ROWS}).` },
        { status: 400 }
      )
    }

    const orders = await prisma.order.findMany({
      where: teslimWhere,
      include: {
        class: { include: { school: { select: { name: true, password: true } } } },
        students: { select: { firstName: true, lastName: true, section: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: MAX_EXPORT_ROWS,
    })

    const locale = (await getApiLocale()) as DocLocale
    // Okul secildiyse o okula tanimli paketler sutun olarak eklenir
    const packageColumns = schoolId ? await getTeslimPackageColumns(schoolId, orders, locale) : []
    const buffer = await buildTeslimExcel(orders, locale, packageColumns)

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
