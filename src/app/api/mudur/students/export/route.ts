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
      include: {
        classes: {
          include: {
            orders: {
              orderBy: { createdAt: 'desc' }
            },
            package: true
          },
          orderBy: { name: 'asc' }
        }
      }
    })

    if (!school) {
      return NextResponse.json({ error: 'Okul bulunamadi' }, { status: 404 })
    }

    const statusLabels: Record<string, string> = { ...ORDER_STATUS_LABELS, REFUNDED: 'Iade' }

    // ---- Excel olustur ----
    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'Okul Tedarik Sistemi'
    workbook.created = new Date()

    const primaryColor = '0EA5E9' // sky
    const headerFill: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: primaryColor } }
    const headerFont: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFFFF' }, size: 11 }
    const borderStyle: Partial<ExcelJS.Borders> = {
      top: { style: 'thin', color: { argb: 'D1D5DB' } },
      bottom: { style: 'thin', color: { argb: 'D1D5DB' } },
      left: { style: 'thin', color: { argb: 'D1D5DB' } },
      right: { style: 'thin', color: { argb: 'D1D5DB' } }
    }

    // ==================== SAYFA 1: OGRENCI LISTESI ====================
    const wsOgrenci = workbook.addWorksheet('Ogrenci Listesi', { properties: { tabColor: { argb: primaryColor } } })

    wsOgrenci.mergeCells('A1:K1')
    const titleCell = wsOgrenci.getCell('A1')
    titleCell.value = `${school.name} - Ogrenci Listesi`
    titleCell.font = { bold: true, size: 16, color: { argb: primaryColor } }
    titleCell.alignment = { horizontal: 'left', vertical: 'middle' }
    wsOgrenci.getRow(1).height = 35

    wsOgrenci.mergeCells('A2:K2')
    const subtitleCell = wsOgrenci.getCell('A2')
    subtitleCell.value = `Olusturma: ${new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })}`
    subtitleCell.font = { size: 10, color: { argb: '6B7280' }, italic: true }

    wsOgrenci.addRow([])

    const headers = [
      '#',
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
    for (const cls of school.classes) {
      for (const o of cls.orders) {
        rowIdx++
        const row = wsOgrenci.addRow([
          rowIdx,
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
        row.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' }
        row.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' }
        row.height = 22
      }
    }

    wsOgrenci.getColumn(1).width = 6
    wsOgrenci.getColumn(2).width = 12
    wsOgrenci.getColumn(3).width = 8
    wsOgrenci.getColumn(4).width = 26
    wsOgrenci.getColumn(5).width = 26
    wsOgrenci.getColumn(6).width = 16
    wsOgrenci.getColumn(7).width = 26
    wsOgrenci.getColumn(8).width = 24
    wsOgrenci.getColumn(9).width = 18
    wsOgrenci.getColumn(10).width = 18
    wsOgrenci.getColumn(11).width = 14

    // ==================== SAYFA 2: SINIF BAZLI OZET ====================
    const wsSinif = workbook.addWorksheet('Sinif Bazli', { properties: { tabColor: { argb: '8B5CF6' } } })

    wsSinif.mergeCells('A1:E1')
    const sinifTitle = wsSinif.getCell('A1')
    sinifTitle.value = `Sinif Bazli Ogrenci Sayisi - ${school.name}`
    sinifTitle.font = { bold: true, size: 14, color: { argb: primaryColor } }
    sinifTitle.alignment = { vertical: 'middle' }
    wsSinif.getRow(1).height = 32

    wsSinif.addRow([])

    const sinifHeaders = ['#', 'Sinif', 'Paket', 'Siparis Veren Ogrenci', 'Toplam Sinif Mevcudu']
    const sinifHeaderRow = wsSinif.addRow(sinifHeaders)
    sinifHeaderRow.eachCell((cell) => {
      cell.fill = headerFill
      cell.font = headerFont
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
      cell.border = borderStyle
    })
    sinifHeaderRow.height = 28

    school.classes.forEach((cls, idx) => {
      const row = wsSinif.addRow([
        idx + 1,
        safe(cls.name),
        safe(cls.package?.name || 'Paket yok'),
        cls.orders.length,
        '-'
      ])
      const stripeFill: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: idx % 2 === 0 ? 'F9FAFB' : 'FFFFFF' } }
      row.eachCell((cell, colNumber) => {
        cell.fill = stripeFill
        cell.border = borderStyle
        cell.alignment = { horizontal: colNumber <= 3 ? 'left' : 'center', vertical: 'middle' }
      })
      row.getCell(1).alignment = { horizontal: 'center' }
      row.height = 24
    })

    wsSinif.getColumn(1).width = 6
    wsSinif.getColumn(2).width = 18
    wsSinif.getColumn(3).width = 28
    wsSinif.getColumn(4).width = 22
    wsSinif.getColumn(5).width = 22

    // Tum sayfalara yazdir ayarlari
    ;[wsOgrenci, wsSinif].forEach(ws => {
      ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
    })

    const buffer = await workbook.xlsx.writeBuffer()

    const safeName = school.name.replace(/[^a-zA-Z0-9\u00C0-\u024F\u0400-\u04FF]/g, '_')
    const filename = `${safeName}_ogrenciler_${new Date().toISOString().slice(0, 10)}.xlsx`

    return new NextResponse(new Uint8Array(buffer as ArrayBuffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': buildContentDisposition(filename),
        'Content-Length': String((buffer as ArrayBuffer).byteLength),
        'Cache-Control': 'no-store'
      }
    })

  } catch (error) {
    console.error('Ogrenci export hatasi:', error)
    return NextResponse.json({ error: 'Export basarisiz' }, { status: 500 })
  }
}
