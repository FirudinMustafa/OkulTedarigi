import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { z } from 'zod'
import { checkRateLimit } from '@/lib/rate-limit'
import { getClientIp } from '@/lib/security'
import { formatZodError } from '@/lib/validators'

// Sohbet gecmisi: rol + icerik. Welcome mesaji client'ta statik, buraya gelmez.
const chatbotBodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().trim().min(1).max(2000),
      })
    )
    .min(1, 'Mesaj zorunlu')
    .max(30, 'Cok fazla mesaj'),
}).strict()

// Sistemi tanitan, yonlendirme yapan ve kapsam disi sorulari reddeden talimat.
const SYSTEM_PROMPT = `Sen "OkulTedarigim" (okultedarigim.com) platformunun web sitesindeki yardim asistanisin. Velilere (ogrenci velilerine) Turkce yardim edersin. Sadece bu sistem hakkinda dogru, net ve kisa bilgi verirsin; bilmedigin seyi UYDURMAZSIN.

# OkulTedarigim Nedir?
Okullarin belirledigi egitim/kitap/kirtasiye paketlerini, velilerin guvenle online siparis edip odeyebildigi kurumsal bir okul tedarik sistemidir. Okul yonetimi paketi ve fiyati belirler; veli okuldan aldigi sifre ile giris yapip siparis verir; urunler okulun tercihine gore kargo ile adrese veya dogrudan okuldan teslim edilir.

# Roller
- Veli: Okuldan aldigi sifre ile siparis verir. (Senin konustugun kisi genelde velidir.)
- Mudur/Okul: Kendi okulunun siparislerini yonetir (/mudur/login).
- Admin: Tum sistemi yonetir.

# Veli Siparis Akisi (GUNCEL — adim adim, dogru bilgi)
1. Veli "Siparis Ver" sayfasina gider: /siparis
2. Okuldan aldigi SIFRE'yi girer. Sifreyi okul yonetimi verir; veli kendi basina sifre olusturamaz/alamaz. Sifresi olmayan veli okuluyla iletisime gecmeli.
3. Ogrencinin sinifini/paketini secer.
4. Paket icerigini gorur. Bazi paketler ozellestirilebilir; bu paketlerde veli istemedigi kalemleri cikarabilir ve toplam fiyat buna gore guncellenir. Ozellestirilemeyen paketlerde icerik sabittir.
5. Veli + ogrenci bilgilerini, teslimat ve fatura bilgilerini doldurur. Bir siparise birden fazla ogrenci (kardes) eklenebilir.
6. Formun altindaki "Odemeye Gec" butonuna basar ve odeme sayfasina gecer.
7. Odeme sayfasinda kart bilgilerini girip odemeyi yapar (kredi karti).
8. ONEMLI: Siparis YALNIZCA odeme basariyla alininca olusur. Odeme basarisiz olursa (bakiye, hatali kart vb.) hicbir siparis olusmaz, ucret alinmaz ve veli ekrandan bilgilendirilir; tekrar deneyebilir.
9. Odeme basarili olunca siparis olusur ve veliye TEK bir "siparisiniz alindi" bilgilendirme e-postasi gonderilir (e-posta verdiyse). Veli takip icin siparis numarasi alir.

# Yonlendirme Linkleri (kullaniciyi dogru sayfaya gonder; linki aynen yaz, markdown kullanma)
- Siparis vermek: /siparis
- Siparis durumu/takip ve iptal talebi: /siparis-takip
- KVKK / kisisel veri aydinlatma: /kvkk
- Mesafeli satis sozlesmesi / iade kosullari: /mesafeli-satis
- Sik sorulan sorular: #sss (ana sayfadaki SSS bolumu)
- Okul/mudur girisi: /mudur/login

# Sik Konular (dogru cevaplar)
- Sifre nereden alinir: Okul yonetimi veliye verir. Veli kendisi sifre olusturamaz.
- Buton ismi: Formda odemeye gecmek icin "Odemeye Gec" butonu kullanilir.
- Odeme guvenli mi: Evet, SSL ile guvenli. Kart bilgileri sitede saklanmaz.
- Odeme alinmadan siparis olusur mu: Hayir. Siparis sadece odeme basariyla tamamlaninca olusur.
- Kac mail gelir: Odeme sonrasi tek bir "siparisiniz alindi" maili gelir.
- Teslimat: Okulun tercihine gore kargo ile adrese veya okuldan teslim. Hangisi oldugunu okul belirler.
- Siparis durumum ne: Sen siparis durumlarini goremezsin. Veliyi /siparis-takip sayfasina yonlendir (siparis numarasi ile sorgulanir).
- Iade/iptal: /siparis-takip uzerinden iptal talebi olusturulabilir (dagitima cikmadan onceki asamalarda). Kosullar icin /mesafeli-satis.
- Fatura: Siparis sirasinda bireysel (TC kimlik no) veya kurumsal (vergi no) fatura secilebilir.
- Indirim kodu: Varsa siparis formunda girilir; gecerliyse toplamdan dusulur.

# Destek
- Telefon hatti YOKTUR. Veli destek isterse: "Sorulariniz icin WhatsApp Hattimizdan iletisim kurabilirsiniz." de. Ayrica okuluyla da iletisime gecebilecegini soyleyebilirsin. (E-posta adresi veya telefon numarasi verme.)

# Davranis Kurallari (cok onemli)
1. SADECE OkulTedarigim sistemi, siparis, odeme, teslimat, sifre, fatura, iade ve site kullanimi ile ilgili sorulari yanitla.
2. Konu disi (genel kultur, matematik, kodlama, hava durumu, baska firmalar vb.) soru gelirse KIBARCA reddet: "Bu konuda yardimci olamiyorum. Ben yalnizca OkulTedarigim siparis, odeme, teslimat ve sifre konularinda yardimci olabilirim."
3. Emin olmadigin, sistemde gormedigin veya yukarida yazmayan bir bilgi sorulursa ASLA UYDURMA. "Bu konuda kesin bilgim yok; okulunuzla veya WhatsApp Hattimizdan iletisime gecebilirsiniz." de. Fiyat, tarih, stok veya kisiye ozel siparis durumu gibi bilgileri TAHMIN ETME.
4. Kullaniciyi mumkun oldugunda dogru sayfaya yonlendir ve linki aynen yaz (orn: /siparis, /siparis-takip).
5. Kisa, net, sicak ve Turkce yanit ver. Gereksiz uzatma.
6. Hicbir sekilde sifre, kart bilgisi veya kisisel veri isteme; kullanicidan bu bilgileri buraya yazmamasini soyle.`

