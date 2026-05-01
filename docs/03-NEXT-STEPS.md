# Sonraki Adimlar

> Bu dosya, mevcut surumde kapsama almadigimiz ama gelecek surumlerde yapilmasi gereken isleri tutar.
> 15 FIX tamamlandiktan sonra (bkz. `02-FIX-LOG.md`) gerideki isleri toparliyor.

## Production Onaylanmadan Once
- [ ] **JWT_SECRET production'da gercek bir secret olarak set edilmeli** (auth.ts zayif iki secret'i prod'da reject ediyor, ama random 32+ byte olmali)
- [ ] **`.env` git'ten cikarilmis mi kontrol et** — eger commit'liyse rotate et: ADMIN_PASSWORD, JWT_SECRET, DATABASE_URL, RESEND_API_KEY, TWILIO_*, GEMINI_API_KEY, IYZICO_*, KOLAYBI_*, ARAS_*
- [ ] Tum `USE_MOCK_*` env'leri prod icin explicit `false` (veya bos) set edilmeli (FIX-9 sonrasi default kapali) ve gercek API anahtarlari girilmeli
- [ ] **ADMIN_EMAIL/ADMIN_PASSWORD env zorunlu** (FIX-4) — `npm run db:seed` `.env` olmadan calismaz
- [ ] Database backup plani kurulmali (ozellikle classes DELETE duzeltmesi sonrasi soft-delete patterni var, hard-delete yok artik ama yine de gerekli)
- [ ] **CSP `unsafe-inline`/`unsafe-eval`** (FIX-14) gercekten gerekli mi tekrar test et; nonce-based CSP'ye gec
- [ ] **Rate-limit log temizleme cron'u** (FIX-12/13) — `cleanupExpiredRateLimits()` periyodik calistirilmali (Vercel cron ya da manuel)
- [ ] iyzico/kolaybi/aras "henuz yapilandirilmadi" hatalari icin gercek client implementasyonu yazilmali (FIX-9 sonrasi mock kapanirsa direkt prod'da patliyor)

## Yarim Birakilan Akislar
- [ ] **REFUNDED status workflow'u** — schema/constants tanımlı ama hicbir endpoint set etmiyor. Admin paneline "Iade Et" butonu + iyzico refund integration eklenmeli. (K8)
- [ ] **CASH_ON_DELIVERY akisi** — siparis NEW olusuyor, admin elle CONFIRMED yapacak ama bu akis dokumante edilmis degil. Admin sayfa rehberligi eklenmeli.

## Manuel Test'te Tespit Edilen Buglar (2026-04-08)
> Detay: `04-TEST-REPORT.md` ve `02-FIX-LOG.md` (FIX-T1..T6)
- [x] **BUG-T1 [orta]** Cancel approve sonrasi refund persist (FIX-T1, 2026-04-08). `cancel_requests.refundId/refundAmount/refundedAt` ve `orders.refundedAt` artik yaziliyor.
- [x] **BUG-T2 [orta]** `cancel_requests.processedBy` (FIX-T1, 2026-04-08). Approve/reject sirasinda admin id set ediliyor.
- [x] **BUG-T3 [dusuk]** `iyzico.processRefund` USE_MOCK gate (FIX-T2, 2026-04-08).
- [x] **BUG-T4 [UX/orta]** Discount warning field (FIX-T3, 2026-04-08). Gecersiz/expired/limit dolmus kodlarda response'a `discountWarning` mesaji eklenir.
- [x] **BUG-T5 [orta]** Admin orders search/pagination (FIX-T4, 2026-04-08). `search`, `limit`, `page` parametreleri + Prisma OR query + total count.
- [x] **BUG-T6 [dusuk]** Veli order GET last-4 rate limit (FIX-T5, 2026-04-08). `veli-order-get:${ip}:${orderKey}` icin 10/15dk limit; basarili dogrulamada reset.

## Iyilestirmeler (orta oncelik)

### Dashboard / Reports
- [ ] Mudur exports'lari pagination/date-range ile sinirla (S7)
- [ ] Dashboard chart'larinda timezone'i UTC ya da `Asia/Istanbul` olarak sabitle (S8)
- [ ] Excel filename'lerinde Turkce karakter mapping ekle (S10)

### UX
- [ ] Discount frontend hesabini her zaman backend'in dondugu finalAmount ile reset et (O2)
- [ ] Delivery PDF olusmazsa frontend'de hata gosterimi (S9)
- [ ] Loading/error state'lerini admin sayfalarinda standartlastir

### KVKK / Guvenlik (next round)
- [ ] PII masking helper'i (`logger.ts` icin email/phone/TC mask) - O7
- [ ] School `password` formatini 8-12 karakter karma yap (next migration ile yeniden uret) - S6
- [ ] Cookie `path` belirt: admin → `/admin`, mudur → `/mudur` - S12
- [ ] Audit trail: tum admin actions icin systemLog zenginlestir (degistirilen alan bazli)

### Refactor / Tutarlilik
- [ ] `basePrice/price` field naming'i tek isime dusur (Decimal cevirme yerine number) (S1)
- [ ] `unitPrice/price` (PackageItem) ayni (S2)
- [ ] API response yapilarini tek format'a indir: hep `{ data, error }` veya hep direct array

### Test
- [ ] E2E test: veli siparis akisi tamami
- [ ] Unit test: VALID_STATUS_TRANSITIONS guard
- [ ] Unit test: discount hesaplamasi (PERCENTAGE/FIXED, maxDiscount cap, minAmount)
- [ ] Unit test: TC kimlik checksum
- [ ] Unit test: orderNumber transaction race

## Kucuk Iyilestirmeler
- [ ] Chatbot endpoint'i (`api/chatbot/route.ts`) detayli incelenmedi → guvenlik review (gemini API key sizdirma riski)
- [ ] Admin sidebar'da silinmis sayfa linki kontrolu
- [x] `students/export` admin ve mudur route'lari mevcut ve session korumali (FIX-15 ile dogrulandi). Frontend buton testi henuz yapilmadi.
- [ ] `paket/[id]/page.tsx` cok uzun (~1000 satir) — formu component'lere bol

## Operasyon
- [ ] Production deploy oncesi smoke test checklist'i
- [ ] CI/CD pipeline (lint + typecheck + prisma validate + build)
- [ ] Monitoring: Sentry/LogRocket
- [ ] Rate-limit metric ve alert
