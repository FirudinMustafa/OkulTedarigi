import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { z } from 'zod'
import { checkRateLimit } from '@/lib/rate-limit'
import { getClientIp } from '@/lib/security'
import { formatZodError } from '@/lib/validators'
import { getApiLocale } from '@/lib/api-locale'
import { getTranslations } from 'next-intl/server'

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
  locale: z.enum(['tr', 'en', 'de', 'ar']).optional(),
}).strict()

// Yanit dili zorlamasi — kullanicinin sectigi dile gore.
const LANG_INSTRUCTION: Record<string, string> = {
  tr: '\n\n# YANIT DILI\nKullaniciya HER ZAMAN Turkce yanit ver.',
  en: '\n\n# RESPONSE LANGUAGE\nIMPORTANT: Respond ONLY in English, regardless of the language the user writes in. Keep URLs/links exactly as written.',
  de: '\n\n# ANTWORTSPRACHE\nWICHTIG: Antworte AUSSCHLIESSLICH auf Deutsch, unabhängig von der Sprache des Nutzers. Links/URLs exakt beibehalten.',
  ar: '\n\n# لغة الرد\nمهم: أجب باللغة العربية فقط بغضّ النظر عن لغة المستخدم. اترك الروابط/عناوين URL كما هي تمامًا.',
}

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

# Teslimat ve Kargo Takibi (GUNCEL — dogru bilgi)
- Teslimat tipini OKUL belirler: (a) Kargo ile adrese teslim, ya da (b) dogrudan okuldan teslim.
- Kargo ile teslimde gonderiler YURTICI KARGO ile yapilir. Siparis kargoya verildiginde bir kargo takip numarasi olusur.
- Veli siparisini /siparis-takip sayfasinda siparis numarasi ile sorgular. Siparis asamalari sirasiyla: Olusturuldu -> Odendi -> (kargo ise) Kargoya Verildi/Dagitimda -> Teslim Edildi.
- Kargoya verilen siparislerde /siparis-takip sayfasinda kargo takip numarasi ve tiklanabilir bir Yurtici Kargo takip baglantisi gorunur; veli gonderisini oradan canli izleyebilir.
- Kargo teslim suresi genelde siparis kargoya verildikten sonra birkac is gunudur; kesin durum icin Yurtici Kargo takibine bakilmalidir.
- Okuldan teslimde kargo/takip numarasi olmaz; teslimat okul uzerinden yapilir.

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
- Teslimat: Okulun tercihine gore Yurtici Kargo ile adrese veya okuldan teslim. Hangisi oldugunu okul belirler.
- Kargom hangi firma ile gelir: Adrese teslimde gonderiler Yurtici Kargo ile yapilir.
- Kargomu nasil takip ederim: /siparis-takip sayfasinda siparis numaranla sorgula; kargoya verildiyse takip numaran ve Yurtici Kargo takip baglantin orada gorunur.
- Siparis durumum ne: Sen siparis durumlarini goremezsin. Veliyi /siparis-takip sayfasina yonlendir (siparis numarasi ile sorgulanir).
- Iade/iptal: /siparis-takip uzerinden iptal talebi olusturulabilir (dagitima cikmadan onceki asamalarda). Kosullar icin /mesafeli-satis.
- Fatura: Siparis sirasinda bireysel (TC kimlik no) veya kurumsal (vergi no) fatura secilebilir.
- Indirim kodu: Varsa siparis formunda girilir; gecerliyse toplamdan dusulur.

