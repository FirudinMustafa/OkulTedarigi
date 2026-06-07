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

// --- Etiket cizimi (100\u00d780mm YATAY/manzara sayfaya sigacak sekilde optimize) ---
// Sayfa: 100mm en \u00d7 80mm boy. Iki sutunlu kompakt yerlesim:
//   ust: baslik + barkod (tam genislik), alt: sol=ALICI, sag=SIPARIS BILGILERI.
function drawLabel(doc: jsPDF, order: LabelOrder) {
  const pageW = doc.internal.pageSize.getWidth()   // 100
  const pageH = doc.internal.pageSize.getHeight()   // 80
  const m = 4
  const contentW = pageW - m * 2

  // Dis cerceve
  doc.setDrawColor(30, 41, 59)
  doc.setLineWidth(0.5)
  doc.rect(m, m, contentW, pageH - m * 2)

  // --- Baslik ---
  let y = m
  doc.setFillColor(30, 41, 59)
  doc.rect(m, y, contentW, 9, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(11)
  doc.setFont('Roboto', 'bold')
  doc.text('OKULTEDARIGIM.COM', pageW / 2, y + 4, { align: 'center' })
  doc.setFontSize(6.5)
  doc.setFont('Roboto', 'normal')
  doc.text('Kargo G\u00f6nderim Etiketi', pageW / 2, y + 7.3, { align: 'center' })
  y += 9

  // --- Barkod (tam genislik, kompakt) ---
  const barTop = y + 1.5
  const barH = 16
  const barW = 64
  try {
    const barcodeImg = generateBarcode(order.trackingNo)
    doc.addImage(barcodeImg, 'PNG', (pageW - barW) / 2, barTop, barW, barH)
  } catch {
    doc.setFontSize(9)
    doc.setTextColor(150)
    doc.text('[Barkod olu\u015fturulamad\u0131]', pageW / 2, barTop + barH / 2, { align: 'center' })
  }
  let secStart = barTop + barH + 1.5

  doc.setDrawColor(210)
  doc.setLineWidth(0.3)
  doc.line(m, secStart, pageW - m, secStart)
  secStart += 2

  // --- Iki sutun ---
  const colGap = 3
  const colW = (contentW - colGap) / 2
  const leftX = m
  const rightX = m + colW + colGap

  // SOL: ALICI
  let ly = secStart
  doc.setFillColor(241, 245, 249)
  doc.rect(leftX, ly, colW, 5, 'F')
  doc.setFontSize(7)
  doc.setFont('Roboto', 'bold')
  doc.setTextColor(71, 85, 105)
  doc.text('ALICI', leftX + 2, ly + 3.5)
  ly += 7.5

  doc.setTextColor(0)
  doc.setFontSize(9)
  doc.setFont('Roboto', 'bold')
  const nameLine = (doc.splitTextToSize(order.parentName, colW - 3) as string[]).slice(0, 1)
  doc.text(nameLine, leftX + 2, ly)
  ly += 4.5

  doc.setFontSize(8)
  doc.setFont('Roboto', 'normal')
  doc.text(order.phone, leftX + 2, ly)
  ly += 4.8

  doc.setFontSize(7)
  const address = order.deliveryAddress || '-'
  const allLines = doc.splitTextToSize(address, colW - 3) as string[]
  const addressLines = allLines.length <= 3
    ? allLines
    : [...allLines.slice(0, 2), allLines[2].slice(0, Math.max(0, allLines[2].length - 3)) + '...']
  doc.text(addressLines, leftX + 2, ly)

  // SAG: SIPARIS BILGILERI
  let ry = secStart
  doc.setFillColor(241, 245, 249)
  doc.rect(rightX, ry, colW, 5, 'F')
  doc.setFontSize(7)
  doc.setFont('Roboto', 'bold')
  doc.setTextColor(71, 85, 105)
  doc.text('S\u0130PAR\u0130\u015e B\u0130LG\u0130LER\u0130', rightX + 2, ry + 3.5)
  ry += 7.5

  doc.setTextColor(0)
  doc.setFontSize(7.5)
  const valX = rightX + 15
  const valW = colW - 15 - 2

  const infoLines: Array<[string, string]> = [
    ['Sipari\u015f No:', order.orderNumber],
    ['Okul:', order.class.school.name],
    ['S\u0131n\u0131f:', order.class.name],
    ['Paket:', order.package?.name || '-'],
    ['Tutar:', `${Number(order.totalAmount).toFixed(2)} TL`]
  ]
  for (const [label, value] of infoLines) {
    doc.setFont('Roboto', 'bold')
    doc.text(label, rightX + 2, ry)
    doc.setFont('Roboto', 'normal')
    const valLine = (doc.splitTextToSize(String(value), valW) as string[]).slice(0, 1)
    doc.text(valLine, valX, ry)
    ry += 4.7
  }

  // --- Alt bilgi ---
  const shipDate = order.shippedAt
    ? new Date(order.shippedAt).toLocaleDateString('tr-TR')
    : new Date().toLocaleDateString('tr-TR')

  doc.setFontSize(6.5)
  doc.setTextColor(100)
  doc.text(`G\u00f6nderim: ${shipDate}`, m + 2, pageH - m - 2)
  doc.text('www.okultedarigim.com', pageW - m - 2, pageH - m - 2, { align: 'right' })
}

// --- Dahili: PDF doc olustur ---
async function createLabelDoc(orders: LabelOrder[]): Promise<jsPDF> {
  const fonts = await loadFonts()

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: [100, 80]
  })

  registerFonts(doc, fonts)

  orders.forEach((order, i) => {
    if (i > 0) doc.addPage([100, 80], 'landscape')
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