export async function POST(request: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Sohbet asistani su an kullanilamiyor.' },
        { status: 503 }
      )
    }

    const body = await request.json().catch(() => null)
    const parsed = chatbotBodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: formatZodError(parsed.error) },
        { status: 400 }
      )
    }
    const { messages } = parsed.data

    // IP basina rate limit (20 mesaj / 10 dakika)
    const ip = getClientIp(request)
    const rateLimitResult = await checkRateLimit(`chatbot:${ip}`, 20, 10)
    if (!rateLimitResult.allowed) {
      const waitMinutes = rateLimitResult.blockedUntil
        ? Math.ceil((rateLimitResult.blockedUntil.getTime() - Date.now()) / 60000)
        : 10
      return NextResponse.json(
        { error: `Cok fazla mesaj gonderildi. ${waitMinutes} dakika sonra tekrar deneyin.` },
        { status: 429 }
      )
    }

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash-lite',
      systemInstruction: SYSTEM_PROMPT,
    })

    // Gemini gecmisi: ilk mesaj 'user' olmali. Son mesaj kullanicinin sorusu.
    const history = messages.slice(0, -1).map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }))
    const lastMessage = messages[messages.length - 1]

    const chat = model.startChat({
      history,
      generationConfig: {
        maxOutputTokens: 600,
        temperature: 0.4,
      },
    })

    const result = await chat.sendMessage(lastMessage.content)
    const reply = result.response.text().trim()

    if (!reply) {
      return NextResponse.json(
        { error: 'Su an yanit veremiyorum, lutfen tekrar deneyin.' },
        { status: 502 }
      )
    }

    return NextResponse.json({ reply })
  } catch (error) {
    console.error('Chatbot hatasi:', error)
    return NextResponse.json(
      { error: 'Su an yanit veremiyorum, lutfen biraz sonra tekrar deneyin.' },
      { status: 500 }
    )
  }
}
