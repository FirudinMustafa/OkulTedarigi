// Etiket layout'unun 100x150mm sayfaya sığıp sığmadığını ölçer.
// jsPDF kullanarak simüle eder; barkod yerine placeholder kullanır.
import { jsPDF } from 'jspdf'
import fs from 'fs'

// Test sipariş verileri (gerçek sistemdekilerin uzun versiyonları)
const testOrders = [
  {
    name: 'Kısa adres',
    parentName: 'Ayşe Demir',
    phone: '05321234567',
    deliveryAddress: 'Atatürk Cd. No:15, Çankaya, Ankara',
    parts: { school: 'Atatürk İlkokulu', class: '2. Sınıf', package: 'Atatürk İlkokulu 2. Sınıf Paketi', orderNo: 'ORD-2026-4TY9CNGE', total: 2500 },
  },
  {
    name: 'Orta adres (3 satır beklenir)',
    parentName: 'Mustafa Çelik',
    phone: '05451112233',
    deliveryAddress: 'Cumhuriyet Mahallesi, Atatürk Caddesi No:15 Kat:3 Daire:7, Çankaya, Ankara, 06520, Türkiye',
    parts: { school: 'Atatürk İlkokulu', class: '2. Sınıf', package: 'Atatürk İlkokulu 2. Sınıf Paketi', orderNo: 'ORD-2026-BNQ4RXKW', total: 7500 },
  },
  {
    name: 'Çok uzun adres (truncate edilmeli)',
    parentName: 'Hatice Yıldız Yıldız Yıldız',
    phone: '05557778899',
    deliveryAddress: 'Maltepe Mahallesi, Eskişehir Yolu Üzeri Karşısında Bulunan Çok Büyük Plaza Içerisinde Kat:42 Daire:1742, Yenimahalle, Çankaya, Ankara, 06570, Türkiye Cumhuriyeti',
    parts: { school: 'Atatürk İlkokulu Çok Uzun Okul Adı Test', class: '2. Sınıf Şubesi A', package: 'Atatürk İlkokulu 2. Sınıf Paketi Çok Detaylı Versiyonu', orderNo: 'ORD-2026-XCFW8EN7', total: 5000 },
  },
]

const PAGE_W = 100
const PAGE_H = 150

// shipping-label.ts'deki drawLabel mantığını yansıtan sadeleştirilmiş versiyon
function simulate(order) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [PAGE_W, PAGE_H] })
  const marginX = 6
  const marginTop = 6
  const contentW = PAGE_W - marginX * 2
  let y = marginTop

  y += 14 + 2 // header
  y += 30 + 2 // barcode

  y += 6 + 1 // ALICI bar
  y += 6 // name
  y += 6 // phone

  // address
  doc.setFontSize(9)
  const allLines = doc.splitTextToSize(order.deliveryAddress, contentW - 6)
  const addressLines = allLines.length <= 3 ? allLines : [...allLines.slice(0, 2), allLines[2].slice(0, allLines[2].length - 3) + '...']
  y += addressLines.length * 4.2 + 2

  y += 3 // divider

  y += 6 + 2 // SIPARIS BILGILERI bar

  // 5 info lines
  for (const [, value] of [
    ['Sipariş No:', order.parts.orderNo],
    ['Okul:', order.parts.school],
    ['Sınıf:', order.parts.class],
    ['Paket:', order.parts.package],
    ['Tutar:', `${order.parts.total} TL`],
  ]) {
    const valueLines = doc.splitTextToSize(String(value), contentW - 22 - 3).slice(0, 2)
    y += valueLines.length === 1 ? 4.5 : 8.5
  }

  y += 1 // small gap
  y += 4 // divider

  y += 5 // footer
  return { addressLineCount: addressLines.length, finalY: y }
}

console.log(`Sayfa: ${PAGE_W}×${PAGE_H}mm | Güvenli alan: ${PAGE_H - 6}mm\n`)
let allPass = true
for (const o of testOrders) {
  const { addressLineCount, finalY } = simulate(o)
  const ok = finalY <= PAGE_H - 2
  if (!ok) allPass = false
  console.log(`${ok ? '✓' : '✗'} ${o.name.padEnd(45)} adres ${addressLineCount} satır → ${finalY.toFixed(1)}mm / ${PAGE_H}mm  ${ok ? 'OK' : 'TAŞIYOR!'}`)
}
console.log(`\n${allPass ? '✅ Tüm etiketler 100×150mm sayfaya sığıyor' : '❌ Bazı etiketler taşıyor — daha fazla sıkıştırma gerek'}`)
