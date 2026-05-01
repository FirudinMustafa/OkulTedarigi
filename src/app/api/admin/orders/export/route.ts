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
    const status = searchParams.get('status')
    const schoolId = searchParams.get('schoolId')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')

    const where: Record<string, unknown> = {}

    if (status) {
      where.status = status
    }
    if (schoolId) {
      where.class = { schoolId }
    }
    if (dateFrom || dateTo) {
      where.createdAt = {}
      if (dateFrom) (where.createdAt as Record<string, Date>).gte = new Date(dateFrom)
      if (dateTo) (where.createdAt as Record<string, Date>).lte = new Date(dateTo)
    }

    const orders = await prisma.order.findMany({
      where,
      include: {
        class: {
          include: {
            school: { select: { name: true } }
          }
        },
        package: { select: { name: true } }
      },
      orderBy: { createdAt: 'desc' }
    })

    const statusLabels: Record<string, string> = { ...ORDER_STATUS_LABELS, REFUNDED: 'Iade' }
    const paymentLabels: Record<string, string> = {
      CREDIT_CARD: 'Kredi Karti'
    }

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

    // ==================== SAYFA 1: OZET ====================
    const wsOzet = workbook.addWorksheet('Ozet', { properties: { tabColor: { argb: primaryColor } } })

    wsOzet.mergeCells('A1:D1')
    const titleCell = wsOzet.getCell('A1')
    titleCell.value = 'Siparis Raporu - Admin Panel'
    titleCell.font = { bold: true, size: 16, color: { argb: primaryColor } }
    titleCell.alignment = { horizontal: 'left', vertical: 'middle' }
    wsOzet.getRow(1).height = 35

    const filters: string[] = []
    if (status) filters.push(`Durum: ${statusLabels[status] || status}`)
    if (schoolId) filters.push(`Okul filtreli`)
    if (dateFrom) filters.push(`Baslangic: ${dateFrom}`)
    if (dateTo) filters.push(`Bitis: ${dateTo}`)

    wsOzet.mergeCells('A2:D2')
    const subtitleCell = wsOzet.getCell('A2')
    subtitleCell.value = `Olusturma: ${new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })}${filters.length ? '  |  ' + filters.join(', ') : ''}`
    subtitleCell.font = { size: 10, color: { argb: '6B7280' }, italic: true }

    wsOzet.addRow([])

    // Ozet verileri
    const totalRevenue = orders
      .filter(o => !['CANCELLED', 'REFUNDED'].includes(o.status))
      .reduce((acc, o) => acc + Number(o.totalAmount), 0)
    const completedOrders = orders.filter(o => o.status === 'COMPLETED').length
    const cancelledOrders = orders.filter(o => o.status === 'CANCELLED').length
    const avgOrder = orders.length > 0 ? totalRevenue / orders.length : 0

    const summaryData = [
      ['Toplam Siparis', orders.length],
      ['Tamamlanan', completedOrders],
      ['Iptal Edilen', cancelledOrders],
      ['Toplam Ciro', totalRevenue],
      ['Ortalama Siparis Tutari', avgOrder]
    ]

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
      if (item[0] === 'Toplam Ciro' || item[0] === 'Ortalama Siparis Tutari') {
        row.getCell(3).numFmt = currencyFormat
        if (item[0] === 'Toplam Ciro') {
          row.getCell(3).font = { bold: true, size: 12, color: { argb: '16A34A' } }
        }
      }
      row.height = 24
    })

    wsOzet.addRow([])
    wsOzet.addRow([])

    // Durum dagilimi
    const ordersByStatus: Record<string, number> = {}
    orders.forEach(o => { ordersByStatus[o.status] = (ordersByStatus[o.status] || 0) + 1 })

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

    Object.entries(ordersByStatus).forEach(([s, count], idx) => {
      const pct = orders.length > 0 ? ((count / orders.length) * 100).toFixed(1) : '0'
      const row = wsOzet.addRow(['', statusLabels[s] || s, count, `%${pct}`])
      const stripeFill: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: idx % 2 === 0 ? 'F9FAFB' : 'FFFFFF' } }
      for (let c = 2; c <= 4; c++) {
        row.getCell(c).fill = stripeFill
        row.getCell(c).border = borderStyle
        row.getCell(c).alignment = { horizontal: 'center' }
      }
      row.getCell(2).alignment = { horizontal: 'left' }
      row.getCell(2).font = { color: { argb: statusColors[s] || '6B7280' }, bold: true }
      row.height = 22
    })

    wsOzet.getColumn(1).width = 3
    wsOzet.getColumn(2).width = 28
    wsOzet.getColumn(3).width = 20
    wsOzet.getColumn(4).width = 15

    // ==================== SAYFA 2: SIPARIS DETAY ====================
    const wsDetay = workbook.addWorksheet('Siparis Detay', { properties: { tabColor: { argb: '059669' } } })

    wsDetay.mergeCells('A1:S1')
    const detayTitle = wsDetay.getCell('A1')
    detayTitle.value = 'Siparis Detay Listesi'
    detayTitle.font = { bold: true, size: 14, color: { argb: primaryColor } }
    detayTitle.alignment = { vertical: 'middle' }
    wsDetay.getRow(1).height = 32

    wsDetay.addRow([])

    const detayHeaders = [
      'Siparis No', 'Durum', 'Veli Adi', 'Ogrenci Adi', 'Telefon', 'Email',
      'Okul', 'Sinif', 'Paket', 'Tutar (TL)', 'Indirim Kodu', 'Indirim (TL)',
      'Odeme Yontemi', 'Fatura No', 'Kargo Takip No',
      'Siparis Tarihi', 'Odeme Tarihi', 'Kargo Tarihi', 'Teslim Tarihi'
    ]

    const detayHeaderRow = wsDetay.addRow(detayHeaders)
    detayHeaderRow.eachCell((cell) => {
      cell.fill = headerFill
      cell.font = headerFont
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
      cell.border = borderStyle
    })
    detayHeaderRow.height = 32

    orders.forEach((o, idx) => {
      const row = wsDetay.addRow([
        safe(o.orderNumber),
        safe(statusLabels[o.status] || o.status),
        safe(o.parentName),
        safe(o.studentName),
        safe(o.phone),
        safe(o.email || ''),
        safe(o.class.school.name),
        safe(o.class.name),
        safe(o.package?.name || ''),
        Number(o.totalAmount),
        safe(o.discountCode || ''),
        o.discountAmount ? Number(o.discountAmount) : '',
        safe(o.paymentMethod ? (paymentLabels[o.paymentMethod] || o.paymentMethod) : ''),
        safe(o.invoiceNo || ''),
        safe(o.trackingNo || ''),
        new Date(o.createdAt).toLocaleDateString('tr-TR'),
        o.paidAt ? new Date(o.paidAt).toLocaleDateString('tr-TR') : '',
        o.shippedAt ? new Date(o.shippedAt).toLocaleDateString('tr-TR') : '',
        o.deliveredAt ? new Date(o.deliveredAt).toLocaleDateString('tr-TR') : ''
      ])

      const stripeFill: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: idx % 2 === 0 ? 'FFFFFF' : 'F9FAFB' } }
      row.eachCell((cell) => {
        cell.fill = stripeFill
        cell.border = borderStyle
        cell.alignment = { vertical: 'middle' }
      })

      // Durum rengi
      const statusCell = row.getCell(2)
      statusCell.font = { bold: true, color: { argb: statusColors[o.status] || '6B7280' } }

      // Para formatlari
      row.getCell(10).numFmt = currencyFormat
      row.getCell(10).alignment = { horizontal: 'right', vertical: 'middle' }
      if (o.discountAmount) {
        row.getCell(12).numFmt = currencyFormat
        row.getCell(12).alignment = { horizontal: 'right', vertical: 'middle' }
      }

      row.height = 22
    })

    // Toplam satiri
    if (orders.length > 0) {
      const totalDiscounts = orders.reduce((acc, o) => acc + (o.discountAmount ? Number(o.discountAmount) : 0), 0)
      const tRow = wsDetay.addRow([
        '', '', '', '', '', '', '', '', 'TOPLAM',
        totalRevenue,
        '', totalDiscounts || '',
        '', '', '', '', '', '', ''
      ])
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
      tRow.getCell(10).numFmt = currencyFormat
      if (totalDiscounts) tRow.getCell(12).numFmt = currencyFormat
      tRow.height = 28
    }

    // Sutun genislikleri
    const colWidths = [16, 18, 18, 18, 15, 22, 22, 12, 22, 14, 14, 12, 16, 14, 18, 13, 13, 13, 13]
    colWidths.forEach((w, i) => { wsDetay.getColumn(i + 1).width = w })

    // Yazdir ayarlari
    ;[wsOzet, wsDetay].forEach(ws => {
      ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
    })

    // ---- Buffer ----
    const buffer = await workbook.xlsx.writeBuffer()
    const filename = `siparisler_${new Date().toISOString().slice(0, 10)}.xlsx`

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    })

  } catch (error) {
    console.error('Export hatasi:', error)
    return NextResponse.json({ error: 'Export basarisiz' }, { status: 500 })
  }
}
