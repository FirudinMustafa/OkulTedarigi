# Fix Log

> Bu dosya yapilan tum kod degisikliklerini, tarih sirasiyla, dosya yolu ve sebep ile birlikte takip eder.
> Format: ### FIX-N: Kisa basligi → durum

## Calismaya Baslama
Tarih: 2026-04-08
Sistem incelemesi sonucu tespit edilen 15 HATA bulgu icin sirayla duzeltme yapiliyor.
Her FIX'in altina:
- **Dosyalar:** Degistirilen dosyalar
- **Yapilan:** Kisa aciklama
- **Sebep:** Hangi bulguyu (K-N veya O-N veya S-N) cozdu
- **Test/Notlar:** El ile kontrol gereken seyler

---

### FIX-1: Veli payment - mockPayment bypass kaldir → tamamlandi
- **Dosyalar:** `src/app/api/veli/payment/route.ts`
- **Yapilan:** Body'den `mockPayment` field'i tamamen kaldirildi. Mock kararı artik sadece sunucu tarafinda `process.env.USE_MOCK_PAYMENT === 'true'` ile veriliyor (iyzico.ts icinde). Frontend'in `mockPayment: true` gondererek gercek odemeyi atlamasi engellendi.
- **Sebep:** K1 (KRITIK) - Production'da istemci mock=true gonderdiginde gercek odeme bypass ediliyordu.
- **Test/Notlar:** Frontend'de eski `mockPayment` parametresini gonderen yer var mi diye kontrol edildi (odeme/[orderId]/page.tsx artik gondermiyor).

---

### FIX-2: Veli order GET / payment / siparis-takip - phone last-4 IDOR koruma → tamamlandi
- **Dosyalar:**
  - `src/app/api/veli/order/route.ts` (GET) — `phone` query parametresi mecburi, son 4 hane order.phone ile karsilastirilir, eslemiyorsa 403.
  - `src/app/api/veli/payment/route.ts` — POST body'sinde `phone` mecburi, last-4 verification eklendi.
  - `src/app/siparis-takip/page.tsx` — telefon input alani eklendi, normalize edilip API'ye iletilir, basarili sorguda `sessionStorage.setItem('orderPhone', ...)`.
  - `src/app/odeme/[orderId]/page.tsx` — mount sirasinda sessionStorage'tan phone okur; yoksa `/siparis-takip` yonlendirir; fetch ve payment POST'lari phone iletir.
  - `src/app/siparis-onay/[orderNumber]/page.tsx` — ayni sessionStorage akisi, eksikse `/siparis-takip` yonlendirir.
  - `src/app/paket/[id]/page.tsx` — basarili siparis sonrasi `sessionStorage.setItem('orderPhone', normalizedPhone)`.
- **Yapilan:** Veli flow'unda IDOR (Insecure Direct Object Reference) korunmasi. `orderId` bilen herkes siparis detayini cekemiyor; isteyen telefon numarasinin son 4 hanesinin order.phone ile eslesmesi gerekli.
- **Sebep:** K2 (KRITIK) - Veli endpoint'lerinde auth yoktu, sadece orderId ile detay/odeme erisilebiliyordu.
- **Test/Notlar:** sessionStorage cross-tab paylasilmaz; kullanici yeni sekmede `/odeme/...` acsa redirect alir (kabul edilebilir trade-off).

---

### FIX-3: Admin classes DELETE - soft delete + aktif siparis kontrolu → tamamlandi
- **Dosyalar:** `src/app/api/admin/classes/[id]/route.ts`
- **Yapilan:** Cascade DELETE kaldirildi. Aktif siparis varsa (CANCELLED/REFUNDED disindaki tum statuslerde herhangi bir order varsa) 409 doner. Hic siparis yoksa gercek delete; siparis varsa `isActive=false` soft delete. SystemLog action `DEACTIVATE`.
- **Sebep:** K3 (KRITIK) - Cascade delete tarihsel siparis verilerini siliyor, hakedis/raporlama bozuluyordu.
- **Test/Notlar:** Frontend siniflar sayfasi soft delete sonrasi sinifi listede gostermemeli (isActive filtresi var mi kontrol).

