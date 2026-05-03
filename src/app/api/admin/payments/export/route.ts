import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/auth'
import { escapeCsvValue, buildContentDisposition } from '@/lib/security'
import ExcelJS from 'exceljs'

const safe = escapeCsvValue

export async function GET() {
  try {
    const session = await getAdminSession()
    if (!session) {
      return NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 401 })
    }

    // Tum aktif okullari hesapla
    const schools = await prisma.school.findMany({
      where: { isActive: true },
      include: {
        classes: {
          include: {
            orders: {
              where: {
                status: {
                  in: ['PAID', 'CONFIRMED', 'INVOICED', 'SHIPPED', 'DELIVERED', 'COMPLETED']
                }
              }
            }
          }
        },
        schoolPayments: { orderBy: { createdAt: 'desc' } }
      },
      orderBy: { name: 'asc' }
    })

    // ---- Excel olustur ----
    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'Okul Tedarik Sistemi'
    workbook.created = new Date()

    const primaryColor = 'EAB308' // amber
    const headerFill: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: primaryColor } }
    const headerFont: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFFFF' }, size: 11 }
    const borderStyle: Partial<ExcelJS.Borders> = {
      top: { style: 'thin', color: { argb: 'D1D5DB' } },
      bottom: { style: 'thin', color: { argb: 'D1D5DB' } },
      left: { style: 'thin', color: { argb: 'D1D5DB' } },
      right: { style: 'thin', color: { argb: 'D1D5DB' } }
    }
    const currencyFormat = '#,##0.00 "TL"'

    // ==================== SAYFA 1: HAKEDIS OZETI ====================
    const wsOzet = workbook.addWorksheet('Hakedis Ozeti', { properties: { tabColor: { argb: primaryColor } } })

    wsOzet.mergeCells('A1:G1')
    const titleCell = wsOzet.getCell('A1')
    titleCell.value = 'Hakedis Ozeti - Okul Bazli'
    titleCell.font = { bold: true, size: 16, color: { argb: '92400E' } }
    titleCell.alignment = { horizontal: 'left', vertical: 'middle' }
    wsOzet.getRow(1).height = 35

    wsOzet.mergeCells('A2:G2')
    const subtitleCell = wsOzet.getCell('A2')
    subtitleCell.value = `Olusturma: ${new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })}`
    subtitleCell.font = { size: 10, color: { argb: '6B7280' }, italic: true }

    wsOzet.addRow([])

    const headers = ['#', 'Okul', 'Siparis Sayisi', 'Toplam Ciro (TL)', 'Toplam Hakedis (TL)', 'Verilen (TL)', 'Kalan (TL)']
    const headerRow = wsOzet.addRow(headers)
    headerRow.eachCell((cell) => {
      cell.fill = headerFill
      cell.font = headerFont
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
      cell.border = borderStyle
    })
    headerRow.height = 28

    let totalOrdersAll = 0
    let totalRevenueAll = 0
    let totalCommissionAll = 0
    let totalPaidAll = 0
    let totalPendingAll = 0

    schools.forEach((school, idx) => {
      let totalCommission = 0
      let totalOrders = 0
      let totalRevenue = 0

      school.classes.forEach(cls => {
        const classOrders = cls.orders
        totalOrders += classOrders.length
        totalCommission += Number(cls.commissionAmount) * classOrders.length
        totalRevenue += classOrders.reduce((acc, o) => acc + Number(o.totalAmount), 0)
      })

      const paid = school.schoolPayments
        .filter(p => p.status === 'PAID')
        .reduce((acc, p) => acc + Number(p.amount), 0)
      const pending = totalCommission - paid > 0 ? totalCommission - paid : 0

      totalOrdersAll += totalOrders
      totalRevenueAll += totalRevenue
      totalCommissionAll += totalCommission
      totalPaidAll += paid
      totalPendingAll += pending

      const row = wsOzet.addRow([idx + 1, safe(school.name), totalOrders, totalRevenue, totalCommission, paid, pending])
      const stripeFill: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: idx % 2 === 0 ? 'FEF3C7' : 'FFFFFF' } }
      row.eachCell((cell, colNumber) => {
        cell.fill = stripeFill
        cell.border = borderStyle
        cell.alignment = { horizontal: colNumber === 2 ? 'left' : 'center', vertical: 'middle' }
      })
      row.getCell(4).numFmt = currencyFormat
      row.getCell(5).numFmt = currencyFormat
      row.getCell(6).numFmt = currencyFormat
      row.getCell(7).numFmt = currencyFormat
      row.getCell(6).font = { bold: true, color: { argb: '16A34A' } }
      row.getCell(7).font = { bold: true, color: { argb: 'D97706' } }
      row.height = 24
    })

    // Toplam satiri
    const totalRow = wsOzet.addRow(['', 'TOPLAM', totalOrdersAll, totalRevenueAll, totalCommissionAll, totalPaidAll, totalPendingAll])
    totalRow.eachCell((cell, colNumber) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FDE68A' } }
      cell.font = { bold: true, size: 11, color: { argb: '92400E' } }
      cell.border = {
        top: { style: 'medium', color: { argb: primaryColor } },
        bottom: { style: 'medium', color: { argb: primaryColor } },
        left: { style: 'thin', color: { argb: 'D1D5DB' } },
        right: { style: 'thin', color: { argb: 'D1D5DB' } }
      }
      cell.alignment = { horizontal: colNumber === 2 ? 'left' : 'center', vertical: 'middle' }
    })
    totalRow.getCell(4).numFmt = currencyFormat
    totalRow.getCell(5).numFmt = currencyFormat
    totalRow.getCell(6).numFmt = currencyFormat
    totalRow.getCell(7).numFmt = currencyFormat
    totalRow.height = 28

    wsOzet.getColumn(1).width = 6
    wsOzet.getColumn(2).width = 30
    wsOzet.getColumn(3).width = 14
    wsOzet.getColumn(4).width = 18
    wsOzet.getColumn(5).width = 20
    wsOzet.getColumn(6).width = 18
    wsOzet.getColumn(7).width = 18

    // ==================== SAYFA 2: ODEME GECMISI ====================
    const wsOdeme = workbook.addWorksheet('Odeme Gecmisi', { properties: { tabColor: { argb: '16A34A' } } })

    wsOdeme.mergeCells('A1:F1')
    const odemeTitle = wsOdeme.getCell('A1')
    odemeTitle.value = 'Odeme Gecmisi'
    odemeTitle.font = { bold: true, size: 14, color: { argb: '92400E' } }
    odemeTitle.alignment = { vertical: 'middle' }
    wsOdeme.getRow(1).height = 32

    wsOdeme.addRow([])

    const odemeHeaders = ['#', 'Okul', 'Donem', 'Tutar (TL)', 'Durum', 'Olusturma Tarihi']
    const odemeHeaderRow = wsOdeme.addRow(odemeHeaders)
    odemeHeaderRow.eachCell((cell) => {
      cell.fill = headerFill
      cell.font = headerFont
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
      cell.border = borderStyle
    })
    odemeHeaderRow.height = 28

    const allPayments = schools.flatMap(s =>
      s.schoolPayments.map(p => ({
        schoolName: s.name,
        period: p.period,
        amount: Number(p.amount),
        status: p.status,
        createdAt: p.createdAt
      }))
    ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    allPayments.forEach((p, idx) => {
      const row = wsOdeme.addRow([
        idx + 1,
        safe(p.schoolName),
        safe(p.period || ''),
        p.amount,
        p.status === 'PAID' ? 'Odendi' : 'Bekliyor',
        new Date(p.createdAt).toLocaleDateString('tr-TR')
      ])
      const stripeFill: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: idx % 2 === 0 ? 'F9FAFB' : 'FFFFFF' } }
      row.eachCell((cell, colNumber) => {
        cell.fill = stripeFill
        cell.border = borderStyle
        cell.alignment = { horizontal: colNumber === 2 ? 'left' : 'center', vertical: 'middle' }
      })
      row.getCell(4).numFmt = currencyFormat
      row.getCell(5).font = {
        bold: true,
        color: { argb: p.status === 'PAID' ? '16A34A' : 'D97706' }
      }
      row.height = 22
    })

    wsOdeme.getColumn(1).width = 6
    wsOdeme.getColumn(2).width = 30
    wsOdeme.getColumn(3).width = 14
    wsOdeme.getColumn(4).width = 18
    wsOdeme.getColumn(5).width = 14
    wsOdeme.getColumn(6).width = 18

    ;[wsOzet, wsOdeme].forEach(ws => {
      ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
    })

    const buffer = await workbook.xlsx.writeBuffer()
    const filename = `hakedisler_${new Date().toISOString().slice(0, 10)}.xlsx`

    return new NextResponse(new Uint8Array(buffer as ArrayBuffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': buildContentDisposition(filename),
        'Content-Length': String((buffer as ArrayBuffer).byteLength),
        'Cache-Control': 'no-store'
      }
    })

  } catch (error) {
    console.error('Hakedis export hatasi:', error)
    return NextResponse.json({ error: 'Export basarisiz' }, { status: 500 })
  }
}