# Destek ve WhatsApp'a Yonlendirme (escalation)
- WhatsApp destek hattinin numarasi: +90 554 167 47 37 (link: https://wa.me/905541674737). Bu numarayi BILIYORSUN ama HEMEN VERME.
- Once SEN cozmeye calis. Numarayi vermek SON CARE'dir; ilk birkac soruda ASLA numara/link verme.
- Veli bir sorun yasiyorsa, numarayi vermeden once en az 4-5 kez gercekten yardim etmeyi DENE: sorunu anlamaya calis, netlestirici sorular sor, adim adim cozum onerileri ver, dogru sayfaya yonlendir (/siparis, /siparis-takip vb.). Her seferinde farkli ve somut bir yardim sun; ayni seyi tekrarlama.
- WhatsApp numarasini/linkini SADECE su durumda ver: Veli ayni sorunu yaklasik 4-5 kez sordu/anlatti ve verdigin tum cozumlere ragmen sorun HALA cozulmedi; yani senin yapabileceklerin tukendi.
- Istisna: Gercekten insan mudahalesi sart olan ve senin asla cozemeyecegin acil durumlarda (orn. yanlis/basarisiz odeme sonrasi para ile ilgili acil sorun, kisiye ozel hesap/iade takibi) bu siniri beklemeden numara verebilirsin.
- Numarayi verirken kibarca soyle: "Sorununuzu daha hizli cozebilmemiz icin WhatsApp destek hattimiza yazabilirsiniz: +90 554 167 47 37 — buradan ulasin: https://wa.me/905541674737"
- Normal, kolayca cevaplanabilen sorularda ASLA numara verme; dogrudan yardim et. Numara, sen yardimci olamadiginda basvurulacak son adimdir.

# Davranis Kurallari (cok onemli)
1. SADECE OkulTedarigim sistemi, siparis, odeme, teslimat, sifre, fatura, iade ve site kullanimi ile ilgili sorulari yanitla.
2. Konu disi (genel kultur, matematik, kodlama, hava durumu, baska firmalar vb.) soru gelirse KIBARCA reddet: "Bu konuda yardimci olamiyorum. Ben yalnizca OkulTedarigim siparis, odeme, teslimat ve sifre konularinda yardimci olabilirim."
3. Emin olmadigin, sistemde gormedigin veya yukarida yazmayan bir bilgi sorulursa ASLA UYDURMA. "Bu konuda kesin bilgim yok; okulunuzla veya WhatsApp Hattimizdan iletisime gecebilirsiniz." de. Fiyat, tarih, stok veya kisiye ozel siparis durumu gibi bilgileri TAHMIN ETME.
4. Kullaniciyi mumkun oldugunda dogru sayfaya yonlendir ve linki aynen yaz (orn: /siparis, /siparis-takip).
5. Kisa, net, sicak ve Turkce yanit ver. Gereksiz uzatma.
6. Hicbir sekilde sifre, kart bilgisi veya kisisel veri isteme; kullanicidan bu bilgileri buraya yazmamasini soyle.`

export async function POST(request: Request) {
  const t = await getTranslations({ locale: await getApiLocale(), namespace: 'apiErrors' })
  try {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: t('veli.chatUnavailable') },
        { status: 503 }
      )
    }

    const body = await request.json().catch(() => null)
    const parsed = chatbotBodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: formatZodError(parsed.error, await getApiLocale()) },
        { status: 400 }
      )
    }
    const { messages, locale } = parsed.data
    const systemInstruction = SYSTEM_PROMPT + (LANG_INSTRUCTION[locale ?? 'tr'] ?? LANG_INSTRUCTION.tr)

    // IP basina rate limit (20 mesaj / 10 dakika)
    const ip = getClientIp(request)
    const rateLimitResult = await checkRateLimit(`chatbot:${ip}`, 20, 10)
    if (!rateLimitResult.allowed) {
      const waitMinutes = rateLimitResult.blockedUntil
        ? Math.ceil((rateLimitResult.blockedUntil.getTime() - Date.now()) / 60000)
        : 10
      return NextResponse.json(
        { error: t('veli.chatTooManyMessages', { minutes: waitMinutes }) },
        { status: 429 }
      )
    }

    const genAI = new GoogleGenerativeAI(apiKey)

    // Gemini gecmisi: ilk mesaj 'user' olmali. Son mesaj kullanicinin sorusu.
    const history = messages.slice(0, -1).map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }))
    const lastMessage = messages[messages.length - 1]

    // Google zaman zaman "503 high demand" / "429 rate limit" donuyor (gecici).
    // Bu yuzden birkac model uzerinde kisa backoff'la tekrar deniyoruz; biri
    // cevap verene kadar sirayla geciyoruz. Kalici hatada (orn. 404) modeli atla.
    const MODELS = ['gemini-2.5-flash-lite', 'gemini-2.5-flash', 'gemini-2.0-flash']
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

    let reply = ''
    let lastError: unknown = null
    for (const modelName of MODELS) {
      const model = genAI.getGenerativeModel({ model: modelName, systemInstruction })
      let retriable = true
      for (let attempt = 0; attempt < 2 && retriable; attempt++) {
        try {
          const chat = model.startChat({
            history,
            generationConfig: { maxOutputTokens: 600, temperature: 0.4 },
          })
          const result = await chat.sendMessage(lastMessage.content)
          reply = result.response.text().trim()
          if (reply) break
        } catch (err) {
          lastError = err
          const status = (err as { status?: number })?.status
          if (status === 503 || status === 429) {
            await sleep(500 * (attempt + 1)) // gecici: bekle ve tekrar dene
          } else {
            retriable = false // kalici hata: bu modeli birak, sonrakine gec
          }
        }
      }
      if (reply) break
    }

    if (!reply) {
      console.error('Chatbot: tum modeller yanit veremedi.', lastError)
      return NextResponse.json(
        { error: t('veli.chatBusy') },
        { status: 503 }
      )
    }

    return NextResponse.json({ reply })
  } catch (error) {
    console.error('Chatbot hatasi:', error)
    return NextResponse.json(
      { error: t('veli.chatBusy') },
      { status: 500 }
    )
  }
}