---

### FIX-4: Seed - admin parolasini env'den zorla, log'tan kaldir → tamamlandi
- **Dosyalar:** `prisma/seed.ts`
- **Yapilan:** `ADMIN_EMAIL` ve `ADMIN_PASSWORD` env'leri MECBURI yapildi (default `admin123` kaldirildi). `ADMIN_PASSWORD` minimum 12 karakter zorlandi. `console.log` yalnizca email yaziyor, parola yazmiyor.
- **Sebep:** K4 (KRITIK) - Production seed'inde varsayilan zayif parola ve console.log'a yazilmasi.
- **Test/Notlar:** `.env.example`'a `ADMIN_*` blogu eklendi; `npm run db:seed` `.env`siz hata vermeli.

---

### FIX-5: orderNumber race condition - P2002 retry helper → tamamlandi
- **Dosyalar:**
  - `src/lib/order-number.ts` — yeni `withOrderNumberRetry` helper (5 deneme, P2002'de retry).
  - `src/app/api/veli/order/route.ts` — `generateOrderNumber()` cagrisi kaldirildi, transaction `withOrderNumberRetry((orderNumber) => prisma.$transaction(...))` icine sarildi.
- **Yapilan:** Es zamanli iki siparis ayni `orderNumber`'i alirsa P2002 yakalanir ve yeni numara ile retry edilir.
- **Sebep:** O1 (ONEMLI) - Race condition: ayni saniyede iki siparis ayni numarayi paylasabiliyordu.
- **Test/Notlar:** Helper genel; ileride mudur/admin tarafindan order olusturulacaksa orada da kullanilmali.

---

### FIX-6: Cancel request process - status check sirasi + transaction → tamamlandi
- **Dosyalar:** `src/app/api/admin/cancel-requests/[id]/process/route.ts`
- **Yapilan:**
  - `cancelRequest.status !== 'PENDING'` check eklendi (zaten islenmis talebi yeniden islemeyi engeller).
  - `CANCELLABLE_STATUSES` kontrolu update'ten ONCE yapildi (eski hali update sonrasiydi, tutarsiz state olusabiliyordu).
  - `cancelRequest.update` + `order.update` artik `prisma.$transaction` icinde, ayni anda PROCESSED + CANCELLED.
  - `processRefund` transaction disinda; basarisiz olursa yorum/log yazilir ama transaction rollback olmaz (refund retry'i ayri bir akis).
- **Sebep:** O2 - Talep islenirken state inconsistency riski.
- **Test/Notlar:** Iki admin ayni anda approve ederse ikincisi 400 (already processed) almali.

---

### FIX-7: Veli cancel-request - phone auth + 24h cooldown → tamamlandi
- **Dosyalar:**
  - `src/app/api/veli/cancel-request/route.ts` — POST/GET'e `phone` zorunlu, last-4 verification.
  - POST'a 24 saat icinde REJECTED talep tekrar acmayi engelleyen rate-limit (429 doner).
  - `src/app/siparis-takip/page.tsx` — POST cancel-request cagrisi phone'u gonderir.
- **Yapilan:** Veli iptal akisina IDOR koruma + spam (REJECTED'i hemen yenileme) cooldown.
- **Sebep:** K2 + O3 (REJECTED bypass) — talep reddedildikten sonra hemen tekrar acilabiliyordu.
- **Test/Notlar:** REJECTED'in 24 saat icinde tekrar denenmesi 429 vermeli; sonra (testler icin) talep tekrar olusabilmeli.

---

### FIX-8: Telefon formati - normalizasyon ve esnek regex → tamamlandi
- **Dosyalar:**
  - `src/app/api/veli/order/route.ts` — `phone.replace(/[\s-]/g, '')` normalize.
  - `src/app/paket/[id]/page.tsx` — submit oncesi `phone.replace(/[\s\-()]/g, '')` ile normalize, regex parantez/tire/bosluk toleranslı.
- **Yapilan:** "0 532 123 45 67", "0532-123-4567", "(0532) 123 45 67" gibi yazimlar artik kabul edilir; DB'ye normalized halde yazilir.
- **Sebep:** O4 - Telefon format esnekligi, arama/IDOR last-4 karsilastirmasinin tutarli olmasi icin.
- **Test/Notlar:** Eski siparislerde DB'de bosluklu kayitlar olabilir; siparis-takip sorgusu icin son 4 hane karsilastirma yapildigi icin etkilenmez.

---

### FIX-9: Mock entegrasyon default'lari false → tamamlandi
- **Dosyalar:**
  - `src/lib/iyzico.ts`, `src/lib/email.ts`, `src/lib/sms.ts`, `src/lib/aras-kargo.ts`, `src/lib/kolaybi.ts` — Tum mock flag'ler `process.env.USE_MOCK_X === 'true'` patternine cevrildi (eskisi `!== 'false'` idi, varsayilan acikti).
  - `.env.example` — `ADMIN_EMAIL/ADMIN_PASSWORD/ADMIN_NAME` eklendi; mock flag yorum blogu "default KAPALI, dev'de 'true' verin" diyecek sekilde guncellendi.
- **Yapilan:** Production'da env yoksa veya bos ise gercek API kullanilir; mock yanlislikla acik kalmaz.
- **Sebep:** K5 (KRITIK) - Production'da yanlis konfigurasyon mock'u acabilir, sahte odeme/fatura olabilirdi.
- **Test/Notlar:** Dev ortaminda `.env`'de `USE_MOCK_*=true` actikca calisir; tum bayraklar bos ise iyzico/kolaybi/aras "henuz yapilandirilmadi" hatasi atar (TODO).

---

### FIX-10: TC Kimlik Numarasi checksum validasyonu → tamamlandi
- **Dosyalar:**
  - `src/lib/utils.ts` — yeni `isValidTCKimlik(value: string): boolean` helper. T.C. resmi algoritma: 11 hane, ilk hane 0 olamaz, 10. hane `((1+3+5+7+9 toplamı)*7 - (2+4+6+8 toplamı)) mod 10`, 11. hane `ilk 10 hane toplam mod 10`.
  - `src/app/api/veli/order/route.ts` — `String(taxNumber).length !== 11` checki `isValidTCKimlik(...)` ile degistirildi.
  - `src/app/paket/[id]/page.tsx` — `tcNumber.length !== 11` checki `isValidTCKimlik(...)` ile degistirildi.
- **Yapilan:** Bireysel fatura icin TC kimlik dogrulamasi sadece 11 hane saymak yerine resmi checksum'i da kontrol ediyor.
- **Sebep:** O5 - 11111111111 gibi gecersiz numaralar kabul ediliyordu, fatura/iade surecinde sorun cikariyordu.
- **Test/Notlar:** Frontend input maxLength=11/digit-only; backend de checksum'i tekrar dogruluyor (defense in depth).

---

### FIX-11: studentSection uzunluk validasyonu (backend) → tamamlandi
- **Dosyalar:** `src/app/api/veli/order/route.ts`
- **Yapilan:** Order POST'a `studentSection.length > 4` ise 400 doner kontrolu eklendi (DB'de `VarChar(4)` zaten kisitli).
- **Sebep:** O6 - Frontend slice(0,4) yapsa da API direkt cagrilirsa Prisma `P2000` Internal hata atiyor; net hata mesaji daha iyi UX.
- **Test/Notlar:** Frontend zaten kisitli, sadece API kullaniminda etkili.

---

### FIX-12: Admin/Mudur login brute-force rate-limit → tamamlandi
- **Dosyalar:**
  - `src/app/api/admin/auth/login/route.ts` — `checkRateLimit/recordFailedAttempt/resetRateLimit` import; identifier `admin-login:${ip}:${email}`; max 5 deneme / 15 dakika; basarili giriste reset.
  - `src/app/api/mudur/auth/login/route.ts` — ayni yapi, identifier `mudur-login:${ip}:${email}`.
- **Yapilan:** Admin/Mudur login uclarina brute-force korumasi. Veli `verify-password` zaten rate-limited idi (10 deneme / 3 saat); admin/mudur'da yoktu.
- **Sebep:** K6 (KRITIK) - sinirsiz parola denemesi, zayif parola/hesap brute-force riski.
- **Test/Notlar:** Identifier IP+email cunku aynı IP'den farkli kullanicilari deneyen saldirilara karsi kosullu. 5 yanlis = 15 dk blok.

---

### FIX-13: Veli order/payment rate-limit → tamamlandi
- **Dosyalar:**
  - `src/app/api/veli/order/route.ts` — POST: 10 siparis denemesi / 10 dakika / IP. `recordFailedAttempt` her denemede sayar (basarili da dahil cunku spam siparis engellenmek isteniyor).
  - `src/app/api/veli/payment/route.ts` — POST: 10 odeme denemesi / 10 dakika / IP. `recordFailedAttempt` her denemede sayar.
  - Bonus: payment route'da `prisma.order.update` hatali `where: { id: orderId }` (orderNumber ile gelirse undefined olabiliyordu) `where: { id: order.id }` olarak duzeltildi.
- **Yapilan:** Veli yuzeyindeki write endpoint'lerine basit IP tabanli rate-limit. Spam siparis ve kart deneme saldirisi azaltildi.
- **Sebep:** O7 - sinirsiz POST cagrisi; potansiyel kart bilgisi enumeration ve DB doldurma.
- **Test/Notlar:** rate-limit-log'lar 24 saatte cleanupExpiredRateLimits ile temizlenmeli (cron yok henuz, NEXT-STEPS'te).

---

### FIX-14: Content-Security-Policy header → tamamlandi
- **Dosyalar:** `next.config.ts`
- **Yapilan:** `securityHeaders` listesine `Content-Security-Policy` eklendi. Directives:
  - `default-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'`, `form-action 'self'`
  - `img-src 'self' data: blob: https:` (Excel ikonlari, kargo logolari icin)
  - `style-src 'self' 'unsafe-inline'`, `script-src 'self' 'unsafe-inline' 'unsafe-eval'` (Next.js App Router runtime gerekli)
  - `connect-src` whitelist: iyzico, kolaybi, aras, twilio, resend, gemini
  - `frame-src` iyzico (3D secure modal icin)
- **Sebep:** O8 - XSS yuk pazarlamasinda CSP yoktu; guvenlik header'lari yarim kaliyor.
- **Test/Notlar:** `'unsafe-inline'/eval` Next.js'in inline script enjeksiyonu icin gecici. Ileride nonce'a gecilebilir. Iyzico 3DS modali test edilmeli.

---

### FIX-15: Admin/Mudur students/export rotalari kontrol → dogrulandi (degisiklik gerekli degil)
- **Dosyalar:** `src/app/api/admin/students/export/route.ts`, `src/app/api/mudur/students/export/route.ts` (her ikisi de mevcut)
- **Yapilan:** Sadece varlik ve session koruma kontrolu yapildi.
  - Admin: `getAdminSession()` ile yetki kontrolu, opsiyonel `?schoolId=` ile filtreleme; 3 sayfalik Excel uretiyor (Tum Ogrenciler, Okul Bazli Ozet, Sinif Bazli).
  - Mudur: `getMudurSession()` ile yetki kontrolu, kendi `schoolId`'sine kilitli; ayni 3 sayfa formati.
- **Sebep:** Bulgular raporundaki "S6 - mudur students/export ekrani var ama route var mi?" sorusu icin dogrulama. Iki route da var, calisiyor, IDOR yok (mudur sadece kendi okulunu cekiyor).
- **Test/Notlar:** Frontend tarafinda export butonu Excel indirme icin fetch + blob donusumu yapmali. Henuz kontrol edilmedi.

---

## Ozet — Tamamlanan Tum FIX'ler

| FIX | Tip | Bulgu | Durum |
|-----|-----|-------|-------|
| FIX-1 | KRITIK | mockPayment bypass | tamamlandi |
| FIX-2 | KRITIK | Veli IDOR (auth yok) | tamamlandi |
| FIX-3 | KRITIK | Cascade DELETE veri kaybi | tamamlandi |
| FIX-4 | KRITIK | Default seed parolasi + log | tamamlandi |
| FIX-5 | ONEMLI | orderNumber race | tamamlandi |
| FIX-6 | ONEMLI | Cancel request state inconsistency | tamamlandi |
| FIX-7 | ONEMLI | REJECTED bypass + cancel-request IDOR | tamamlandi |
| FIX-8 | ONEMLI | Telefon format esneklik | tamamlandi |
| FIX-9 | KRITIK | Mock default'lari | tamamlandi |
| FIX-10 | ONEMLI | TC checksum | tamamlandi |
| FIX-11 | KUCUK | studentSection length validation | tamamlandi |
| FIX-12 | KRITIK | Login brute-force | tamamlandi |
| FIX-13 | ONEMLI | Veli endpoint rate-limit | tamamlandi |
| FIX-14 | ONEMLI | CSP header | tamamlandi |
| FIX-15 | DOGRULAMA | export route varlik | dogrulandi |

Toplam 15 bulgu/kontrol islendi.

---

## Manuel Test Sonrasi Ek Fix'ler (2026-04-08)

> Manuel scenario testleri (`04-TEST-REPORT.md`) sirasinda 6 yeni bug tespit edildi ve hepsi duzeltildi.

### FIX-T1: Cancel approve refund persist + processedBy → tamamlandi
- **Dosyalar:** `src/app/api/admin/cancel-requests/[id]/process/route.ts`
- **Yapilan:**
  - Transaction icindeki `cancelRequest.update`'a `processedBy: session.id` eklendi (BUG-T2).
  - `processRefund` cagrisi sonrasi, refund basariliysa hem `cancel_requests.refundId/refundAmount/refundedAt` hem de `orders.refundedAt` atomik olarak persist ediliyor (BUG-T1).
  - Donen `finalRequest` artik refund alanlarini iceriyor (response'ta gozukuyor).
- **Sebep:** BUG-T1 + BUG-T2 — onceden refund cagriliyor ama donen ID/amount/timestamp veritabanina yazilmiyor, processedBy hicbir zaman set edilmiyordu.
- **Test:** Manuel test'le dogrulandi. ORD-2026-00014 cancel approve sonrasi tum alanlar dolu: `processedBy=admin id`, `refundId=REF_*`, `refundAmount=1500.00`, `refundedAt=timestamp`, `orders.refundedAt=ayni timestamp`.

### FIX-T2: iyzico processRefund USE_MOCK gate → tamamlandi
- **Dosyalar:** `src/lib/iyzico.ts`
- **Yapilan:** `processRefund` fonksiyonu artik `USE_MOCK_PAYMENT` flag'ini kontrol ediyor; flag false ise diger fonksiyonlarla tutarli sekilde "Gercek Iyzico entegrasyonu henuz yapilandirilmadi" hatasi atiyor.
- **Sebep:** BUG-T3 — onceden flag check yoktu, prod'da bile her zaman mock yanit donuyordu; bu durum iyzico.ts'nin diger fonksiyonlariyla tutarsizdi.
- **Test:** Kod review ile dogrulandi. Mock acikken eski davranis devam ediyor, kapaliyken artik error firlatiyor.

### FIX-T3: Discount silently ignore → discountWarning field → tamamlandi
- **Dosyalar:** `src/app/api/veli/order/route.ts`
- **Yapilan:** Discount kontrol blogu yeniden yapilandirildi; her gecersizlik durumu (kod yok / aktif degil / henuz baslamamis / suresi dolmus / limit dolu / minAmount yetersiz) icin ayri Turkce mesaj `discountWarning` degiskenine yaziliyor. POST response'una `discountWarning` field'i eklendi (hem KART hem KAPIDA dallarinda).
- **Sebep:** BUG-T4 (UX) — gecersiz kod kullaniminda kullanici sebebi gormuyordu, sadece `discountAmount: 0` doniyordu.
- **Test:** Manuel test'le dogrulandi. `BOGUS_DOESNT_EXIST` -> "Indirim kodu bulunamadi"; `EXPIRED_T4` -> "Bu indirim kodunun suresi dolmus".

### FIX-T4: Admin orders search/limit/pagination → tamamlandi
- **Dosyalar:** `src/app/api/admin/orders/route.ts`
- **Yapilan:**
  - `search` parametresi: `OR` query ile orderNumber/parentName/studentName/phone/email alanlarinda arama (Prisma `contains`).
  - `limit` parametresi: 1-100 arasi clamp, default 50.
  - `page` parametresi: skip/take pagination.
  - Response'a `pagination: { page, limit, total, totalPages }` eklendi.
  - `Prisma.OrderWhereInput` typed where, `prisma.$transaction` ile findMany + count atomik.
- **Sebep:** BUG-T5 — backend hicbir search/limit param'ini desteklemiyordu, frontend gondermesine ragmen ignore ediliyor, her zaman tum siparisler doniyordu.
- **Test:** Manuel test'le dogrulandi. `?search=ORD-2026-00004` -> tek siparis; `?limit=3&page=1` -> 3 siparis + `totalPages: 4`; `?search=Email` -> tek siparis (parentName match).

### FIX-T6: CSP frame-src blob: izni (kargo etiketi onizleme) → tamamlandi
- **Dosyalar:** `next.config.ts`
- **Yapilan:** CSP'ye `worker-src 'self' blob:` direktifi eklendi; `frame-src` ve `connect-src` direktiflerine `blob:` izni eklendi.
- **Sebep:** Admin > Siparisler > "Kargo Etiketi" butonu jspdf ile client-side PDF uretip `doc.output('bloburl')` ile blob URL aliyor ve `<iframe src={blobUrl}>` ile dialog'da gosteriyor. Onceki CSP `frame-src 'self' https://sandbox-api.iyzipay.com https://api.iyzipay.com` blob:'a izin vermedigi icin browser iframe'i blokluyor ve "Bu icerik engellenmistir" gosteriyor.
- **Test/Notlar:** Dev server restart sonrasi etiket dialog'u acilmali. Kullanici Ctrl+Shift+R ile hard refresh yapmali (browser eski CSP header'i cache'leyebilir).

### FIX-T5: Veli order GET last4 brute-force koruma → tamamlandi
- **Dosyalar:** `src/app/api/veli/order/route.ts`
- **Yapilan:**
  - Import'a `resetRateLimit` eklendi.
  - GET handler'a `veli-order-get:${ip}:${orderKey}` identifier'i ile 10/15dk rate limit eklendi.
  - Yanlis last4 -> `recordFailedAttempt` cagriliyor; basarili dogrulama -> `resetRateLimit` ile sayac sifirlaniyor.
- **Sebep:** BUG-T6 — last-4 dogrulama icin rate limit yoktu; teorik olarak 10000 deneme ile brute force mumkundu.
- **Test:** Manuel test'le dogrulandi. Ayni order id ile yanlis phone gonderen 10 istek 403 doniyor, 11. istekte 429 oluyor.

### Manuel Test Sonrasi Ozet

| FIX-T | Bug | Severity | Dosya |
|-------|-----|----------|-------|
| FIX-T1 | BUG-T1+T2 | Orta | cancel-requests/[id]/process/route.ts |
| FIX-T2 | BUG-T3 | Dusuk | lib/iyzico.ts |
| FIX-T3 | BUG-T4 | UX/Orta | api/veli/order/route.ts (POST) |
| FIX-T4 | BUG-T5 | Orta | api/admin/orders/route.ts |
| FIX-T5 | BUG-T6 | Dusuk | api/veli/order/route.ts (GET) |

Toplam 6 yeni bug duzeltildi (5 fix'le, T1+T2 ayni dosyada birlestirildi).
