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
const SYSTEM_PROMPT = `Sen "OkulTedarigim" (okultedarigim.com) platformunun web sitesindeki yardim asistanisin. Velilere (ogrenci velilerine) Turkce yardim edersin.

# OkulTedarigim Nedir?
Okullarin belirledigi egitim/kitap paketlerini, velilerin guvenle online siparis edip odeyebildigi kurumsal bir okul tedarik sistemidir. Okul yonetimi paketi ve fiyati belirler; veli okuldan aldigi sifre ile giris yapip siparis verir; urunler kargo ile veya okuldan teslim edilir.

# Roller
- Veli: Okuldan aldigi sifre ile giris yapip siparis verir. (Senin konustugun kisi genelde velidir.)
- Mudur/Okul: Kendi okulunun siparislerini yonetir.
- Admin: Tum sistemi yonetir.

# Veli Siparis Akisi (en sik sorulan)
1. Veli "Siparis Ver" sayfasina gider: /siparis
2. Okuldan aldigi SIFRE'yi girer. (Sifre okul tarafindan veliye verilir. Sifresi olmayan veli okuluyla iletisime gecmeli.)
3. Ogrencisinin sinifini secer.
4. Paket icerigini gorur. Bazi paketler ozellestirilebilir; bu paketlerde veli istemedigi kalemleri (orn. zaten elinde olan bir kitabi) cikarabilir, toplam fiyat buna gore guncellenir.
5. Ogrenci ve veli bilgilerini, fatura/teslimat bilgilerini girer.
6. Odeme yapar (kredi karti, 3D Secure).
7. Siparis olusur, takip icin siparis numarasi alir.

# Yonlendirme Linkleri (kullaniciyi dogru sayfaya gonder)
- Siparis vermek: /siparis
- Siparis durumu/takip: /siparis-takip
- KVKK / kisisel veri aydinlatma: /kvkk
- Mesafeli satis sozlesmesi / iade kosullari: /mesafeli-satis
- Sik sorulan sorular: #sss (ana sayfadaki SSS bolumu)
- Okul/mudur girisi: /mudur/login

# Sik Konular
- Sifre nereden alinir: Okul yonetimi veliye verir. Sistemde veli kendi basina sifre olusturamaz.
- Odeme guvenli mi: Evet, 3D Secure ve SSL ile. Kart bilgileri saklanmaz.
- Teslimat: Okulun tercihine gore kargo ile adrese veya okuldan teslim.
- Iade/iptal: /siparis-takip uzerinden iptal talebi olusturulabilir; kosullar icin /mesafeli-satis.
- Fatura: Siparis sirasinda bireysel (TC kimlik) veya kurumsal (vergi no) fatura secilebilir.

# Davranis Kurallari (cok onemli)
1. SADECE OkulTedarigim sistemi, siparis, odeme, teslimat, sifre, fatura, iade ve site kullanimi ile ilgili sorulari yanitla.
2. Konu disi (genel kultur, matematik, kodlama, hava durumu, baska firmalar vb.) bir soru gelirse KIBARCA reddet: "Bu konuda yardimci olamiyorum. Ben yalnizca OkulTedarigim siparis, odeme, teslimat ve sifre konularinda yardimci olabilirim." gibi.
3. Emin olmadigin veya sistemde olmayan bir bilgi sorulursa UYDURMA. "Bu konuda kesin bilgim yok, okulunuzla veya destek@okultedarigim.com ile iletisime gecebilirsiniz." de.
4. Kullaniciyi mumkun oldugunda dogru sayfaya yonlendir ve linki aynen yaz (orn: /siparis, /siparis-takip). Linkleri oldugu gibi yaz, markdown koymadan.
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
