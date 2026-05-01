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
    const period = searchParams.get('period') || 'all' // all | today | week | month

    const now = new Date()
    let dateFilter: Date | null = null
    let periodLabel = 'Tum Zamanlar'
    if (period === 'today') {
      dateFilter = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      periodLabel = 'Bugun'
    } else if (period === 'week') {
      dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      periodLabel = 'Son 7 Gun'
    } else if (period === 'month') {
      dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      periodLabel = 'Son 30 Gun'
    }

    const schools = await prisma.school.findMany({
      include: {
        classes: {
          include: {
            orders: {
              where: dateFilter ? { createdAt: { gte: dateFilter } } : undefined
            },
            package: true
          }
        }
      },
      orderBy: { name: 'asc' }
    })

    const statusLabels: Record<string, string> = { ...ORDER_STATUS_LABELS, REFUNDED: 'Iade' }

    const allOrders = schools.flatMap(s => s.classes.flatMap(c => c.orders))
    const totalOrders = allOrders.length
    const totalRevenue = allOrders
      .filter(o => !['CANCELLED', 'REFUNDED'].includes(o.status))
      .reduce((acc, o) => acc + Number(o.totalAmount), 0)
    const completedOrders = allOrders.filter(o => o.status === 'COMPLETED').length
    const cancelledOrders = allOrders.filter(o => o.status === 'CANCELLED').length

    // ---- Excel olustur ----
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

    // ==================== SAYFA 1: GENEL OZET ====================
    const wsOzet = workbook.addWorksheet('Genel Ozet', { properties: { tabColor: { argb: primaryColor } } })

    wsOzet.mergeCells('A1:D1')
    const titleCell = wsOzet.getCell('A1')
    titleCell.value = `Genel Rapor - ${periodLabel}`
    titleCell.font = { bold: true, size: 16, color: { argb: primaryColor } }
    titleCell.alignment = { horizontal: 'left', vertical: 'middle' }
    wsOzet.getRow(1).height = 35

    wsOzet.mergeCells('A2:D2')
    const subtitleCell = wsOzet.getCell('A2')
    subtitleCell.value = `Olusturma: ${new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })}`
    subtitleCell.font = { size: 10, color: { argb: '6B7280' }, italic: true }

    wsOzet.addRow([])

    const summaryData: Array<[string, string | number]> = [
      ['Toplam Okul', schools.length],
      ['Toplam Sinif', schools.reduce((a, s) => a + s.classes.length, 0)],
      ['Toplam Siparis', totalOrders],
      ['Tamamlanan Siparis', completedOrders],
      ['Iptal Edilen Siparis', cancelledOrders],
      ['Toplam Ciro', totalRevenue]
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
      const pct = totalOrders > 0 ? ((count / totalOrders) * 100).toFixed(1) : '0'
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

    // ==================== SAYFA 2: OKUL BAZLI ====================
    const wsOkul = workbook.addWorksheet('Okul Bazli', { properties: { tabColor: { argb: '8B5CF6' } } })

    wsOkul.mergeCells('A1:F1')
    const okulTitle = wsOkul.getCell('A1')
    okulTitle.value = `Okul Bazli Istatistikler - ${periodLabel}`
    okulTitle.font = { bold: true, size: 14, color: { argb: primaryColor } }
    okulTitle.alignment = { vertical: 'middle' }
    wsOkul.getRow(1).height = 32

    wsOkul.addRow([])

    const okulHeaders = ['#', 'Okul', 'Sinif', 'Siparis Adedi', 'Ciro (TL)', 'Komisyon (TL)']
    const okulHeaderRow = wsOkul.addRow(okulHeaders)
    okulHeaderRow.eachCell((cell) => {
      cell.fill = headerFill
      cell.font = headerFont
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
      cell.border = borderStyle
    })
    okulHeaderRow.height = 28

    const okulStat = schools.map(s => {
      const orders = s.classes.flatMap(c => c.orders)
      const validOrders = orders.filter(o => !['CANCELLED', 'REFUNDED'].includes(o.status))
      const ciro = validOrders.reduce((acc, o) => acc + Number(o.totalAmount), 0)
      // Komisyon: her sinifin commissionAmount * o sinifin gecerli siparis sayisi
      const komisyon = s.classes.reduce((acc, cls) => {
        const validClassOrders = cls.orders.filter(o => !['CANCELLED', 'REFUNDED'].includes(o.status))
        return acc + Number(cls.commissionAmount) * validClassOrders.length
      }, 0)
      return {
        name: s.name,
        sinif: s.classes.length,
        siparis: orders.length,
        ciro,
        komisyon
      }
    }).sort((a, b) => b.ciro - a.ciro)

    okulStat.forEach((s, idx) => {
      const row = wsOkul.addRow([idx + 1, safe(s.name), s.sinif, s.siparis, s.ciro, s.komisyon])
      const stripeFill: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: idx % 2 === 0 ? 'F9FAFB' : 'FFFFFF' } }
      row.eachCell((cell, colNumber) => {
        cell.fill = stripeFill
        cell.border = borderStyle
        cell.alignment = { horizontal: colNumber === 2 ? 'left' : 'center', vertical: 'middle' }
      })
      row.getCell(5).numFmt = currencyFormat
      row.getCell(6).numFmt = currencyFormat
      row.height = 24
    })

    // Toplam satiri
    const totalRow = wsOkul.addRow([
      '', 'TOPLAM',
      okulStat.reduce((a, s) => a + s.sinif, 0),
      okulStat.reduce((a, s) => a + s.siparis, 0),
      okulStat.reduce((a, s) => a + s.ciro, 0),
      okulStat.reduce((a, s) => a + s.komisyon, 0)
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
      cell.alignment = { horizontal: colNumber === 2 ? 'left' : 'center', vertical: 'middle' }
    })
    totalRow.getCell(5).numFmt = currencyFormat
    totalRow.getCell(6).numFmt = currencyFormat
    totalRow.height = 28

    wsOkul.getColumn(1).width = 6
    wsOkul.getColumn(2).width = 30
    wsOkul.getColumn(3).width = 12
    wsOkul.getColumn(4).width = 16
    wsOkul.getColumn(5).width = 20
    wsOkul.getColumn(6).width = 20

    ;[wsOzet, wsOkul].forEach(ws => {
      ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
    })

    const buffer = await workbook.xlsx.writeBuffer()
    const filename = `genel_rapor_${period}_${new Date().toISOString().slice(0, 10)}.xlsx`

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    })

  } catch (error) {
    console.error('Admin rapor export hatasi:', error)
    return NextResponse.json({ error: 'Export basarisiz' }, { status: 500 })
  }
}
