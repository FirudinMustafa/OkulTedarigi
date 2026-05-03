import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getMudurSession } from '@/lib/auth'
import { ORDER_STATUS_LABELS } from '@/lib/constants'
import { escapeCsvValue, buildContentDisposition } from '@/lib/security'
import ExcelJS from 'exceljs'

const safe = escapeCsvValue

export async function GET(request: Request) {
  try {
    const session = await getMudurSession()
    if (!session || !session.schoolId) {
      return NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const year = searchParams.get('year')

    const school = await prisma.school.findUnique({
      where: { id: session.schoolId },
      include: {
        classes: {
          include: {
            orders: true,
            package: true
          }
        }
      }
    })

    if (!school) {
      return NextResponse.json({ error: 'Okul bulunamadi' }, { status: 404 })
    }

    const statusLabels: Record<string, string> = { ...ORDER_STATUS_LABELS, REFUNDED: 'Iade' }
    const yearLabel = year && year !== 'all' ? year : 'Tum Yillar'

    // ---- Excel olustur ----
    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'Okul Tedarik Sistemi'
    workbook.created = new Date()

    const primaryColor = '4F46E5' // indigo
    const headerFill: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: primaryColor } }
    const headerFont: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFFFF' }, size: 11 }
    const borderStyle: Partial<ExcelJS.Borders> = {
      top: { style: 'thin', color: { argb: 'D1D5DB' } },
      bottom: { style: 'thin', color: { argb: 'D1D5DB' } },
      left: { style: 'thin', color: { argb: 'D1D5DB' } },
      right: { style: 'thin', color: { argb: 'D1D5DB' } }
    }
    const currencyFormat = '#,##0.00 "TL"'

    // ==================== SAYFA 1: OZET ====================
    const wsOzet = workbook.addWorksheet('Ozet', { properties: { tabColor: { argb: primaryColor } } })

    // Baslik
    wsOzet.mergeCells('A1:D1')
    const titleCell = wsOzet.getCell('A1')
    titleCell.value = `${school.name} - Rapor Ozeti`
    titleCell.font = { bold: true, size: 16, color: { argb: primaryColor } }
    titleCell.alignment = { horizontal: 'left', vertical: 'middle' }
    wsOzet.getRow(1).height = 35

    wsOzet.mergeCells('A2:D2')
    const subtitleCell = wsOzet.getCell('A2')
    subtitleCell.value = `Donem: ${yearLabel}  |  Olusturma: ${new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })}`
    subtitleCell.font = { size: 10, color: { argb: '6B7280' }, italic: true }

    // Bos satir
    wsOzet.addRow([])

    // Ozet kartlari
    let allOrders = school.classes.flatMap(c => c.orders)
    if (year && year !== 'all') {
      const yearNum = parseInt(year)
      allOrders = allOrders.filter(o => new Date(o.createdAt).getFullYear() === yearNum)
    }

    const totalRevenue = allOrders
      .filter(o => !['CANCELLED', 'REFUNDED'].includes(o.status))
      .reduce((acc, o) => acc + Number(o.totalAmount), 0)
    const completedOrders = allOrders.filter(o => o.status === 'COMPLETED').length
    const cancelledOrders = allOrders.filter(o => o.status === 'CANCELLED').length

    const summaryData = [
      ['Toplam Siparis', allOrders.length],
      ['Tamamlanan Siparis', completedOrders],
      ['Iptal Edilen Siparis', cancelledOrders],
      ['Toplam Ciro', totalRevenue],
      ['Sinif Sayisi', school.classes.length],
      ['Teslimat Tipi', school.deliveryType === 'CARGO' ? 'Kargo ile Teslim' : 'Okula Teslim']
    ]

    // Ozet header
    const summaryHeaderRow = wsOzet.addRow(['', 'Metrik', 'Deger'])
    summaryHeaderRow.eachCell((cell, colNumber) => {
      if (colNumber >= 2) {
        cell.fill = headerFill
        cell.font = headerFont
        cell.alignment = { horizontal: 'center', vertical: 'middle' }
        cell.border = borderStyle
      }
    })
    summaryHeaderRow.height = 28

    summaryData.forEach((item, idx) => {
      const row = wsOzet.addRow(['', item[0], item[1]])
      const stripeFill: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: idx % 2 === 0 ? 'F9FAFB' : 'FFFFFF' } }
      row.getCell(2).fill = stripeFill
      row.getCell(2).font = { bold: true, size: 11 }
      row.getCell(2).border = borderStyle
      row.getCell(3).fill = stripeFill
      row.getCell(3).border = borderStyle
      row.getCell(3).alignment = { horizontal: 'center' }
      if (item[0] === 'Toplam Ciro') {
        row.getCell(3).numFmt = currencyFormat
        row.getCell(3).font = { bold: true, size: 12, color: { argb: '16A34A' } }
      }
      row.height = 24
    })

    wsOzet.addRow([])
    wsOzet.addRow([])

    // Durum dagilimi
    const statusHeader = wsOzet.addRow(['', 'Siparis Durumu', 'Adet', 'Oran (%)'])
    statusHeader.eachCell((cell, colNumber) => {
      if (colNumber >= 2) {
        cell.fill = headerFill
        cell.font = headerFont
        cell.alignment = { horizontal: 'center', vertical: 'middle' }
        cell.border = borderStyle
      }
    })
    statusHeader.height = 28

    const ordersByStatus: Record<string, number> = {}
    allOrders.forEach(o => { ordersByStatus[o.status] = (ordersByStatus[o.status] || 0) + 1 })

    Object.entries(ordersByStatus).forEach(([status, count], idx) => {
      const pct = allOrders.length > 0 ? ((count / allOrders.length) * 100).toFixed(1) : '0'
      const row = wsOzet.addRow(['', statusLabels[status] || status, count, `%${pct}`])
      const stripeFill: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: idx % 2 === 0 ? 'F9FAFB' : 'FFFFFF' } }
      for (let c = 2; c <= 4; c++) {
        row.getCell(c).fill = stripeFill
        row.getCell(c).border = borderStyle
        row.getCell(c).alignment = { horizontal: 'center' }
      }
      row.getCell(2).alignment = { horizontal: 'left' }
      row.height = 22
    })

    wsOzet.getColumn(1).width = 3
    wsOzet.getColumn(2).width = 28
    wsOzet.getColumn(3).width = 20
    wsOzet.getColumn(4).width = 15

    // ==================== SAYFA 2: SINIF BAZLI ====================
    const wsSinif = workbook.addWorksheet('Sinif Bazli', { properties: { tabColor: { argb: '8B5CF6' } } })

    wsSinif.mergeCells('A1:E1')
    const sinifTitle = wsSinif.getCell('A1')
    sinifTitle.value = `Sinif Bazli Istatistikler - ${yearLabel}`
    sinifTitle.font = { bold: true, size: 14, color: { argb: primaryColor } }
    sinifTitle.alignment = { vertical: 'middle' }
    wsSinif.getRow(1).height = 32

    wsSinif.addRow([])

    const sinifHeaders = ['#', 'Sinif', 'Paket', 'Siparis Adedi', 'Ciro (TL)']
    const sinifHeaderRow = wsSinif.addRow(sinifHeaders)
    sinifHeaderRow.eachCell((cell) => {
      cell.fill = headerFill
      cell.font = headerFont
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
      cell.border = borderStyle
    })
    sinifHeaderRow.height = 28

    const classStat = school.classes.map(cls => {
      let classOrders = cls.orders
      if (year && year !== 'all') {
        const yearNum = parseInt(year)
        classOrders = classOrders.filter(o => new Date(o.createdAt).getFullYear() === yearNum)
      }
      return {
        name: cls.name,
        packageName: cls.package?.name || 'Paket yok',
        orderCount: classOrders.length,
        revenue: classOrders
          .filter(o => !['CANCELLED', 'REFUNDED'].includes(o.status))
          .reduce((acc, o) => acc + Number(o.totalAmount), 0)
      }
    }).sort((a, b) => b.orderCount - a.orderCount)

    classStat.forEach((cls, idx) => {
      const row = wsSinif.addRow([idx + 1, safe(cls.name), safe(cls.packageName), cls.orderCount, cls.revenue])
      const stripeFill: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: idx % 2 === 0 ? 'F9FAFB' : 'FFFFFF' } }
      row.eachCell((cell, colNumber) => {
        cell.fill = stripeFill
        cell.border = borderStyle
        cell.alignment = { horizontal: colNumber <= 3 ? 'left' : 'center', vertical: 'middle' }
      })
      row.getCell(1).alignment = { horizontal: 'center' }
      row.getCell(5).numFmt = currencyFormat
      row.height = 24
    })

    // Toplam satiri
    const totalRow = wsSinif.addRow([
      '', '', 'TOPLAM',
      classStat.reduce((a, c) => a + c.orderCount, 0),
      totalRevenue
    ])
    totalRow.eachCell((cell, colNumber) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'EEF2FF' } }
      cell.font = { bold: true, size: 11, color: { argb: primaryColor } }
      cell.border = {
        top: { style: 'medium', color: { argb: primaryColor } },
        bottom: { style: 'medium', color: { argb: primaryColor } },
        left: { style: 'thin', color: { argb: 'D1D5DB' } },
        right: { style: 'thin', color: { argb: 'D1D5DB' } }
      }
      cell.alignment = { horizontal: colNumber <= 3 ? 'left' : 'center', vertical: 'middle' }
    })
    totalRow.getCell(5).numFmt = currencyFormat
    totalRow.height = 28

    wsSinif.getColumn(1).width = 6
    wsSinif.getColumn(2).width = 20
    wsSinif.getColumn(3).width = 30
    wsSinif.getColumn(4).width = 16
    wsSinif.getColumn(5).width = 20

    // ==================== SAYFA 3: DETAY ====================
    const wsDetay = workbook.addWorksheet('Siparis Detay', { properties: { tabColor: { argb: '059669' } } })

    wsDetay.mergeCells('A1:I1')
    const detayTitle = wsDetay.getCell('A1')
    detayTitle.value = `Tum Siparisler - ${yearLabel}`
    detayTitle.font = { bold: true, size: 14, color: { argb: primaryColor } }
    detayTitle.alignment = { vertical: 'middle' }
    wsDetay.getRow(1).height = 32

    wsDetay.addRow([])

    const detayHeaders = ['Siparis No', 'Sinif', 'Paket', 'Durum', 'Veli Adi', 'Ogrenci Adi', 'Telefon', 'Tutar (TL)', 'Tarih']
    const detayHeaderRow = wsDetay.addRow(detayHeaders)
    detayHeaderRow.eachCell((cell) => {
      cell.fill = headerFill
      cell.font = headerFont
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
      cell.border = borderStyle
    })
    detayHeaderRow.height = 28

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

    let rowIdx = 0
    for (const cls of school.classes) {
      let orders = cls.orders
      if (year && year !== 'all') {
        const yearNum = parseInt(year)
        orders = orders.filter(o => new Date(o.createdAt).getFullYear() === yearNum)
      }
      orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

      for (const o of orders) {
        const row = wsDetay.addRow([
          safe(o.orderNumber),
          safe(cls.name),
          safe(cls.package?.name || ''),
          safe(statusLabels[o.status] || o.status),
          safe(o.parentName),
          safe(o.studentName),
          safe(o.phone),
          Number(o.totalAmount),
          new Date(o.createdAt).toLocaleDateString('tr-TR')
        ])

        const stripeFill: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowIdx % 2 === 0 ? 'FFFFFF' : 'F9FAFB' } }
        row.eachCell((cell) => {
          cell.fill = stripeFill
          cell.border = borderStyle
          cell.alignment = { vertical: 'middle' }
        })

        // Durum hucresini renklendir
        const statusCell = row.getCell(4)
        const statusColor = statusColors[o.status] || '6B7280'
        statusCell.font = { bold: true, color: { argb: statusColor } }

        // Tutar format
        row.getCell(8).numFmt = currencyFormat
        row.getCell(8).alignment = { horizontal: 'right', vertical: 'middle' }

        row.height = 22
        rowIdx++
      }
    }

    wsDetay.getColumn(1).width = 18
    wsDetay.getColumn(2).width = 14
    wsDetay.getColumn(3).width = 25
    wsDetay.getColumn(4).width = 18
    wsDetay.getColumn(5).width = 20
    wsDetay.getColumn(6).width = 20
    wsDetay.getColumn(7).width = 16
    wsDetay.getColumn(8).width = 16
    wsDetay.getColumn(9).width = 14

    // Tum sayfalara yazdir ayarlari
    ;[wsOzet, wsSinif, wsDetay].forEach(ws => {
      ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
    })

    // ---- Buffer olustur ----
    const buffer = await workbook.xlsx.writeBuffer()

    const safeName = school.name.replace(/[^a-zA-Z0-9\u00C0-\u024F\u0400-\u04FF]/g, '_')
    const filename = `${safeName}_rapor_${new Date().toISOString().slice(0, 10)}.xlsx`

    return new NextResponse(new Uint8Array(buffer as ArrayBuffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': buildContentDisposition(filename),
        'Content-Length': String((buffer as ArrayBuffer).byteLength),
        'Cache-Control': 'no-store'
      }
    })

  } catch (error) {
    console.error('Rapor export hatasi:', error)
    return NextResponse.json({ error: 'Export basarisiz' }, { status: 500 })
  }
}
