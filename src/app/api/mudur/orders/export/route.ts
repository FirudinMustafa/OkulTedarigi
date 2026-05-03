import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getMudurSession } from '@/lib/auth'
import { ORDER_STATUS_LABELS } from '@/lib/constants'
import { escapeCsvValue, buildContentDisposition } from '@/lib/security'
import ExcelJS from 'exceljs'

const safe = escapeCsvValue

export async function GET() {
  try {
    const session = await getMudurSession()
    if (!session || !session.schoolId) {
      return NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 401 })
    }

    const school = await prisma.school.findUnique({
      where: { id: session.schoolId },
      select: { name: true }
    })

    const orders = await prisma.order.findMany({
      where: {
        class: { schoolId: session.schoolId }
      },
      include: {
        class: { select: { name: true } },
        package: { select: { name: true } }
      },
      orderBy: { createdAt: 'desc' }
    })

    const statusLabels: Record<string, string> = { ...ORDER_STATUS_LABELS, REFUNDED: 'Iade' }
    const schoolName = school?.name || 'Okul'

    // ---- Excel ----
    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'Okul Tedarik Sistemi'
    workbook.created = new Date()

    const primaryColor = '4F46E5'
    const headerFill: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: primaryColor } }
    const headerFont: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFFFF' }, size: 11 }
    const borderStyle: Partial<ExcelJS.Borders> = {
      top: { style: 'thin', color: { argb: 'D1D5DB' } },
      bottom: { style: 'thin', color: { argb: 'D1D5DB' } },
      left: { style: 'thin', color: { argb: 'D1D5DB' } },
      right: { style: 'thin', color: { argb: 'D1D5DB' } }
    }
    const currencyFormat = '#,##0.00 "TL"'

    const statusColors: Record<string, string> = {
      COMPLETED: '16A34A',
      CANCELLED: 'DC2626',
      REFUNDED: 'DC2626',
      PAYMENT_RECEIVED: '2563EB',
      CONFIRMED: '7C3AED',
      CARGO_SHIPPED: 'D97706',
      DELIVERED_TO_SCHOOL: '059669',
      INVOICED: '4F46E5',
      NEW: '6B7280',
      PAYMENT_PENDING: 'D97706'
    }

    const ws = workbook.addWorksheet('Siparisler', { properties: { tabColor: { argb: primaryColor } } })

    // Baslik
    ws.mergeCells('A1:I1')
    const titleCell = ws.getCell('A1')
    titleCell.value = `${schoolName} - Siparis Listesi`
    titleCell.font = { bold: true, size: 16, color: { argb: primaryColor } }
    titleCell.alignment = { horizontal: 'left', vertical: 'middle' }
    ws.getRow(1).height = 35

    ws.mergeCells('A2:I2')
    const subtitleCell = ws.getCell('A2')
    subtitleCell.value = `Toplam: ${orders.length} siparis  |  Olusturma: ${new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })}`
    subtitleCell.font = { size: 10, color: { argb: '6B7280' }, italic: true }

    ws.addRow([])

    // Header
    const headers = ['Siparis No', 'Durum', 'Veli Adi', 'Ogrenci Adi', 'Telefon', 'Sinif', 'Paket', 'Tutar (TL)', 'Siparis Tarihi']
    const headerRow = ws.addRow(headers)
    headerRow.eachCell((cell) => {
      cell.fill = headerFill
      cell.font = headerFont
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
      cell.border = borderStyle
    })
    headerRow.height = 28

    // Data
    orders.forEach((o, idx) => {
      const row = ws.addRow([
        safe(o.orderNumber),
        safe(statusLabels[o.status] || o.status),
        safe(o.parentName),
        safe(o.studentName),
        safe(o.phone),
        safe(o.class.name),
        safe(o.package?.name || ''),
        Number(o.totalAmount),
        new Date(o.createdAt).toLocaleDateString('tr-TR')
      ])

      const stripeFill: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: idx % 2 === 0 ? 'FFFFFF' : 'F9FAFB' } }
      row.eachCell((cell) => {
        cell.fill = stripeFill
        cell.border = borderStyle
        cell.alignment = { vertical: 'middle' }
      })

      // Durum rengi
      row.getCell(2).font = { bold: true, color: { argb: statusColors[o.status] || '6B7280' } }

      // Tutar
      row.getCell(8).numFmt = currencyFormat
      row.getCell(8).alignment = { horizontal: 'right', vertical: 'middle' }

      row.height = 22
    })

    // Toplam
    if (orders.length > 0) {
      const totalRevenue = orders
        .filter(o => !['CANCELLED', 'REFUNDED'].includes(o.status))
        .reduce((acc, o) => acc + Number(o.totalAmount), 0)

      const tRow = ws.addRow(['', '', '', '', '', '', 'TOPLAM', totalRevenue, `${orders.length} siparis`])
      tRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'EEF2FF' } }
        cell.font = { bold: true, size: 11, color: { argb: primaryColor } }
        cell.border = {
          top: { style: 'medium', color: { argb: primaryColor } },
          bottom: { style: 'medium', color: { argb: primaryColor } },
          left: { style: 'thin', color: { argb: 'D1D5DB' } },
          right: { style: 'thin', color: { argb: 'D1D5DB' } }
        }
      })
      tRow.getCell(8).numFmt = currencyFormat
      tRow.height = 28
    }

    // Sutun genislikleri
    const colWidths = [18, 18, 20, 20, 16, 14, 28, 16, 14]
    colWidths.forEach((w, i) => { ws.getColumn(i + 1).width = w })

    ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }

    // ---- Buffer ----
    const buffer = await workbook.xlsx.writeBuffer()
    const safeName = schoolName.replace(/[^a-zA-Z0-9\u00C0-\u024F\u0400-\u04FF]/g, '_')
    const filename = `${safeName}_siparisler_${new Date().toISOString().slice(0, 10)}.xlsx`

    return new NextResponse(new Uint8Array(buffer as ArrayBuffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': buildContentDisposition(filename),
        'Content-Length': String((buffer as ArrayBuffer).byteLength),
        'Cache-Control': 'no-store'
      }
    })

  } catch (error) {
    console.error('Export hatasi:', error)
    return NextResponse.json({ error: 'Export basarisiz' }, { status: 500 })
  }
}
