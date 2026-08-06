import ExcelJS from 'exceljs'
import { escapeCsvValue } from './security'
import { formatDateTime, formatPrice } from './utils'

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
  totalAmount: number | string | { toString(): string } // Prisma Decimal de kabul edilir
  createdAt: Date | string
  class: { name: string; school: { name: string; password: string } }
  students: { firstName: string; lastName: string; section: string | null }[]
}

/**
 * Teslim Excel'i olusturur. Her satir = 1 ogrenci.
 * Sutunlar: Ogrencinin Okulu | Ogrenci Adi | Ogrenci Soyadi | Sinif | Sube |
 *           Siparis Adedi (= o siparisteki ogrenci sayisi) | Siparis Tarihi/Saati |
 *           Okul Sifresi | Satis Fiyati | Teslim Tarihi (BOS) | (✓ bos hucre)
 */
export type DocLocale = 'tr' | 'en' | 'de' | 'ar'

export async function buildTeslimExcel(
  orders: TeslimOrder[],
  locale: DocLocale = 'tr',
): Promise<ArrayBuffer> {
  // --- Ceviriler (per-function) ---
  // Excel/xlsx unicode destekledigi icin Arapca (ar) gercek Arapca basliklarla saglanir.
  const T = {
    tr: {
      sheetName: 'Teslim Listesi',
      schoolName: 'Öğrencinin Okulu',
      firstName: 'Öğrenci Adı',
      lastName: 'Öğrenci Soyadı',
      classNum: 'Sınıf',
      section: 'Şube',
      qty: 'Sipariş Adedi',
      orderDate: 'Sipariş Tarihi/Saati',
      schoolPassword: 'Okul Şifresi',
      salePrice: 'Satış Fiyatı',
      deliveryDate: 'Teslim Tarihi',
      check: '✓',
    },
    en: {
      sheetName: 'Delivery List',
      schoolName: "Student's School",
      firstName: 'Student First Name',
      lastName: 'Student Last Name',
      classNum: 'Class',
      section: 'Section',
      qty: 'Order Quantity',
      orderDate: 'Order Date/Time',
      schoolPassword: 'School Password',
      salePrice: 'Sale Price',
      deliveryDate: 'Delivery Date',
      check: '✓',
    },
    de: {
      sheetName: 'Lieferliste',
      schoolName: 'Schule des Schülers',
      firstName: 'Vorname des Schülers',
      lastName: 'Nachname des Schülers',
      classNum: 'Klasse',
      section: 'Abteilung',
      qty: 'Bestellmenge',
      orderDate: 'Bestelldatum/-zeit',
      schoolPassword: 'Schulpasswort',
      salePrice: 'Verkaufspreis',
      deliveryDate: 'Lieferdatum',
      check: '✓',
    },
    ar: {
      sheetName: 'قائمة التسليم',
      schoolName: 'مدرسة الطالب',
      firstName: 'اسم الطالب',
      lastName: 'لقب الطالب',
      classNum: 'الصف',
      section: 'الشعبة',
      qty: 'كمية الطلب',
      orderDate: 'تاريخ/وقت الطلب',
      schoolPassword: 'كلمة مرور المدرسة',
      salePrice: 'سعر البيع',
      deliveryDate: 'تاريخ التسليم',
      check: '✓',
    },
  }
  const tr = T[locale] ?? T.tr

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Okul Tedarik Sistemi'

  const ws = workbook.addWorksheet(tr.sheetName)

  const headerFill: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: '10B981' } }
  const headerFont: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFFFF' }, size: 11 }
  const borderStyle: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'D1D5DB' } },
    bottom: { style: 'thin', color: { argb: 'D1D5DB' } },
    left: { style: 'thin', color: { argb: 'D1D5DB' } },
    right: { style: 'thin', color: { argb: 'D1D5DB' } },
  }

  ws.columns = [
    { header: tr.schoolName, key: 'schoolName', width: 32 },
    { header: tr.firstName, key: 'firstName', width: 18 },
    { header: tr.lastName, key: 'lastName', width: 20 },
    { header: tr.classNum, key: 'classNum', width: 8 },
    { header: tr.section, key: 'section', width: 8 },
    { header: tr.qty, key: 'qty', width: 14 },
    { header: tr.orderDate, key: 'orderDate', width: 20 },
    { header: tr.schoolPassword, key: 'schoolPassword', width: 16 },
    { header: tr.salePrice, key: 'salePrice', width: 14 },
    { header: tr.deliveryDate, key: 'deliveryDate', width: 18 },
    { header: tr.check, key: 'check', width: 6 },
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
        orderDate: safe(formatDateTime(o.createdAt, locale)),
        schoolPassword: safe(o.class.school.password),
        salePrice: safe(formatPrice(String(o.totalAmount), locale)),
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
