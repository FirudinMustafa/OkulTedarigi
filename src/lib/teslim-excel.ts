import ExcelJS from 'exceljs'
import { escapeCsvValue } from './security'

const safe = escapeCsvValue

// Class.name icindeki ilk rakam dizisini "sinif numarasi" olarak cikar.
// Ornek: "1-A" -> "1", "5. Sinif" -> "5", "Anaokulu" -> ""
function extractClassNumber(name: string): string {
  const m = name.match(/\d+/)
  return m ? m[0] : ''
}

// Teslim Excel'i icin gereken minimal siparis sekli
export interface TeslimOrder {
  orderNumber: string
  studentName: string | null
  studentSection: string | null
  class: { name: string; school: { name: string } }
  students: { firstName: string; lastName: string; section: string | null }[]
}

/**
 * Teslim Excel'i olusturur. Her satir = 1 ogrenci.
 * Sutunlar: Ogrencinin Okulu | Ogrenci Adi | Ogrenci Soyadi | Sinif | Sube |
 *           Siparis Adedi (= o siparisteki ogrenci sayisi) | Teslim Tarihi (BOS) | (✓ bos hucre)
 */
export async function buildTeslimExcel(orders: TeslimOrder[]): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Okul Tedarik Sistemi'

  const ws = workbook.addWorksheet('Teslim Listesi')

  const headerFill: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: '10B981' } }
  const headerFont: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFFFF' }, size: 11 }
  const borderStyle: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'D1D5DB' } },
    bottom: { style: 'thin', color: { argb: 'D1D5DB' } },
    left: { style: 'thin', color: { argb: 'D1D5DB' } },
    right: { style: 'thin', color: { argb: 'D1D5DB' } },
  }

  ws.columns = [
    { header: 'Öğrencinin Okulu', key: 'schoolName', width: 32 },
    { header: 'Öğrenci Adı', key: 'firstName', width: 18 },
    { header: 'Öğrenci Soyadı', key: 'lastName', width: 20 },
    { header: 'Sınıf', key: 'classNum', width: 8 },
    { header: 'Şube', key: 'section', width: 8 },
    { header: 'Sipariş Adedi', key: 'qty', width: 14 },
    { header: 'Teslim Tarihi', key: 'deliveryDate', width: 18 },
    { header: '✓', key: 'check', width: 6 },
  ]

  const headerRow = ws.getRow(1)
  headerRow.font = headerFont
  headerRow.fill = headerFill
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' }
  headerRow.height = 22
  headerRow.eachCell(cell => { cell.border = borderStyle })

  let rowIndex = 2
  for (const o of orders) {
    const classNum = extractClassNumber(o.class.name)
    const studentRows = o.students.length > 0
      ? o.students.map(s => ({ firstName: s.firstName, lastName: s.lastName, section: s.section || '' }))
      : (() => {
          // Eski tek-ogrenci siparisleri icin fallback: studentName "Ad Soyad"
          const parts = (o.studentName || '').trim().split(/\s+/)
          const lastName = parts.length > 1 ? parts.pop()! : ''
          const firstName = parts.join(' ')
          return [{ firstName, lastName, section: o.studentSection || '' }]
        })()

    const studentCount = studentRows.length

    for (const s of studentRows) {
      const row = ws.getRow(rowIndex++)
      row.values = {
        schoolName: safe(o.class.school.name),
        firstName: safe(s.firstName),
        lastName: safe(s.lastName),
        classNum,
        section: s.section,
        qty: studentCount,
        deliveryDate: '',   // Teslim Tarihi — bilerek bos (hicbir yerden veri almaz)
        check: '',          // Elle isaretlemek icin bos cerceveli hucre
      }
      row.eachCell(cell => { cell.border = borderStyle })
      // Bos sutunlarin da kenarligi gorunsun (deliveryDate + check)
      row.getCell('deliveryDate').border = borderStyle
      row.getCell('check').border = borderStyle
    }
  }

  ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }

  const buffer = await workbook.xlsx.writeBuffer()
  return buffer as ArrayBuffer
}
