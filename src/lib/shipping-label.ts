import { jsPDF } from 'jspdf'
import JsBarcode from 'jsbarcode'

export interface LabelOrder {
  orderNumber: string
  parentName: string
  phone: string
  deliveryAddress: string | null
  trackingNo: string
  totalAmount: number
  shippedAt: string | null
  class: {
    name: string
    school: { name: string }
  }
  package?: { name: string }
}

// --- Font cache ---
let fontCache: { regular: string; bold: string } | null = null

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunkSize = 8192
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    binary += String.fromCharCode.apply(null, Array.from(chunk))
  }
  return btoa(binary)
}

async function loadFonts(): Promise<{ regular: string; bold: string }> {
  if (fontCache) return fontCache
  const [regBuf, boldBuf] = await Promise.all([
    fetch('/fonts/Roboto-Regular.ttf').then(r => r.arrayBuffer()),
    fetch('/fonts/Roboto-Bold.ttf').then(r => r.arrayBuffer())
  ])
  fontCache = {
    regular: arrayBufferToBase64(regBuf),
    bold: arrayBufferToBase64(boldBuf)
  }
  return fontCache
}

function registerFonts(doc: jsPDF, fonts: { regular: string; bold: string }) {
  doc.addFileToVFS('Roboto-Regular.ttf', fonts.regular)
  doc.addFileToVFS('Roboto-Bold.ttf', fonts.bold)
  doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal')
  doc.addFont('Roboto-Bold.ttf', 'Roboto', 'bold')
  doc.setFont('Roboto')
}

// --- Barkod (s\u0131k\u0131\u015ft\u0131r\u0131lm\u0131\u015f: daha k\u00fc\u00e7\u00fck, etikete s\u0131\u011facak \u015fekilde) ---
function generateBarcode(trackingNo: string): string {
  const canvas = document.createElement('canvas')
  JsBarcode(canvas, trackingNo, {
    format: 'CODE128',
    width: 2,
    height: 50,
    displayValue: true,
    fontSize: 12,
    font: 'monospace',
    textMargin: 4,
    margin: 6,
    background: '#ffffff'
  })
  return canvas.toDataURL('image/png')
}

