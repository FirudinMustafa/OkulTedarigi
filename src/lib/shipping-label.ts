import { jsPDF } from 'jspdf'
import JsBarcode from 'jsbarcode'

export type DocLocale = 'tr' | 'en' | 'de' | 'ar'

// --- Etiket cevirileri (per-function paylasimli) ---
// NOT: jsPDF varsayilan (Roboto) fontu Arapca glifleri guvenilir sekilde render
// edemez; bu yuzden Arapca (ar) UI etiketleri icin Ingilizce'ye geri donulur
// (T.ar = T.en). Dinamik veriler (isim, okul, adres, takip no) oldugu gibi kalir.
const L_en = {
  headerSub: 'Shipping Label',
  recipient: 'RECIPIENT',
  orderInfo: 'ORDER INFO',
  orderNo: 'Order No:',
  school: 'School:',
  class: 'Class:',
  package: 'Package:',
  amount: 'Amount:',
  shipped: 'Shipped:',
  barcodeError: '[Barcode could not be generated]',
  pageTitle: 'Shipping Labels',
}
const LABEL_T = {
  tr: {
    headerSub: 'Kargo Gönderim Etiketi',
    recipient: 'ALICI',
    orderInfo: 'SİPARİŞ BİLGİLERİ',
    orderNo: 'Sipariş No:',
    school: 'Okul:',
    class: 'Sınıf:',
    package: 'Paket:',
    amount: 'Tutar:',
    shipped: 'Gönderim:',
    barcodeError: '[Barkod oluşturulamadı]',
    pageTitle: 'Kargo Etiketleri',
  },
  en: L_en,
  de: {
    headerSub: 'Versandetikett',
    recipient: 'EMPFÄNGER',
    orderInfo: 'BESTELLINFO',
    orderNo: 'Bestell-Nr.:',
    school: 'Schule:',
    class: 'Klasse:',
    package: 'Paket:',
    amount: 'Betrag:',
    shipped: 'Versand:',
    barcodeError: '[Barcode konnte nicht erstellt werden]',
    pageTitle: 'Versandetiketten',
  },
  // ar -> en fallback: jsPDF Arapca glif sinirlamasi
  ar: L_en,
}

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
    fontSize: 15,
    font: 'monospace',
    textMargin: 4,
    margin: 6,
    background: '#ffffff',
    lineColor: '#000000'
  })
  return canvas.toDataURL('image/png')
}

// --- Etiket cizimi (100\u00d7100mm kare etikete sigacak sekilde optimize) ---
// Sayfa: 100mm en \u00d7 100mm boy. Iki sutunlu kompakt yerlesim:
//   ust: baslik + barkod (tam genislik), alt: sol=ALICI, sag=SIPARIS BILGILERI.
function drawLabel(doc: jsPDF, order: LabelOrder, locale: DocLocale = 'tr') {
  const tr = LABEL_T[locale] ?? LABEL_T.tr
  const pageW = doc.internal.pageSize.getWidth()   // 100
  const pageH = doc.internal.pageSize.getHeight()   // 100
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
  doc.text(tr.headerSub, pageW / 2, y + 7.3, { align: 'center' })
  y += 9

  // --- Barkod (tam genislik) ---
  const barTop = y + 2
  const barH = 20
  const barW = 70
  try {
    const barcodeImg = generateBarcode(order.trackingNo)
    doc.addImage(barcodeImg, 'PNG', (pageW - barW) / 2, barTop, barW, barH)
  } catch {
    doc.setFontSize(9)
    doc.setTextColor(150)
    doc.text(tr.barcodeError, pageW / 2, barTop + barH / 2, { align: 'center' })
  }
  let secStart = barTop + barH + 2

  doc.setDrawColor(210)
  doc.setLineWidth(0.3)
  doc.line(m, secStart, pageW - m, secStart)
  secStart += 3

  // --- Iki sutun ---
  const colGap = 4
  const colW = (contentW - colGap) / 2
  const leftX = m
  const rightX = m + colW + colGap

  // SOL: ALICI
  let ly = secStart
  doc.setFillColor(255, 255, 255)
  doc.rect(leftX, ly, colW, 6, 'F')
  doc.setFontSize(7)
  doc.setFont('Roboto', 'bold')
  doc.setTextColor(71, 85, 105)
  doc.text(tr.recipient, leftX + 2, ly + 4)
  ly += 8

  doc.setTextColor(0)
  doc.setFontSize(10)
  doc.setFont('Roboto', 'bold')
  const nameLine = (doc.splitTextToSize(order.parentName, colW - 3) as string[]).slice(0, 1)
  doc.text(nameLine, leftX + 2, ly)
  ly += 5.5

  doc.setFontSize(9)
  doc.setFont('Roboto', 'normal')
  doc.text(order.phone, leftX + 2, ly)
  ly += 5.5

  doc.setFontSize(8)
  const address = order.deliveryAddress || '-'
  const allLines = doc.splitTextToSize(address, colW - 3) as string[]
  const addressLines = allLines.length <= 5
    ? allLines
    : [...allLines.slice(0, 4), allLines[4].slice(0, Math.max(0, allLines[4].length - 3)) + '...']
  doc.text(addressLines, leftX + 2, ly)

  // SAG: SIPARIS BILGILERI
  let ry = secStart
  doc.setFillColor(255, 255, 255)
  doc.rect(rightX, ry, colW, 6, 'F')
  doc.setFontSize(7)
  doc.setFont('Roboto', 'bold')
  doc.setTextColor(71, 85, 105)
  doc.text(tr.orderInfo, rightX + 2, ry + 4)
  ry += 8

  doc.setTextColor(0)
  const valFontSize = 8.5
  const valX = rightX + 16
  const valW = colW - 16 - 2

  const infoLines: Array<[string, string]> = [
    [tr.orderNo, order.orderNumber],
    [tr.school, order.class.school.name],
    [tr.class, order.class.name],
    [tr.package, order.package?.name || '-'],
    [tr.amount, `${Number(order.totalAmount).toFixed(2)} TL`]
  ]
  for (const [label, value] of infoLines) {
    doc.setFont('Roboto', 'bold')
    doc.setFontSize(7)
    doc.text(label, rightX + 2, ry)
    doc.setFont('Roboto', 'normal')

    // Sigana kadar font kucult (siparis no / okul adi gibi uzun degerler icin);
    // hala sigmiyorsa sonu "..." ile kes (sessizce veri kaybetmemek icin).
    let fs = valFontSize
    doc.setFontSize(fs)
    const text = String(value)
    while (fs > 5.5 && doc.getTextWidth(text) > valW) {
      fs -= 0.5
      doc.setFontSize(fs)
    }
    let valLine = text
    if (doc.getTextWidth(valLine) > valW) {
      while (valLine.length > 1 && doc.getTextWidth(valLine + '...') > valW) {
        valLine = valLine.slice(0, -1)
      }
      valLine += '...'
    }
    doc.text(valLine, valX, ry)
    ry += 5.6
  }

  // --- Alt bilgi ---
  const shipDate = order.shippedAt
    ? new Date(order.shippedAt).toLocaleDateString('tr-TR')
    : new Date().toLocaleDateString('tr-TR')

  doc.setFontSize(8)
  doc.setFont('Roboto', 'normal')
  doc.setTextColor(0)
  doc.text(`${tr.shipped} ${shipDate}`, m + 2, pageH - m - 2)
  doc.text('www.okultedarigim.com', pageW - m - 2, pageH - m - 2, { align: 'right' })
}

