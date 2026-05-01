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

// --- Barkod ---
function generateBarcode(trackingNo: string): string {
  const canvas = document.createElement('canvas')
  JsBarcode(canvas, trackingNo, {
    format: 'CODE128',
    width: 3,
    height: 80,
    displayValue: true,
    fontSize: 14,
    font: 'monospace',
    textMargin: 6,
    margin: 10,
    background: '#ffffff'
  })
  return canvas.toDataURL('image/png')
}

// --- Etiket cizimi ---
function drawLabel(doc: jsPDF, order: LabelOrder, startY: number = 0) {
  const pageW = doc.internal.pageSize.getWidth()
  const marginX = 10
  const contentW = pageW - marginX * 2
  let y = startY + 10

  // --- Baslik ---
  doc.setFillColor(30, 41, 59)
  doc.rect(marginX, y, contentW, 18, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(14)
  doc.setFont('Roboto', 'bold')
  doc.text('OKULTEDARIGIM.COM', pageW / 2, y + 7, { align: 'center' })
  doc.setFontSize(9)
  doc.setFont('Roboto', 'normal')
  doc.text('Kargo G\u00f6nderim Etiketi', pageW / 2, y + 14, { align: 'center' })
  y += 22

  // --- Barkod ---
  doc.setDrawColor(200)
  doc.setLineWidth(0.3)
  doc.rect(marginX, y, contentW, 44)

  try {
    const barcodeImg = generateBarcode(order.trackingNo)
    const barcodeW = 70
    const barcodeX = (pageW - barcodeW) / 2
    doc.addImage(barcodeImg, 'PNG', barcodeX, y + 2, barcodeW, 40)
  } catch {
    doc.setFontSize(10)
    doc.setTextColor(150)
    doc.text('[Barkod olu\u015fturulamad\u0131]', pageW / 2, y + 20, { align: 'center' })
  }

  y += 48

  // --- Alici ---
  doc.setFillColor(241, 245, 249)
  doc.rect(marginX, y, contentW, 8, 'F')
  doc.setFontSize(9)
  doc.setFont('Roboto', 'bold')
  doc.setTextColor(71, 85, 105)
  doc.text('ALICI', marginX + 4, y + 5.5)
  y += 10

  doc.setTextColor(0)
  doc.setFontSize(12)
  doc.setFont('Roboto', 'bold')
  doc.text(order.parentName, marginX + 4, y + 5)
  y += 8

  doc.setFontSize(10)
  doc.setFont('Roboto', 'normal')
  doc.text(order.phone, marginX + 4, y + 5)
  y += 8

  const address = order.deliveryAddress || '-'
  const addressLines = doc.splitTextToSize(address, contentW - 8)
  doc.text(addressLines, marginX + 4, y + 5)
  y += addressLines.length * 5 + 4

  doc.setDrawColor(200)
  doc.line(marginX, y, marginX + contentW, y)
  y += 4

  // --- Siparis Bilgileri ---
  doc.setFillColor(241, 245, 249)
  doc.rect(marginX, y, contentW, 8, 'F')
  doc.setFontSize(9)
  doc.setFont('Roboto', 'bold')
  doc.setTextColor(71, 85, 105)
  doc.text('S\u0130PAR\u0130\u015e B\u0130LG\u0130LER\u0130', marginX + 4, y + 5.5)
  y += 12

  doc.setTextColor(0)
  doc.setFontSize(10)
  doc.setFont('Roboto', 'normal')

  const infoLines = [
    ['Sipari\u015f No:', order.orderNumber],
    ['Okul:', order.class.school.name],
    ['S\u0131n\u0131f:', order.class.name],
    ['Paket:', order.package?.name || '-'],
    ['Tutar:', `${Number(order.totalAmount).toFixed(2)} TL`]
  ]

  for (const [label, value] of infoLines) {
    doc.setFont('Roboto', 'bold')
    doc.text(label, marginX + 4, y + 4)
    doc.setFont('Roboto', 'normal')
    doc.text(value, marginX + 40, y + 4)
    y += 6
  }

  y += 2
  doc.setDrawColor(200)
  doc.line(marginX, y, marginX + contentW, y)
  y += 6

  // --- Alt bilgi ---
  const shipDate = order.shippedAt
    ? new Date(order.shippedAt).toLocaleDateString('tr-TR')
    : new Date().toLocaleDateString('tr-TR')

  doc.setFontSize(9)
  doc.setTextColor(100)
  doc.text(`G\u00f6nderim Tarihi: ${shipDate}`, marginX + 4, y + 3)
  doc.text('www.okultedarigim.com', pageW - marginX - 4, y + 3, { align: 'right' })

  // Dis cerceve
  const totalH = y + 8 - startY - 10
  doc.setDrawColor(30, 41, 59)
  doc.setLineWidth(0.8)
  doc.rect(marginX, startY + 10, contentW, totalH)
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