// --- Etiket cizimi (100\u00d7150mm sayfaya tamamen sigacak sekilde optimize edildi) ---
// Sayfa: 100\u00d7150mm. I\u00e7 kullan\u0131labilir alan (margin 6): 88\u00d7138mm.
// Tum b\u00f6l\u00fcmler \u00f6l\u00e7\u00fclerek tasarland\u0131; uzun adresler max 3 sat\u0131ra truncate edilir.
function drawLabel(doc: jsPDF, order: LabelOrder, startY: number = 0) {
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const marginX = 6
  const marginTop = 6
  const contentW = pageW - marginX * 2
  let y = startY + marginTop

  // --- Baslik (kompakt) ---
  doc.setFillColor(30, 41, 59)
  doc.rect(marginX, y, contentW, 14, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(12)
  doc.setFont('Roboto', 'bold')
  doc.text('OKULTEDARIGIM.COM', pageW / 2, y + 6, { align: 'center' })
  doc.setFontSize(8)
  doc.setFont('Roboto', 'normal')
  doc.text('Kargo G\u00f6nderim Etiketi', pageW / 2, y + 11, { align: 'center' })
  y += 16

  // --- Barkod (kompakt: 28mm yukseklik, etikete sigsin) ---
  const barcodeBoxH = 30
  doc.setDrawColor(200)
  doc.setLineWidth(0.3)
  doc.rect(marginX, y, contentW, barcodeBoxH)

  try {
    const barcodeImg = generateBarcode(order.trackingNo)
    const barcodeW = 70
    const barcodeH = 26
    const barcodeX = (pageW - barcodeW) / 2
    doc.addImage(barcodeImg, 'PNG', barcodeX, y + 2, barcodeW, barcodeH)
  } catch {
    doc.setFontSize(10)
    doc.setTextColor(150)
    doc.text('[Barkod olu\u015fturulamad\u0131]', pageW / 2, y + barcodeBoxH / 2, { align: 'center' })
  }

  y += barcodeBoxH + 2

  // --- Alici ---
  doc.setFillColor(241, 245, 249)
  doc.rect(marginX, y, contentW, 6, 'F')
  doc.setFontSize(8)
  doc.setFont('Roboto', 'bold')
  doc.setTextColor(71, 85, 105)
  doc.text('ALICI', marginX + 3, y + 4.2)
  y += 7

  doc.setTextColor(0)
  doc.setFontSize(11)
  doc.setFont('Roboto', 'bold')
  doc.text(order.parentName, marginX + 3, y + 4)
  y += 6

  doc.setFontSize(9)
  doc.setFont('Roboto', 'normal')
  doc.text(order.phone, marginX + 3, y + 4)
  y += 6

  // Adres: maksimum 3 sat\u0131ra k\u0131rp; daha uzunsa "..." ekle
  const address = order.deliveryAddress || '-'
  const allLines = doc.splitTextToSize(address, contentW - 6) as string[]
  const addressLines = allLines.length <= 3
    ? allLines
    : [...allLines.slice(0, 2), allLines[2].slice(0, Math.max(0, allLines[2].length - 3)) + '...']
  doc.text(addressLines, marginX + 3, y + 4)
  y += addressLines.length * 4.2 + 2

  doc.setDrawColor(200)
  doc.line(marginX, y, marginX + contentW, y)
  y += 3

  // --- Siparis Bilgileri ---
  doc.setFillColor(241, 245, 249)
  doc.rect(marginX, y, contentW, 6, 'F')
  doc.setFontSize(8)
  doc.setFont('Roboto', 'bold')
  doc.setTextColor(71, 85, 105)
  doc.text('S\u0130PAR\u0130\u015e B\u0130LG\u0130LER\u0130', marginX + 3, y + 4.2)
  y += 8

  doc.setTextColor(0)
  doc.setFontSize(9)

  // Uzun degerler icin label-altina yazma (label sabit kolon, deger iki satira tasabilir)
  const labelX = marginX + 3
  const valueX = marginX + 22
  const valueMaxW = contentW - 22 - 3

  const infoLines: Array<[string, string]> = [
    ['Sipari\u015f No:', order.orderNumber],
    ['Okul:', order.class.school.name],
    ['S\u0131n\u0131f:', order.class.name],
    ['Paket:', order.package?.name || '-'],
    ['Tutar:', `${Number(order.totalAmount).toFixed(2)} TL`]
  ]

  for (const [label, value] of infoLines) {
    doc.setFont('Roboto', 'bold')
    doc.text(label, labelX, y + 3.2)
    doc.setFont('Roboto', 'normal')
    // Uzun deger 2 satira sigsin
    const valueLines = (doc.splitTextToSize(String(value), valueMaxW) as string[]).slice(0, 2)
    doc.text(valueLines, valueX, y + 3.2)
    y += valueLines.length === 1 ? 4.5 : 8.5
  }

  y += 1
  doc.setDrawColor(200)
  doc.line(marginX, y, marginX + contentW, y)
  y += 4

  // --- Alt bilgi ---
  const shipDate = order.shippedAt
    ? new Date(order.shippedAt).toLocaleDateString('tr-TR')
    : new Date().toLocaleDateString('tr-TR')

  doc.setFontSize(8)
  doc.setTextColor(100)
  doc.text(`G\u00f6nderim Tarihi: ${shipDate}`, marginX + 3, y + 2.5)
  doc.text('www.okultedarigim.com', pageW - marginX - 3, y + 2.5, { align: 'right' })

  // Dis cerceve - sayfa siniri ASILMASIN
  const frameBottom = Math.min(y + 5, startY + pageH - marginTop)
  doc.setDrawColor(30, 41, 59)
  doc.setLineWidth(0.6)
  doc.rect(marginX, startY + marginTop, contentW, frameBottom - (startY + marginTop))
}

// --- Dahili: PDF doc olustur ---
async function createLabelDoc(orders: LabelOrder[]): Promise<jsPDF> {
  const fonts = await loadFonts()

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [100, 150]
  })

  registerFonts(doc, fonts)

  orders.forEach((order, i) => {
    if (i > 0) doc.addPage([100, 150])
    drawLabel(doc, order)
  })

  return doc
}

// --- Preview: blob URL doner ---
export async function previewShippingLabel(order: LabelOrder): Promise<string> {
  const doc = await createLabelDoc([order])
  return doc.output('bloburl').toString()
}

export async function previewBulkLabels(orders: LabelOrder[]): Promise<string> {
  if (orders.length === 0) throw new Error('Siparis listesi bos')
  const doc = await createLabelDoc(orders)
  return doc.output('bloburl').toString()
}

// --- Toplu yazdir: PDF'i yeni sekmede acip yazdirma diyalogunu otomatik tetikler ---
export async function printBulkLabels(orders: LabelOrder[]): Promise<void> {
  if (orders.length === 0) throw new Error('Siparis listesi bos')
  const doc = await createLabelDoc(orders)
  // dataurlnewwindow PDF'i yeni sekmede acar; iframe ile auto-print:
  const blobUrl = doc.output('bloburl').toString()
  const printWindow = window.open(blobUrl, '_blank')
  if (printWindow) {
    // PDF yuklendikten sonra yazdir
    printWindow.addEventListener('load', () => {
      try { printWindow.focus(); printWindow.print() } catch { /* tarayici engellerse kullanici manuel basar */ }
    })
  }
}

// --- Download: PDF indir ---
export async function downloadShippingLabel(order: LabelOrder): Promise<void> {
  const doc = await createLabelDoc([order])
  doc.save(`etiket-${order.orderNumber}.pdf`)
}

export async function downloadBulkLabels(orders: LabelOrder[]): Promise<void> {
  if (orders.length === 0) return
  const doc = await createLabelDoc(orders)
  doc.save(`etiketler-toplu-${orders.length}-adet.pdf`)
}