// --- Dahili: PDF doc olustur ---
async function createLabelDoc(orders: LabelOrder[], locale: DocLocale = 'tr'): Promise<jsPDF> {
  const fonts = await loadFonts()

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [100, 100]
  })

  registerFonts(doc, fonts)

  orders.forEach((order, i) => {
    if (i > 0) doc.addPage([100, 100], 'portrait')
    drawLabel(doc, order, locale)
  })

  return doc
}

// --- Preview: blob URL doner ---
export async function previewShippingLabel(order: LabelOrder, locale: DocLocale = 'tr'): Promise<string> {
  const doc = await createLabelDoc([order], locale)
  return doc.output('bloburl').toString()
}

export async function previewBulkLabels(orders: LabelOrder[], locale: DocLocale = 'tr'): Promise<string> {
  if (orders.length === 0) throw new Error('Siparis listesi bos')
  const doc = await createLabelDoc(orders, locale)
  return doc.output('bloburl').toString()
}

// --- HTML birebir-olcu baski (termal etiket yazicisi icin onerilir) ---
// PDF yerine @page size 100mm 100mm + margin 0 tanimli HTML uretip gizli iframe ile
// bastirir. Boylece tarayici/yazici "sayfaya sigdir" olcek kaymasi en aza iner.
function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

