// Gerçek shipping-label.ts mantığıyla PDF üretir, jspdf'ten boyutları alır.
import { jsPDF } from 'jspdf'
import fs from 'fs'

const order = {
  orderNumber: 'ORD-2026-BNQ4RXKW',
  parentName: 'Mustafa Çelik',
  phone: '05451112233',
  deliveryAddress: 'Cumhuriyet Mahallesi, Atatürk Caddesi No:15 Kat:3 Daire:7, Çankaya, Ankara, 06520, Türkiye',
  trackingNo: 'KRG2026000002',
  totalAmount: 7500,
  shippedAt: new Date().toISOString(),
  class: { name: '2. Sınıf', school: { name: 'Atatürk İlkokulu' } },
  package: { name: 'Atatürk İlkokulu 2. Sınıf Paketi' },
}

// drawLabel'i kopyalıyoruz (barcode çizimi olmadan, çünkü Node'da canvas yok)
function drawLabel(doc, order, startY = 0) {
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const marginX = 6
  const marginTop = 6
  const contentW = pageW - marginX * 2
  let y = startY + marginTop

  // Header
  doc.setFillColor(30, 41, 59); doc.rect(marginX, y, contentW, 14, 'F')
  doc.setTextColor(255).setFontSize(12); doc.text('OKULTEDARIGIM.COM', pageW / 2, y + 6, { align: 'center' })
  doc.setFontSize(8); doc.text('Kargo Gönderim Etiketi', pageW / 2, y + 11, { align: 'center' })
  y += 16

  // Barcode placeholder
  doc.setDrawColor(200); doc.rect(marginX, y, contentW, 30)
  doc.text('[BARKOD]', pageW / 2, y + 17, { align: 'center' })
  y += 32

  // ALICI
  doc.setFillColor(241, 245, 249); doc.rect(marginX, y, contentW, 6, 'F')
  doc.setFontSize(8).setTextColor(71); doc.text('ALICI', marginX + 3, y + 4.2)
  y += 7
  doc.setTextColor(0).setFontSize(11); doc.text(order.parentName, marginX + 3, y + 4); y += 6
  doc.setFontSize(9); doc.text(order.phone, marginX + 3, y + 4); y += 6

  const allLines = doc.splitTextToSize(order.deliveryAddress, contentW - 6)
  const addr = allLines.length <= 3 ? allLines : [...allLines.slice(0, 2), allLines[2].slice(0, allLines[2].length - 3) + '...']
  doc.text(addr, marginX + 3, y + 4); y += addr.length * 4.2 + 2

  doc.line(marginX, y, marginX + contentW, y); y += 3

  // SIPARIS BILGILERI
  doc.setFillColor(241, 245, 249); doc.rect(marginX, y, contentW, 6, 'F')
  doc.setFontSize(8); doc.text('SİPARİŞ BİLGİLERİ', marginX + 3, y + 4.2); y += 8

  const valueX = marginX + 22
  const valueMaxW = contentW - 22 - 3
  doc.setFontSize(9)
  for (const [label, value] of [
    ['Sipariş No:', order.orderNumber],
    ['Okul:', order.class.school.name],
    ['Sınıf:', order.class.name],
    ['Paket:', order.package?.name || '-'],
    ['Tutar:', `${Number(order.totalAmount).toFixed(2)} TL`],
  ]) {
    doc.text(label, marginX + 3, y + 3.2)
    const valueLines = doc.splitTextToSize(String(value), valueMaxW).slice(0, 2)
    doc.text(valueLines, valueX, y + 3.2)
    y += valueLines.length === 1 ? 4.5 : 8.5
  }

  y += 1
  doc.line(marginX, y, marginX + contentW, y); y += 4

  doc.setFontSize(8).setTextColor(100)
  doc.text(`Gönderim Tarihi: ${new Date(order.shippedAt).toLocaleDateString('tr-TR')}`, marginX + 3, y + 2.5)
  doc.text('www.okultedarigim.com', pageW - marginX - 3, y + 2.5, { align: 'right' })

  return y + 5  // bottom of label content
}

const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [100, 150] })
const finalY = drawLabel(doc, order)
console.log(`Etiket alt sınırı: ${finalY.toFixed(1)}mm / 150mm`)
console.log(`${finalY <= 148 ? '✓' : '✗'} ${finalY <= 148 ? 'Sayfaya sığıyor' : 'TAŞIYOR'}`)
fs.writeFileSync('/tmp/etiket-test.pdf', Buffer.from(doc.output('arraybuffer')))
console.log('PDF: /tmp/etiket-test.pdf')
