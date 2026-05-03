import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/auth'
import { ORDER_STATUS_LABELS } from '@/lib/constants'
import { escapeCsvValue, buildContentDisposition } from '@/lib/security'
import ExcelJS from 'exceljs'

const safe = escapeCsvValue

// Class.name icindeki ilk rakam dizisini "sinif numarasi" olarak cikar.
// Ornek: "1-A" -> "1", "5. Sinif" -> "5", "Anaokulu" -> ""
function extractClassNumber(name: string): string {
  const m = name.match(/\d+/)
  return m ? m[0] : ''
}

export async function GET(request: Request) {
  try {
    const session = await getAdminSession()
    if (!session) {
      return NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const schoolId = searchParams.get('schoolId') || undefined
    const startStr = searchParams.get('start') || undefined
    const endStr = searchParams.get('end') || undefined

    // Tarih veya tarih+saat girisini destekle
    //   "2026-05-03"        -> tum gunu kapsar (start=00:00:00, end=23:59:59.999)
    //   "2026-05-03T14:30"  -> tam o ana kadar (saat dakika hassasiyetiyle)
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
        // Yalnizca tarih girilmisse gun sonuna kadar dahil et;
        // saat de girilmisse o tam ana kadar kullan.
        if (isDateOnly(endStr)) d.setHours(23, 59, 59, 999)
        end = d
      }
    }

    const dateWhere: { gte?: Date; lte?: Date } = {}
    if (start) dateWhere.gte = start
    if (end) dateWhere.lte = end

    const orders = await prisma.order.findMany({
      where: {
        ...(schoolId ? { class: { schoolId } } : {}),
        ...(start || end ? { createdAt: dateWhere } : {}),
      },
      include: {
        class: { include: { school: true } },
        students: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'Okul Tedarik Sistemi'
    workbook.created = new Date()

    const ws = workbook.addWorksheet('Okul Teslim Raporu')

    const headerFill: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: '10B981' } }
    const headerFont: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFFFF' }, size: 11 }
    const borderStyle: Partial<ExcelJS.Borders> = {
      top: { style: 'thin', color: { argb: 'D1D5DB' } },
      bottom: { style: 'thin', color: { argb: 'D1D5DB' } },
      left: { style: 'thin', color: { argb: 'D1D5DB' } },
      right: { style: 'thin', color: { argb: 'D1D5DB' } },
    }

    ws.columns = [
      { header: 'Öğrenci Adı', key: 'firstName', width: 18 },
      { header: 'Öğrenci Soyadı', key: 'lastName', width: 20 },
      { header: 'Sınıf', key: 'classNum', width: 8 },
      { header: 'Şube', key: 'section', width: 8 },
      { header: 'Sipariş Tarihi', key: 'createdAt', width: 20 },
      { header: 'Okul', key: 'schoolName', width: 30 },
      { header: 'Ödeme Durumu', key: 'paymentStatus', width: 18 },
      { header: 'Sipariş Adedi', key: 'qty', width: 14 },
      { header: 'Sipariş No', key: 'orderNumber', width: 16 },
    ]

    const headerRow = ws.getRow(1)
    headerRow.font = headerFont
    headerRow.fill = headerFill
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' }
    headerRow.height = 22
    headerRow.eachCell(cell => { cell.border = borderStyle })

    // Her siparis icin: cogul ogrenci varsa her ogrenciye satir; yoksa eski tek-ogrenci kaydi
    let rowIndex = 2
    for (const o of orders) {
      const classNum = extractClassNumber(o.class.name)
      const formattedDate = o.createdAt.toLocaleString('tr-TR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      })
      const paymentLabel = ORDER_STATUS_LABELS[o.status] || o.status
      const studentRows = o.students.length > 0
        ? o.students.map(s => ({ firstName: s.firstName, lastName: s.lastName, section: s.section || '' }))
        : (() => {
            // Eski tek-ogrenci siparisleri icin fallback: studentName "Ad Soyad" formatinda
            const parts = (o.studentName || '').trim().split(/\s+/)
            const lastName = parts.length > 1 ? parts.pop()! : ''
            const firstName = parts.join(' ')
            return [{ firstName, lastName, section: o.studentSection || '' }]
          })()

      const studentCount = studentRows.length

      for (const s of studentRows) {
        const row = ws.getRow(rowIndex++)
        row.values = {
          firstName: safe(s.firstName),
          lastName: safe(s.lastName),
          classNum,
          section: s.section,
          createdAt: formattedDate,
          schoolName: safe(o.class.school.name),
          paymentStatus: paymentLabel,
          qty: studentCount,
          orderNumber: o.orderNumber,
        }
        row.eachCell(cell => { cell.border = borderStyle })
      }
    }

    ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }

    const buffer = await workbook.xlsx.writeBuffer()
    // Filename: datetime-local'daki ':' Windows'ta gecersiz; '-' ile degistir
    const safeForFilename = (s: string) => s.replace(/[:T]/g, '-')
    const filenameBits = ['okul_teslim_raporu']
    if (startStr) filenameBits.push(safeForFilename(startStr))
    if (endStr) filenameBits.push(safeForFilename(endStr))
    if (!startStr && !endStr) filenameBits.push(new Date().toISOString().slice(0, 10))
    const filename = filenameBits.join('_') + '.xlsx'

    return new NextResponse(new Uint8Array(buffer as ArrayBuffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': buildContentDisposition(filename),
        'Content-Length': String((buffer as ArrayBuffer).byteLength),
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('Okul teslim raporu export hatasi:', error)
    return NextResponse.json({ error: 'Export basarisiz' }, { status: 500 })
  }
}
