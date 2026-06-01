/**
 * Teslim Tutanagi PDF Olusturucu (Server-side)
 * jsPDF ile PDF olusturur ve Base64 olarak dondurur.
 */

import { jsPDF } from 'jspdf'
import 'jspdf-autotable'

// jspdf-autotable icin tip genisletmesi
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: Record<string, unknown>) => void
    lastAutoTable: { finalY: number }
  }
}

/** PDF DoS koruması: cok uzun stringleri kirp */
function clip(value: string | null | undefined, max: number): string {
  if (!value) return ''
  const s = String(value)
  return s.length > max ? s.slice(0, max - 1) + '…' : s
}

export interface DeliveryPdfData {
  documentNo: string
  deliveryDate: string
  receivedBy: string
  notes?: string | null
  schoolName?: string
  className?: string
  orders: Array<{
    orderNumber: string
    studentName: string
    parentName: string
    totalAmount: number | string
    className?: string
    schoolName?: string
    items?: Array<{ name: string; quantity: number }>
  }>
}

export function generateDeliveryPdf(data: DeliveryPdfData): Buffer {
  const doc = new jsPDF()

  // Baslik
  doc.setFontSize(18)
  doc.text('TESLIM TUTANAGI', 105, 20, { align: 'center' })

  // Belge bilgileri (DoS koruması: tum stringler clipped)
  doc.setFontSize(10)
  doc.text(`Belge No: ${clip(data.documentNo, 50)}`, 14, 35)
  doc.text(`Teslim Tarihi: ${new Date(data.deliveryDate).toLocaleDateString('tr-TR')}`, 14, 42)
  doc.text(`Teslim Alan: ${clip(data.receivedBy, 80)}`, 14, 49)
  doc.text(`Toplam Paket: ${data.orders.length}`, 14, 56)

  if (data.schoolName) {
    doc.text(`Okul: ${clip(data.schoolName, 80)}`, 120, 35)
  }
  if (data.className) {
    doc.text(`Sinif: ${clip(data.className, 50)}`, 120, 42)
  }

  doc.text(`Olusturma Tarihi: ${new Date().toLocaleDateString('tr-TR')}`, 120, 49)

  // Cizgi
  doc.setLineWidth(0.5)
  doc.line(14, 62, 196, 62)

  // Ogrenci tablosu (DoS koruması: max 1000 satir + clipped strings)
  const limitedOrders = data.orders.slice(0, 1000)
  const tableData = limitedOrders.map((order, index) => [
    String(index + 1),
    clip(order.orderNumber, 30),
    clip(order.studentName, 60),
    clip(order.parentName, 50),
    clip(
      (order.items && order.items.length > 0)
        ? order.items.map(it => `${it.name} x${it.quantity}`).join(', ')
        : '-',
      200
    ),
    clip(order.className || data.className, 25),
    `${Number(order.totalAmount).toFixed(2)} TL`
  ])

  doc.autoTable({
    startY: 68,
    head: [['#', 'Siparis No', 'Ogrenci', 'Veli', 'Icerik', 'Sinif', 'Tutar']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [41, 128, 185],
      textColor: 255,
      fontSize: 9,
      fontStyle: 'bold'
    },
    bodyStyles: {
      fontSize: 8
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 26 },
      2: { cellWidth: 28 },
      3: { cellWidth: 28 },
      4: { cellWidth: 45 },
      5: { cellWidth: 16 },
      6: { cellWidth: 22, halign: 'right' }
    },
    margin: { left: 14, right: 14 }
  })

  // Toplam tutar
  const finalY = doc.lastAutoTable.finalY + 10
  const totalAmount = data.orders.reduce((sum, o) => sum + Number(o.totalAmount), 0)
  doc.setFontSize(11)
  doc.text(`Toplam Tutar: ${totalAmount.toFixed(2)} TL`, 196, finalY, { align: 'right' })

  // Notlar (DoS koruması)
  if (data.notes) {
    doc.setFontSize(9)
    doc.text(`Notlar: ${clip(data.notes, 500)}`, 14, finalY + 10)
  }

  // Imza alani
  const signatureY = finalY + (data.notes ? 30 : 20)
  doc.setLineWidth(0.3)
  doc.line(14, signatureY + 15, 80, signatureY + 15)
  doc.line(120, signatureY + 15, 196, signatureY + 15)
  doc.setFontSize(9)
  doc.text('Teslim Eden', 47, signatureY + 22, { align: 'center' })
  doc.text('Teslim Alan', 158, signatureY + 22, { align: 'center' })
  doc.text(clip(data.receivedBy, 50), 158, signatureY + 28, { align: 'center' })

  // Footer
  doc.setFontSize(7)
  doc.text('Bu belge Okul Tedarik Sistemi tarafindan otomatik olusturulmustur.', 105, 285, { align: 'center' })

  // Buffer olarak dondur
  const arrayBuffer = doc.output('arraybuffer')
  return Buffer.from(arrayBuffer)
}
