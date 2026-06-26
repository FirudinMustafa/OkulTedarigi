// Tek sayfalik veli yonlendirme brosuru (A4 dikey) HTML uretir; gercek QR kodunu gomer.
// Sonra Chrome headless ile PDF/PNG'ye render edilir (asagidaki komutlar).
// Calistir: node scripts/build-brochure.mjs
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const OUT_DIR = join(ROOT, 'public', 'brosur')
mkdirSync(OUT_DIR, { recursive: true })

const SIPARIS_URL = 'https://okultedarigim.com/siparis'

// QR'i offline gomebilmek icin public bir QR servisinden cekip base64 yap.
async function fetchQrDataUri() {
  const api = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=0&ecc=M&data=${encodeURIComponent(SIPARIS_URL)}`
  try {
    const res = await fetch(api)
    if (!res.ok) throw new Error('qr http ' + res.status)
    const buf = Buffer.from(await res.arrayBuffer())
    return `data:image/png;base64,${buf.toString('base64')}`
  } catch (e) {
    console.warn('QR cekilemedi, placeholder kullanilacak:', e.message)
    return null
  }
}

const GREEN = '#10b981'
const GREEN_DARK = '#059669'
const INK = '#0f172a'
const GRAY = '#64748b'

// Lucide tarzi cizgisel ikonlar (beyaz stroke, emerald daire icinde)
const icons = {
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M10.8 12.2 19 4"/><path d="M16 6l2 2"/><path d="M14.5 7.5 17 10"/>',
  box: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="M3 8l9 5 9-5"/><path d="M12 13v8"/>',
  form: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6"/><path d="M9 12h6"/><path d="M9 16h4"/>',
  card: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/><path d="M6 15h4"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
}

const steps = [
  { n: 1, icon: 'globe', h: 'Sipariş sayfasına gidin', t: 'okultedarigim.com adresine girin ya da QR’ı taratın, “Sipariş Ver”e dokunun. Üyelik gerekmez.' },
  { n: 2, icon: 'key', h: 'Okul şifrenizi girin', t: 'Okulunuzdan aldığınız şifreyi girin (örn. ATATURK2024) ve “Devam et”e basın.' },
  { n: 3, icon: 'box', h: 'Paketinizi seçin', t: 'Sınıfınıza uygun paketin içeriğini ve fiyatını görün, “Paketi seç”e basın.' },
  { n: 4, icon: 'form', h: 'Bilgileri doldurun', t: 'Öğrenci, teslimat ve fatura bilgilerini girin. İndirim kodunuz varsa uygulayın. (5 öğrenciye kadar tek siparişte.)' },
  { n: 5, icon: 'card', h: 'Güvenle ödeyin', t: 'Kredi/banka kartınızla ödeyin. 256-bit SSL ve 3D Secure ile korunur, kart bilgileriniz saklanmaz.' },
  { n: 6, icon: 'check', h: 'Siparişiniz onaylandı', t: 'Ödeme sonrası sipariş anında onaylanır. Onay e-posta ve SMS ile gelir.' },
]

function stepCard(s) {
  return `
    <div class="step">
      <div class="badge">
        <span class="num">${s.n}</span>
        <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${icons[s.icon]}</svg>
      </div>
      <div class="step-body">
        <h3>${s.h}</h3>
        <p>${s.t}</p>
      </div>
    </div>`
}

function html(qrDataUri) {
  const qr = qrDataUri
    ? `<img class="qr" src="${qrDataUri}" alt="QR kod" />`
    : `<div class="qr qr-ph">QR</div>`
  return `<!doctype html>
<html lang="tr"><head><meta charset="utf-8">
<style>
  @page { size: A4 portrait; margin: 0; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: "Segoe UI", system-ui, -apple-system, Arial, sans-serif;
    color: ${INK};
    background: #fff;
  }
  .page {
    width: 210mm; height: 297mm; padding: 12mm 12mm 0; margin: 0 auto;
    display: flex; flex-direction: column;
  }
  /* HEADER */
  .header {
    position: relative; border-radius: 22px; padding: 22px 26px;
    background: linear-gradient(135deg, ${GREEN} 0%, ${GREEN_DARK} 100%);
    color: #fff; overflow: hidden;
    box-shadow: 0 18px 40px -22px rgba(16,185,129,.7);
  }
  .header::after {
    content: ""; position: absolute; right: -40px; top: -60px;
    width: 220px; height: 220px; border-radius: 50%;
    background: rgba(255,255,255,.08);
  }
  .brand { font-size: 13px; font-weight: 600; opacity: .92; letter-spacing: .3px; }
  .brand b { font-weight: 800; }
  .title { font-size: 30px; font-weight: 800; line-height: 1.08; margin: 8px 0 4px; max-width: 78%; }
  .subtitle { font-size: 15px; font-weight: 600; opacity: .95; letter-spacing: 2px; text-transform: uppercase; }
  .qr-wrap { position: absolute; right: 22px; top: 22px; text-align: center; z-index: 2; }
  .qr { width: 92px; height: 92px; border-radius: 12px; background: #fff; padding: 6px; display: block; }
  .qr-ph { display: flex; align-items: center; justify-content: center; color: ${GREEN_DARK}; font-weight: 800; }
  .qr-cap { color: #fff; font-size: 9.5px; font-weight: 600; margin-top: 5px; opacity: .95; }
  /* INTRO */
  .intro { text-align: center; color: ${GRAY}; font-size: 14.5px; font-weight: 500; margin: 16px 8px 12px; line-height: 1.45; }
  .intro b { color: ${INK}; }
  /* STEPS */
  .steps { display: flex; flex-direction: column; gap: 11px; flex: 1; justify-content: space-between; }
  .step {
    display: flex; align-items: center; gap: 16px;
    background: #fff; border: 1px solid #eef2f1; border-radius: 18px;
    padding: 14px 18px; box-shadow: 0 10px 26px -20px rgba(15,23,42,.35);
  }
  .badge { position: relative; flex: 0 0 auto; width: 52px; height: 52px; }
  .badge .num {
    position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
    background: linear-gradient(135deg, ${GREEN} 0%, ${GREEN_DARK} 100%);
    color: #fff; font-weight: 800; font-size: 22px; border-radius: 16px;
    box-shadow: 0 8px 18px -8px rgba(16,185,129,.8);
  }
  .badge .ico {
    position: absolute; right: -7px; bottom: -7px; width: 26px; height: 26px;
    background: ${INK}; border-radius: 9px; padding: 4px; border: 2px solid #fff;
  }
  .step-body h3 { margin: 0 0 2px; font-size: 16.5px; font-weight: 700; color: ${INK}; }
  .step-body p { margin: 0; font-size: 12.8px; line-height: 1.4; color: ${GRAY}; }
  /* NOTE */
  .note { text-align: center; font-size: 11.5px; color: #94a3b8; font-style: italic; margin: 12px 6px 10px; }
  /* FOOTER */
  .footer {
    border-radius: 18px; padding: 14px 22px; margin-bottom: 10mm;
    background: linear-gradient(135deg, ${GREEN_DARK} 0%, ${GREEN} 100%);
    color: #fff; display: flex; align-items: center; justify-content: space-between; gap: 12px;
    box-shadow: 0 16px 36px -22px rgba(16,185,129,.8);
  }
  .footer .phone { font-size: 19px; font-weight: 800; letter-spacing: .3px; }
  .footer .meta { font-size: 12px; font-weight: 600; opacity: .95; text-align: right; line-height: 1.5; }
</style></head>
<body>
  <div class="page">
    <div class="header">
      <div class="qr-wrap">
        ${qr}
        <div class="qr-cap">okultedarigim.com/siparis</div>
      </div>
      <div class="brand">okultedarigim<b>.com</b></div>
      <div class="title">Yabancı Dil / Okul Kitap Paketi<br>Online Sipariş Adımları</div>
      <div class="subtitle">Hızlı · Güvenli · Üyeliksiz</div>
    </div>

    <div class="intro">Çocuğunuzun paketini <b>dakikalar içinde, güvenle</b> sipariş edin. Aşağıdaki 6 adımı izleyin.</div>

    <div class="steps">
      ${steps.map(stepCard).join('')}
    </div>

    <div class="note">Not: Ürünler tarafımızca okulda öğrencilerimize teslim edilir veya belirttiğiniz adrese kargolanır. Sipariş durumunuzu “Sipariş Takibi” sayfasından izleyebilirsiniz.</div>

    <div class="footer">
      <div class="phone">DESTEK HATTI: 0 (554) 167 47 37</div>
      <div class="meta">destek@okultedarigim.com<br>7/24 yardım asistanı · okultedarigim.com</div>
    </div>
  </div>
</body></html>`
}

const qr = await fetchQrDataUri()
const out = join(OUT_DIR, 'veli-siparis-brosur.html')
writeFileSync(out, html(qr), 'utf8')
console.log('HTML ->', out, qr ? '(QR gomuldu)' : '(QR placeholder)')