function buildLabelHtml(orders: LabelOrder[], locale: DocLocale = 'tr'): string {
  // xlsx degil HTML — Arapca burada da sorunsuz; ancak etiket cevirileri tutarli
  // olsun diye ayni LABEL_T tablosu kullanilir (ar -> en fallback dahil).
  const tr = LABEL_T[locale] ?? LABEL_T.tr
  const labels = orders.map(o => {
    let barcode = ''
    try { barcode = `<img src="${generateBarcode(o.trackingNo)}" alt="${esc(o.trackingNo)}" />` }
    catch { barcode = `<div class="noBarcode">${esc(tr.barcodeError)}</div>` }
    const shipDate = o.shippedAt
      ? new Date(o.shippedAt).toLocaleDateString('tr-TR')
      : new Date().toLocaleDateString('tr-TR')
    const rows: Array<[string, string]> = [
      [tr.orderNo, o.orderNumber],
      [tr.school, o.class.school.name],
      [tr.class, o.class.name],
      [tr.package, o.package?.name || '-'],
      [tr.amount, `${Number(o.totalAmount).toFixed(2)} TL`],
    ]
    const infoRows = rows.map(([l, v]) =>
      `<div class="row"><span class="lbl">${esc(l)}</span><span class="val">${esc(v)}</span></div>`
    ).join('')
    return `
      <div class="label"><div class="frame">
        <div class="header">
          <div class="h-title">OKULTEDARIGIM.COM</div>
          <div class="h-sub">${esc(tr.headerSub)}</div>
        </div>
        <div class="barcode">${barcode}</div>
        <hr class="sep" />
        <div class="cols">
          <div class="col">
            <div class="sec">${esc(tr.recipient)}</div>
            <div class="name">${esc(o.parentName)}</div>
            <div class="phone">${esc(o.phone)}</div>
            <div class="addr">${esc(o.deliveryAddress || '-')}</div>
          </div>
          <div class="col">
            <div class="sec">${esc(tr.orderInfo)}</div>
            ${infoRows}
          </div>
        </div>
        <div class="footer"><span>${esc(tr.shipped)} ${esc(shipDate)}</span><span>www.okultedarigim.com</span></div>
      </div></div>`
  }).join('')

  return `<!DOCTYPE html><html lang="${esc(locale)}"><head><meta charset="utf-8" />
<title>${esc(tr.pageTitle)}</title>
<style>
  @page { size: 100mm 100mm; margin: 0; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { margin: 0; padding: 0; }
  .label { width: 100mm; height: 100mm; overflow: hidden; page-break-after: always; break-after: page;
           font-family: Arial, Helvetica, sans-serif; color: #000; }
  .label:last-child { page-break-after: auto; break-after: auto; }
  .frame { margin: 4mm; height: 92mm; border: 0.4mm solid #1e293b; position: relative; }
  .header { background: #1e293b; color: #fff; height: 9mm; display: flex; flex-direction: column;
            align-items: center; justify-content: center; }
  .h-title { font-size: 11pt; font-weight: 700; line-height: 1; }
  .h-sub { font-size: 6.5pt; line-height: 1; margin-top: 0.4mm; }
  .barcode { text-align: center; margin-top: 2mm; height: 20mm; }
  .barcode img { height: 20mm; width: 70mm; object-fit: contain; }
  .noBarcode { font-size: 9pt; color: #999; padding-top: 6mm; }
  .sep { border: none; border-top: 0.3mm solid #d2d2d2; margin: 2mm 2mm 0; }
  .cols { display: flex; padding-top: 3mm; }
  .col { width: 50%; padding: 0 2mm; }
  .sec { background: #fff; color: #475569; font-size: 7pt; font-weight: 700; padding: 1mm 2mm; }
  .name { font-size: 10pt; font-weight: 700; margin-top: 2mm; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .phone { font-size: 9pt; margin-top: 1.5mm; }
  .addr { font-size: 8pt; margin-top: 1.5mm; line-height: 1.3; display: -webkit-box;
          -webkit-line-clamp: 5; -webkit-box-orient: vertical; overflow: hidden; }
  .row { font-size: 8.5pt; margin-top: 1.6mm; display: flex; }
  .lbl { font-weight: 700; flex: 0 0 16mm; }
  .val { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .footer { position: absolute; left: 2mm; right: 2mm; bottom: 1.5mm; display: flex;
            justify-content: space-between; font-size: 8pt; color: #000; }
</style></head><body>${labels}</body></html>`
}

// --- Toplu yazdir: HTML'i gizli iframe'de birebir olcu ile bastirir ---
export async function printBulkLabels(orders: LabelOrder[], locale: DocLocale = 'tr'): Promise<void> {
  if (orders.length === 0) throw new Error('Siparis listesi bos')
  const html = buildLabelHtml(orders, locale)

  const iframe = document.createElement('iframe')
  Object.assign(iframe.style, {
    position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0',
  })
  document.body.appendChild(iframe)

  const cw = iframe.contentWindow
  if (!cw) { iframe.remove(); throw new Error('Yazdirma penceresi acilamadi') }
  cw.document.open()
  cw.document.write(html)
  cw.document.close()

  // Barkod gorselleri yuklensin (data URL, hizli) — sonra yazdir
  await new Promise<void>((resolve) => {
    const imgs = Array.from(cw.document.images)
    let pending = imgs.filter(im => !im.complete).length
    if (pending === 0) { resolve(); return }
    const done = () => { if (--pending <= 0) resolve() }
    imgs.forEach(im => { if (!im.complete) { im.addEventListener('load', done); im.addEventListener('error', done) } })
    setTimeout(resolve, 1500) // emniyet
  })

  const cleanup = () => { try { iframe.remove() } catch { /* yoksay */ } }
  cw.addEventListener('afterprint', cleanup)
  setTimeout(cleanup, 60000) // fallback
  cw.focus()
  cw.print()
}

// --- Download: PDF indir ---
export async function downloadShippingLabel(order: LabelOrder, locale: DocLocale = 'tr'): Promise<void> {
  const doc = await createLabelDoc([order], locale)
  doc.save(`etiket-${order.orderNumber}.pdf`)
}

export async function downloadBulkLabels(orders: LabelOrder[], locale: DocLocale = 'tr'): Promise<void> {
  if (orders.length === 0) return
  const doc = await createLabelDoc(orders, locale)
  doc.save(`etiketler-toplu-${orders.length}-adet.pdf`)
}
