import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/auth'
import { ORDER_STATUS_LABELS } from '@/lib/constants'
import { escapeCsvValue } from '@/lib/security'
import ExcelJS from 'exceljs'

const safe = escapeCsvValue

export async function GET(request: Request) {
  try {
    const session = await getAdminSession()
    if (!session) {
      return NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const schoolId = searchParams.get('schoolId')

    const schools = await prisma.school.findMany({
      where: schoolId ? { id: schoolId } : undefined,
      include: {
        classes: {
          include: {
            orders: { orderBy: { createdAt: 'desc' } },
            package: true
          },
          orderBy: { name: 'asc' }
        }
      },
      orderBy: { name: 'asc' }
    })

    if (schools.length === 0) {
      return NextResponse.json({ error: 'Okul bulunamadi' }, { status: 404 })
    }

    const statusLabels: Record<string, string> = { ...ORDER_STATUS_LABELS, REFUNDED: 'Iade' }

    // ---- Excel olustur ----
    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'Okul Tedarik Sistemi'
    workbook.created = new Date()

    const primaryColor = '0EA5E9'
    const headerFill: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: primaryColor } }
    const headerFont: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFFFF' }, size: 11 }
    const borderStyle: Partial<ExcelJS.Borders> = {
      top: { style: 'thin', color: { argb: 'D1D5DB' } },
      bottom: { style: 'thin', color: { argb: 'D1D5DB' } },
      left: { style: 'thin', color: { argb: 'D1D5DB' } },
      right: { style: 'thin', color: { argb: 'D1D5DB' } }
    }

    // ==================== SAYFA 1: TUM OGRENCILER ====================
    const wsOgrenci = workbook.addWorksheet('Tum Ogrenciler', { properties: { tabColor: { argb: primaryColor } } })

    wsOgrenci.mergeCells('A1:L1')
    const titleCell = wsOgrenci.getCell('A1')
    titleCell.value = schoolId
      ? `${schools[0].name} - Ogrenci Listesi`
      : 'Tum Okullar - Ogrenci Listesi'
    titleCell.font = { bold: true, size: 16, color: { argb: primaryColor } }
    titleCell.alignment = { horizontal: 'left', vertical: 'middle' }
    wsOgrenci.getRow(1).height = 35

    wsOgrenci.mergeCells('A2:L2')
    const subtitleCell = wsOgrenci.getCell('A2')
    subtitleCell.value = `Olusturma: ${new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })}`
    subtitleCell.font = { size: 10, color: { argb: '6B7280' }, italic: true }

    wsOgrenci.addRow([])

    const headers = [
      '#',
      'Okul',
      'Sinif',
      'Sube',
      'Ogrenci Adi Soyadi',
      'Veli Adi Soyadi',
      'Telefon',
      'E-posta',
      'Paket',
      'Siparis Durumu',
      'Siparis No',
      'Siparis Tarihi'
    ]
    const headerRow = wsOgrenci.addRow(headers)
    headerRow.eachCell((cell) => {
      cell.fill = headerFill
      cell.font = headerFont
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
      cell.border = borderStyle
    })
    headerRow.height = 28

    let rowIdx = 0
    for (const school of schools) {
      for (const cls of school.classes) {
        for (const o of cls.orders) {
          rowIdx++
          const row = wsOgrenci.addRow([
            rowIdx,
            safe(school.name),
            safe(cls.name),
            safe(o.studentSection || '-'),
            safe(o.studentName),
            safe(o.parentName),
            safe(o.phone),
            safe(o.email || '-'),
            safe(cls.package?.name || '-'),
            safe(statusLabels[o.status] || o.status),
            safe(o.orderNumber),
            new Date(o.createdAt).toLocaleDateString('tr-TR')
          ])

          const stripeFill: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowIdx % 2 === 0 ? 'F9FAFB' : 'FFFFFF' } }
          row.eachCell((cell) => {
            cell.fill = stripeFill
            cell.border = borderStyle
            cell.alignment = { vertical: 'middle' }
          })
          row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }
          row.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' }
          row.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' }
          row.height = 22
        }
      }
    }

    wsOgrenci.getColumn(1).width = 6
    wsOgrenci.getColumn(2).width = 24
    wsOgrenci.getColumn(3).width = 12
    wsOgrenci.getColumn(4).width = 8
    wsOgrenci.getColumn(5).width = 26
    wsOgrenci.getColumn(6).width = 26
    wsOgrenci.getColumn(7).width = 16
    wsOgrenci.getColumn(8).width = 26
    wsOgrenci.getColumn(9).width = 24
    wsOgrenci.getColumn(10).width = 18
    wsOgrenci.getColumn(11).width = 18
    wsOgrenci.getColumn(12).width = 14

    // ==================== SAYFA 2: OKUL BAZLI OZET ====================
    const wsOkul = workbook.addWorksheet('Okul Bazli', { properties: { tabColor: { argb: '8B5CF6' } } })

    wsOkul.mergeCells('A1:E1')
    const okulTitle = wsOkul.getCell('A1')
    okulTitle.value = 'Okul Bazli Ogrenci Sayisi'
    okulTitle.font = { bold: true, size: 14, color: { argb: primaryColor } }
    okulTitle.alignment = { vertical: 'middle' }
    wsOkul.getRow(1).height = 32

    wsOkul.addRow([])

    const okulHeaders = ['#', 'Okul', 'Sinif Sayisi', 'Toplam Ogrenci/Siparis', 'Teslimat']
    const okulHeaderRow = wsOkul.addRow(okulHeaders)
    okulHeaderRow.eachCell((cell) => {
      cell.fill = headerFill
      cell.font = headerFont
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
      cell.border = borderStyle
    })
    okulHeaderRow.height = 28

    schools.forEach((school, idx) => {
      const ogrenciSayisi = school.classes.reduce((acc, c) => acc + c.orders.length, 0)
      const row = wsOkul.addRow([
        idx + 1,
        safe(school.name),
        school.classes.length,
        ogrenciSayisi,
        school.deliveryType === 'CARGO' ? 'Kargo' : 'Okula Teslim'
      ])
      const stripeFill: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: idx % 2 === 0 ? 'F9FAFB' : 'FFFFFF' } }
      row.eachCell((cell, colNumber) => {
        cell.fill = stripeFill
        cell.border = borderStyle
        cell.alignment = { horizontal: colNumber === 2 ? 'left' : 'center', vertical: 'middle' }
      })
      row.height = 24
    })

    wsOkul.getColumn(1).width = 6
    wsOkul.getColumn(2).width = 30
    wsOkul.getColumn(3).width = 14
    wsOkul.getColumn(4).width = 22
    wsOkul.getColumn(5).width = 18

    // ==================== SAYFA 3: SINIF BAZLI ====================
    const wsSinif = workbook.addWorksheet('Sinif Bazli', { properties: { tabColor: { argb: '059669' } } })

    wsSinif.mergeCells('A1:F1')
    const sinifTitle = wsSinif.getCell('A1')
    sinifTitle.value = 'Sinif Bazli Ogrenci Sayisi'
    sinifTitle.font = { bold: true, size: 14, color: { argb: primaryColor } }
    sinifTitle.alignment = { vertical: 'middle' }
    wsSinif.getRow(1).height = 32

    wsSinif.addRow([])

    const sinifHeaders = ['#', 'Okul', 'Sinif', 'Paket', 'Siparis Adedi', 'Toplam Ciro (TL)']
    const sinifHeaderRow = wsSinif.addRow(sinifHeaders)
    sinifHeaderRow.eachCell((cell) => {
      cell.fill = headerFill
      cell.font = headerFont
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
      cell.border = borderStyle
    })
    sinifHeaderRow.height = 28

    let sIdx = 0
    for (const school of schools) {
      for (const cls of school.classes) {
        sIdx++
        const ciro = cls.orders
          .filter(o => !['CANCELLED', 'REFUNDED'].includes(o.status))
          .reduce((acc, o) => acc + Number(o.totalAmount), 0)
        const row = wsSinif.addRow([
          sIdx,
          safe(school.name),
          safe(cls.name),
          safe(cls.package?.name || '-'),
          cls.orders.length,
          ciro
        ])
        const stripeFill: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: sIdx % 2 === 0 ? 'F9FAFB' : 'FFFFFF' } }
        row.eachCell((cell, colNumber) => {
          cell.fill = stripeFill
          cell.border = borderStyle
          cell.alignment = { horizontal: colNumber === 2 || colNumber === 4 ? 'left' : 'center', vertical: 'middle' }
        })
        row.getCell(6).numFmt = '#,##0.00 "TL"'
        row.height = 22
      }
    }

    wsSinif.getColumn(1).width = 6
    wsSinif.getColumn(2).width = 28
    wsSinif.getColumn(3).width = 14
    wsSinif.getColumn(4).width = 28
    wsSinif.getColumn(5).width = 16
    wsSinif.getColumn(6).width = 20

    ;[wsOgrenci, wsOkul, wsSinif].forEach(ws => {
      ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
    })

    const buffer = await workbook.xlsx.writeBuffer()

    const baseName = schoolId
      ? schools[0].name.replace(/[^a-zA-Z0-9\u00C0-\u024F\u0400-\u04FF]/g, '_')
      : 'tum_okullar'
    const filename = `${baseName}_ogrenciler_${new Date().toISOString().slice(0, 10)}.xlsx`

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    })

  } catch (error) {
    console.error('Ogrenci export hatasi:', error)
    return NextResponse.json({ error: 'Export basarisiz' }, { status: 500 })
  }
}
