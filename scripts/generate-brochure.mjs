// Tek sayfalik veli yonlendirme brosuru uretir (Google Gemini "nano banana" = gemini-2.5-flash-image).
// Cikti: public/brosur/veli-siparis-brosur.png
// Calistir: node scripts/generate-brochure.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

// .env icinden GEMINI_API_KEY oku (cevre degiskeni varsa onu kullan)
function readEnvKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY
  try {
    const env = readFileSync(join(ROOT, '.env'), 'utf8')
    const m = env.match(/^GEMINI_API_KEY\s*=\s*"?([^"\r\n]+)"?/m)
    return m ? m[1].trim() : null
  } catch {
    return null
  }
}

const API_KEY = readEnvKey()
if (!API_KEY) {
  console.error('GEMINI_API_KEY bulunamadi (.env).')
  process.exit(1)
}

const MODEL = process.env.IMAGE_MODEL || 'gemini-2.5-flash-image'

// Brosur prompt'u — referans flyer mantigi, kendi sistemimize uyarlandi.
const PROMPT = `Create a SINGLE-PAGE, print-ready VERTICAL A4 marketing flyer (portrait, 3:4) for an online school-supply ordering service. Clean, modern, friendly e-commerce style. White background with EMERALD GREEN (#10b981) as the main brand accent color, soft rounded cards, subtle shadows, flat 3D illustrated icons. Turkish language. Render ALL text crisply and EXACTLY as written below (correct Turkish characters: ş, ç, ğ, ı, ö, ü). High resolution, balanced layout, lots of whitespace, professional.

LAYOUT TOP TO BOTTOM:

1) HEADER BAND (emerald green rounded banner) with big bold white title:
"YABANCI DİL / OKUL KİTAP PAKETİ"
subtitle line under it in smaller white text:
"ONLINE SİPARİŞ ADIMLARI"
On the top-right corner of the header place a clean white rounded square QR-code placeholder box with a small label under it: "okultedarigim.com/siparis"

2) A short friendly intro line, dark gray, centered:
"Çocuğunuzun paketini dakikalar içinde, güvenle sipariş edin. Üyelik gerekmez."

3) SIX numbered STEP cards, each as a rounded white card with a large emerald circle containing the step number, a small relevant flat 3D icon, a bold short heading and one short line. Arrange neatly (e.g. vertical list or 2-column grid):

Step 1 — heading: "Sipariş sayfasına gidin" — text: "okultedarigim.com adresine girin ya da QR'ı taratın, 'Sipariş Ver'e dokunun."
Step 2 — heading: "Okul şifrenizi girin" — text: "Okulunuzdan aldığınız şifreyi girin (örn. ATATURK2024) ve 'Devam et'e basın."
Step 3 — heading: "Paketinizi seçin" — text: "Sınıfınıza uygun paketin içeriğini ve fiyatını görün, 'Paketi seç'e basın."
Step 4 — heading: "Bilgileri doldurun" — text: "Öğrenci, teslimat ve fatura bilgilerini girin. İndirim kodunuz varsa uygulayın."
Step 5 — heading: "Güvenle ödeyin" — text: "Kredi/banka kartınızla ödeyin. 256-bit SSL ve 3D Secure ile korunur."
Step 6 — heading: "Siparişiniz onaylandı" — text: "Ödeme sonrası sipariş anında onaylanır. Onay e-posta ve SMS ile gelir."

4) A small note line in light gray italic near the bottom:
"Not: Ürünler tarafımızca okulda öğrencilerimize teslim edilir veya adresinize kargolanır."

5) FOOTER BAND (emerald green rounded banner) with white text, bold:
"DESTEK HATTI: 0 (554) 167 47 37"
and smaller line:
"destek@okultedarigim.com  ·  okultedarigim.com"

Do not add any other languages or invented text. Keep it elegant and uncluttered.`

async function main() {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`
  const body = {
    contents: [{ role: 'user', parts: [{ text: PROMPT }] }],
    generationConfig: {
      responseModalities: ['IMAGE'],
      imageConfig: { aspectRatio: '3:4' },
    },
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': API_KEY,
    },
    body: JSON.stringify(body),
  })

  const text = await res.text()
  if (!res.ok) {
    console.error(`HTTP ${res.status}:`, text.slice(0, 2000))
    process.exit(1)
  }

  let data
  try { data = JSON.parse(text) } catch { console.error('JSON parse hatasi:', text.slice(0, 1000)); process.exit(1) }

  const parts = data?.candidates?.[0]?.content?.parts || []
  const imgPart = parts.find((p) => p.inlineData?.data)
  if (!imgPart) {
    console.error('Goruntu donmedi. Yanit:', JSON.stringify(data).slice(0, 1500))
    process.exit(1)
  }

  const outDir = join(ROOT, 'public', 'brosur')
  mkdirSync(outDir, { recursive: true })
  const outPath = join(outDir, 'veli-siparis-brosur.png')
  writeFileSync(outPath, Buffer.from(imgPart.inlineData.data, 'base64'))
  console.log('OK ->', outPath)
}

main().catch((e) => { console.error(e); process.exit(1) })
