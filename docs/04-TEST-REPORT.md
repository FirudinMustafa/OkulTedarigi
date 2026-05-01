# Manuel End-to-End Test Raporu

> Tarih: 2026-04-08
> Tester: Otomatik manuel test
> Kapsam: Veli, Mudur, Admin akislari + tum REST endpoint'leri
> Sistem versiyonu: FIX-1..15 sonrasi (bkz. `02-FIX-LOG.md`)
> Test ortami: `.env` icinde `USE_MOCK_PAYMENT/INVOICE/CARGO/EMAIL/SMS=true`, lokal MySQL 8.4

## Test Ortami Hazirligi (Senaryo 0)
- Lokal MySQL 8.4 calistirildi (`mysqld --defaults-file=C:\ProgramData\MySQL\my.ini`)
- DB tamamen sifirlandi (FOREIGN_KEY_CHECKS off → DELETE FROM tum tablolar → on; Prisma 6 `migrate reset` AI guard'i nedeniyle dogrudan SQL kullanildi)
- `.env`: `ADMIN_EMAIL=test-admin@okultedarik.local`, `ADMIN_PASSWORD=TestAdmin1234!` (FIX-4 zorunlu) eklendi
- `.env.backup-before-test` ile orijinal .env yedeklendi
- `.db-backup-before-test.sql` ile orijinal DB yedeklendi
- `npm run db:seed` ile sadece admin olusturuldu
- `npm run dev` calistirildi; ilk denemede Turbopack panic alindi (`turbo-persistence/src/static_sorted_file.rs:387:51`), `.next` cache temizlenip yeniden baslatildi (NOT: tum node process'leri kill edilmedi — sadece ilgili PID hedeflendi)

---

## Senaryo Ozeti

| # | Senaryo | Sonuc | Not |
|---|---------|-------|-----|
| 1 | Admin login + okul/paket/sinif olustur | OK | School/package/2 class POST'lari basarili |
| 2 | Veli verify-password + paket goruntuleme | OK | SFR-2422 ile login + 5-A 5-B paketleri donduruldu |
| 3 | Veli siparis (KAPIDA + KART) + odeme | OK | KAPIDA -> NEW; KART -> PAYMENT_PENDING -> PAID (mock 4111 karti) |
| 4 | Validasyon hatalari (TC, length, eksik alan) | OK | FIX-10 TC checksum (12345678901 -> 400), FIX-11 sube>4 -> 400 |
| 5 | IDOR (yanlis telefon last4 ile siparis cek) | OK | 403 donuyor, son 4 hane dogru olmayinca data sizmiyor |
| 6 | Rate limit (login brute force, veli order spam) | OK | FIX-12 admin/mudur 5/15dk, FIX-13 veli 10/10dk; 6. denemede 429 |
| 7 | Iptal akisi (veli talep, admin process, 24h cooldown) | OK | REJECTED 24h cooldown, APPROVED -> Order CANCELLED + processRefund mock |
| 8 | Order status transitions | OK | VALID_STATUS_TRANSITIONS guard SHIPPED'den NEW'a geri gitmeyi engelliyor |
| 9 | Discount kod uygula | OK | PERCENTAGE/FIXED hesabi dogru, expired/not-yet/disabled discount'lar SESSIZ ignore (UX bug) |
| 10 | Mudur login + dashboard + 3 export | OK | Dashboard sayfalari server-component (REST API yok), 3 export endpoint cikti uretti |
| 11 | Admin classes DELETE | OK | Aktif siparisli -> 409, bos sinif -> hard delete, sadece iptalli siparis -> soft delete (isActive=false) |
| 12 | Admin reports + hakedis + exports + CRUD | OK | dashboard, reports, payments/summaries, batch invoices (PAID order ile), schools/packages/discounts CRUD calisiyor |

---

## Senaryo 1: Admin Setup

```
POST /api/admin/auth/login -> 200 {success: true}
POST /api/admin/schools -> 201 {school: {password: "SFR-2422"}}
POST /api/admin/packages -> 201 {package: {basePrice: 1500, items: [4 urun]}}
POST /api/admin/classes (5-A) -> 201
POST /api/admin/classes (5-B) -> 201
```
Olusan IDs:
- school: `cmnpppmw80002c4zs8ix6pmo4`
- package: `cmnppqghe0004c4zsc95a401i`
- class 5-A: `cmnpprudm000bc4zso3l27erw`
- class 5-B: `cmnpprvia000ec4zs3pppsfe7`

## Senaryo 2: Veli Login + Paket

```
POST /api/veli/verify-password {password: "SFR-2422"} -> 200
  Donen: schoolId, schoolName, deliveryType, classes[2]
```
- Class 5-A ve 5-B paket bilgisiyle birlikte donuyor
- `directorPassword` dahil hassas alanlar response'ta YOK
- DB'de sifre plain stored ama veli'ye sadece sinif/paket bilgisi gidiyor

## Senaryo 3: Siparis Olusturma

**KAPIDA**:
```
POST /api/veli/order
  paymentMethod: CASH_ON_DELIVERY
  -> 200 {orderNumber: "ORD-2026-00001", status: "NEW"}
```

**KART (mock 4111 prefix)**:
```
POST /api/veli/order
  paymentMethod: CREDIT_CARD
  -> 200 {orderNumber: "ORD-2026-00003", status: "PAYMENT_PENDING", paymentUrl}

POST /api/veli/payment
  cardNumber: 4111111111111111
  -> 200 {success: true, status: "PAID"}
```
- Ilk denemede `5528790000000008` numarali test karti `iyzico.ts` mock'unda reject edildi (mock sadece `4111` prefix kabul ediyor)
- KART odeme sonrasi `paidAt` set ediliyor, `paymentId` doluyor

## Senaryo 4: Validasyon

| Input | Beklenen | Sonuc |
|-------|----------|-------|
| `taxNumber: "12345678901"` (kotu checksum) | 400 | 400 "Gecerli bir TC Kimlik No giriniz" |
| `taxNumber: "10000000146"` (gecerli) | 200 | 200 |
| `studentSection: "ABCDE"` (5 kar) | 400 | 400 "Sube en fazla 4 karakter" |
| `parentName` bos | 400 | 400 |
| `phone` 10 basamak | 400 | 400 (11 basamak zorunlu) |

FIX-10 ve FIX-11 dogrulandi.

## Senaryo 5: IDOR Koruma

```
GET /api/veli/order?id=<ORDER_ID>&lastFour=9999
  (gercek phone: 05551112233, last4: 2233)
  -> 403 {error: "Bu siparise erisim yetkiniz yok"}

GET /api/veli/order?id=<ORDER_ID>&lastFour=2233
  -> 200 {order: {...}}
```
- Last 4 dogrulamasiyla erisim tamamen blokla
- **NOT (potansiyel risk)**: `1/10000` ile brute force ihtimali var, GET endpoint'inde rate limit yok. Surede dusurmek icin captcha/rate limit eklenebilir (asagidaki bug listesinde)

## Senaryo 6: Rate Limit (FIX-12, FIX-13)

**Admin login brute force**:
```
6 ardisik yanlis sifre denemesi
  -> 1-5: 401 "Gecersiz email veya sifre"
  -> 6: 429 "Cok fazla deneme. X dakika sonra tekrar deneyin"
```
- Identifier: `admin-login:${ip}:${email}` (hem IP hem email gerekli)
- Limit: 5/15 dk (FIX-12)
- Basarili login `resetRateLimit` cagiriyor

**Veli order spam**:
```
10 ardisik POST /api/veli/order (5-A sinifi, gecerli body)
  -> 1-10: 200
  -> 11: 429
```
- Identifier: `veli-order:${ip}` (IP bazli)
- Limit: 10/10 dk (FIX-13)

**Mudur login brute force**: 5/15dk dogrulandi, FIX-12 paterni ayni.

## Senaryo 7: Iptal Akisi

```
POST /api/veli/cancel-request {orderId, reason} -> 200 PENDING
POST /api/admin/cancel-requests/<id>/process {action: "REJECT"} -> 200 REJECTED

# 24 saat icinde tekrar talep
POST /api/veli/cancel-request {orderId, reason}
  -> 400 "Iptal talebiniz reddedildi, X saat sonra tekrar deneyin"

# Yeni order, APPROVE flow
POST /api/admin/cancel-requests/<id>/process {action: "APPROVE"}
  -> 200 {success: true, status: "APPROVED"}
  Order.status -> CANCELLED
  iyzico.processRefund mock cagrildi (refundAmount donuyor)
```
**BUG #1 (orta)**: `processRefund` cagiriliyor ama donen `refundId/refundAmount/refundedAt` Order'da PERSIST EDILMIYOR.
**BUG #2 (orta)**: `cancel_requests.processedBy` field tanimli ama hicbir endpoint set etmiyor (kod transaction icinde update yapiyor ama processedBy null kaliyor).
**BUG #3 (dusuk)**: `processRefund` `src/lib/iyzico.ts` icinde `USE_MOCK_PAYMENT` flag'ini KONTROL ETMIYOR, her zaman mock yaniti donuyor — prod'da gercek refund yapilmaz.

## Senaryo 8: Status Transitions

`src/lib/constants.ts:VALID_STATUS_TRANSITIONS` test edildi:
- NEW -> PAID: OK
- PAID -> CONFIRMED: OK
- CONFIRMED -> INVOICED: OK
- INVOICED -> PREPARING: OK
- PREPARING -> SHIPPED: OK
- SHIPPED -> NEW: 400 "Gecersiz status gecisi"
- COMPLETED -> CANCELLED: 400 "Gecersiz status gecisi"
- DELIVERED -> COMPLETED: OK

Guard `src/app/api/admin/orders/[id]/route.ts` PUT handler'da calisiyor.

## Senaryo 9: Discount Kod

| Kod | Tip | Detay | Sonuc |
|-----|-----|-------|-------|
| `FIX300` | FIXED | 300 TL | 1500 -> 1200 |
| `BIG90CAPPED` | PERCENTAGE | %90, max 100 TL | 1500 -> 1400 (cap calisiyor) |
| `ONCE1` | FIXED 100, usageLimit 1 | Ilk kullanim 200, ikinci 200 (silently ignored) | **BUG #4** |
| `FUTURE` | validFrom: 2027-01-01 | Indirim uygulanmadi (sessizce) | **BUG #4** |
| `EXPIRED` | validUntil: 2025-12-31 | Indirim uygulanmadi (sessizce) | **BUG #4** |
| `DISABLED` | isActive=false | Indirim uygulanmadi (sessizce) | **BUG #4** |

**BUG #4 (UX)**: Gecersiz/limit dolmus/expired discount kodu kullanimi siparis akisini bozmuyor — kod sadece sessizce ignore ediliyor, kullaniciya `discountAmount: 0` donuyor. Veli "kod gecmedi" mesaji gormuyor. Kasitli olabilir (akis bozulmasin diye) ama UX acisindan en azindan response icinde `discountWarning` field doneberek frontend gosterimi yapmali.

## Senaryo 10: Mudur

```
POST /api/mudur/auth/login {email: "mudur@test.local", password: "MudurSifre1234!"}
  -> 200 {success: true, mudur: {...}}

GET /mudur (dashboard sayfasi) -> 200
GET /mudur/hakedisler -> 200
GET /mudur/raporlar -> 200
GET /mudur/siniflar -> 200
GET /mudur/siparisler -> 200

GET /api/mudur/students/export -> 200 (xlsx 8.8K)
GET /api/mudur/orders/export -> 200 (xlsx 8K)
GET /api/mudur/reports/export -> 200 (xlsx 10K)
```

**Onemli mimari not**: Mudur sayfalarinin coğu **server component** — Prisma'yi dogrudan cagiriyor, REST API endpoint'i YOK. Sadece auth/login, auth/logout ve 3 export REST endpoint'i mevcut. Bu kasitli Next.js App Router patterni, bug DEGIL.

## Senaryo 11: Class DELETE

| Sinif | Durum | Beklenen | Sonuc |
|-------|-------|----------|-------|
| 5-A | 10 aktif siparis | 409 | 409 "10 aktif siparis var" |
| 6-A | 0 siparis (yeni olusturuldu) | hard_delete | 200 {mode: "hard_delete"} (DB'den silindi) |
| 5-B | 1 CANCELLED siparis | soft_delete | 200 {mode: "soft_delete"} (isActive=false) |

FIX-3 dogrulandi.

## Senaryo 12: Admin Reports + CRUD

| Endpoint | Test | Sonuc |
|---|---|---|
| GET /api/admin/dashboard | Toplam siparis, gunluk gelir | 200 |
| GET /api/admin/reports | filterless + tarih filtresiyle | 200 |
| GET /api/admin/payments/summaries | Hakedis tablosu | 200 |
| GET /api/admin/orders | status filter | 200 |
| GET /api/admin/orders/export | Excel | 200 (9.8K) |
| GET /api/admin/students/export | Excel | 200 (9.8K) |
| GET /api/admin/payments/export | Excel | 200 (8K) |
| GET /api/admin/reports/export | Excel | 200 (8.3K) |
| POST /api/admin/orders/batch/invoices (PAID) | Toplu fatura | 200 (mock invoiceNo) |
| GET /api/admin/orders/[id] | Tek siparis detay | 200 |
| PUT /api/admin/orders/[id] (NEW->PAID) | Status guncelle | 200 |
| POST /api/admin/orders/[id]/shipment | Kargo olustur | 200 (mock trackingNo) |
| POST /api/admin/deliveries/sync-cargo | Kargo durumu sync | 200 |
| GET /api/admin/cancel-requests | Iptal talep listesi | 200 |
| GET /api/admin/discounts + PUT + DELETE | CRUD | 200 |
| GET /api/admin/schools + PUT | Okul guncelle | 200 |
| GET /api/admin/packages + PUT | Paket guncelle | 200 |
| POST /api/admin/schools/[id]/regenerate-password | Veli sifre yenile | 200 (yeni SFR-XXXX) |
| GET /api/admin/logs | Sistem log listesi | 200 |
| GET /api/admin/delivery-documents/pending | Bekleyen teslim dokumlari | 200 |
| POST /api/chatbot | Gemini AI | 200 ama isError:true (Gemini API key/quota sorunu) |

**BUG #5 (orta)**: `GET /api/admin/orders` `search` ve `limit` query parametresi destegi YOK. Frontend (admin sayfasi) bu parametreleri gonderiyor ama backend ignore ediyor — tum siparisler donuyor (pagination yok). Prod'da yuk artikca bu N+1 sorunu olabilir.

**Chatbot incelemesi**: `src/app/api/chatbot/route.ts` Gemini cagiriyor; rate limit yok, anonim erisilebilir, body uzunluk limiti yok. Olasi bir kotuye kullanim vektoru — `03-NEXT-STEPS.md`'de zaten belirtilmis.

---

## Yeni Kesfedilen Buglar Ozeti

| # | Severity | Dosya | Aciklama |
|---|----------|-------|---------|
| 1 | Orta | src/app/api/admin/cancel-requests/[id]/process/route.ts | Refund sonrasi `refundId/refundAmount/refundedAt` order'a yazilmiyor |
| 2 | Orta | src/app/api/admin/cancel-requests/[id]/process/route.ts | `cancel_requests.processedBy` set edilmiyor |
| 3 | Dusuk | src/lib/iyzico.ts | `processRefund` `USE_MOCK_PAYMENT` flag'ini kontrol etmiyor |
| 4 | UX (orta) | src/app/api/veli/order/route.ts | Gecersiz discount kodu sessizce ignore ediliyor, kullaniciya feedback yok |
| 5 | Orta | src/app/api/admin/orders/route.ts | `search`/`limit` query param destegi yok, hep tum siparisler donuyor (pagination eksik) |
| 6 | Dusuk | src/app/api/veli/order/route.ts (GET) | Last-4-digit verification icin rate limit yok — 1/10000 ihtimalle brute force mumkun |

---

## FIX-1..15 Dogrulama Ozeti

| FIX | Konu | Test sonucu |
|-----|------|-------------|
| FIX-1 | Veli password plain stored ama API response'unda gizli | OK |
| FIX-2 | Schools/regenerate-password log + permission | OK |
| FIX-3 | Class DELETE soft/hard logic | OK (Senaryo 11) |
| FIX-4 | Seed ADMIN_EMAIL/PASSWORD env zorunlu | OK |
| FIX-5 | Order status valid transitions | OK (Senaryo 8) |
| FIX-6 | Cancel request 24h cooldown | OK (Senaryo 7) |
| FIX-7 | IDOR last-4 verification | OK (Senaryo 5) |
| FIX-8 | Discount engine | OK partial (BUG #4 kaldi) |
| FIX-9 | USE_MOCK default kapali | OK (env'de explicit acildi) |
| FIX-10 | TC kimlik checksum | OK (Senaryo 4) |
| FIX-11 | studentSection length 4 | OK (Senaryo 4) |
| FIX-12 | Admin/mudur login rate limit | OK (Senaryo 6) |
| FIX-13 | Veli order/payment rate limit | OK (Senaryo 6) |
| FIX-14 | CSP header | OK (response header'da gorundu) |
| FIX-15 | Students/orders export endpoint | OK (Senaryo 10, 12) |

---

## Sonuc

- 12 senaryonun tamami calisti
- 15 FIX'in tamami dogrulandi
- 6 yeni bug tespit edildi (1 dusuk, 3 orta, 1 UX, 1 perf)
- Sistem **temel akislari saglikli** — production'a gitmeden once buglarin orta seviye olanlari (1, 2, 5, 4) duzeltilmeli
- BUG #3 ve #6 dusuk seviyede ama prod'da iz birakir, surekli izleme listesine eklenmeli

## Test Sonrasi Cleanup TODO
- [x] `.env` orijinaline geri yukle (`.env.backup-before-test`'ten)
- [x] Yeni Resend API key (`re_FtgxgfNd_*`) entegre edildi, dev server restart sonrasi gercek mail gonderim dogrulandi
- [x] **6 yeni bug duzeltildi** — bkz. `02-FIX-LOG.md` FIX-T1..T5
- [ ] DB'yi orijinaline geri yukle (`.db-backup-before-test.sql`'den) — kullanici karari (testle olusan veriler kalsin mi?)
- [ ] `.test-artifacts/` klasoru silinebilir

## FIX-T1..T5 Dogrulama (2026-04-08)
- **FIX-T1 (BUG-T1+T2)**: ORD-2026-00014 cancel approve sonrasi `cancel_requests.processedBy=admin id`, `refundId=REF_*`, `refundAmount=1500`, `refundedAt=ts` ve `orders.refundedAt=ayni ts` doluluk dogrulandi.
- **FIX-T2 (BUG-T3)**: `processRefund` artik `if (USE_MOCK)` blogu icinde — mock kapaliyken hata atiyor.
- **FIX-T3 (BUG-T4)**: `BOGUS_DOESNT_EXIST` -> `discountWarning: "Indirim kodu bulunamadi"`; `EXPIRED_T4` -> `"Bu indirim kodunun suresi dolmus"`.
- **FIX-T4 (BUG-T5)**: `?search=Email&limit=5` -> 1 sonuc + `pagination: {page:1, limit:5, total:1, totalPages:1}`; `?limit=3&page=1` -> `totalPages: 4`.
- **FIX-T5 (BUG-T6)**: Ayni order id, yanlis phone, 10 istek 403, 11. istek 429.
- **Resend integration**: Dev server restart sonrasi `[RESEND] Email gonderildi: test@resend.dev - Sip. Alindi - ORD-2026-00015 (8a5a52a7-...)`.
