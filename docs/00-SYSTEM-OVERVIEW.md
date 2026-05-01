# Okul Tedarik Sistemi - Genel Bakis

> Son guncelleme: 2026-04-08

## Stack
- **Framework:** Next.js 16.1.1 (App Router) + React 19 + TypeScript
- **DB:** MySQL 8 (Prisma 6.2.1, 12 model)
- **Auth:** JWT (jose) + bcryptjs, HTTP-only cookies
- **Entegrasyonlar:** Iyzico, KolayBi (e-fatura), Aras Kargo, Resend (email), Twilio (SMS), Gemini (chatbot) - hepsi mock-default

## Roller
| Rol | Auth | Cookie | Sayfalar |
|---|---|---|---|
| **Admin** | JWT (Admin model) | `token` | `/admin/*` - 11 dashboard sayfasi |
| **Mudur** (okul muduru) | JWT (School.directorEmail/directorPassword) | `mudur_token` | `/mudur/*` - 4 dashboard sayfasi |
| **Veli** (parent) | School password (SFR-XXXX, plain) + opsiyonel rate-limit | yok (session-less) | `/`, `/siparis`, `/paket/*`, `/odeme/*`, `/siparis-takip` |

## Veritabani Modelleri
```
School ──┬── Class ──── Order ──┬── CancelRequest
         │                     └── DeliveryDocument
         └── SchoolPayment (komisyon)

Package ──── PackageItem
       └──── Class (atanan paket)
       └──── Order (siparis edilmis paket)

Admin
SystemLog
RateLimitLog
Discount
```

### Onemli enum'lar
- `OrderStatus`: NEW → PAYMENT_PENDING → PAID → CONFIRMED → INVOICED → PREPARING → SHIPPED → DELIVERED → COMPLETED, ayrica CANCELLED, REFUNDED
- `DeliveryType`: CARGO, SCHOOL_DELIVERY
- `CancelRequestStatus`: PENDING, APPROVED, REJECTED
- `DiscountType`: PERCENTAGE, FIXED
- `PaymentMethod`: CREDIT_CARD, CASH_ON_DELIVERY

## Dizin Yapisi
```
src/
  app/
    admin/         11 dashboard sayfasi + login
    mudur/         4 dashboard sayfasi + login
    api/
      admin/       ~33 endpoint
      mudur/       5 endpoint (login, logout, 3 export)
      veli/        6 endpoint (verify-password, class, order, payment, cancel-request, discount)
      chatbot/     1 endpoint (Gemini proxy)
    page.tsx       anasayfa
    siparis/       sifre giris + sinif sec
    paket/[id]/    paket detay + form
    odeme/[id]/    kart formu
    siparis-onay/  onay sayfasi
    siparis-takip/ siparis sorgu
    kvkk, mesafeli-satis  yasal sayfalar

  components/
    admin/         sidebar, DashboardCharts
    mudur/         sidebar, year-filter, report-export-button
    ui/            shadcn (button, input, select, dialog, table, ...)

  lib/
    auth.ts        JWT + bcrypt + getAdminSession + getMudurSession
    prisma.ts      singleton
    rate-limit.ts  DB-tabanli rate limit
    logger.ts      systemLog action helper
    constants.ts   ORDER_STATUS_LABELS, COLORS, VALID_STATUS_TRANSITIONS, ...
    order-number.ts  ORD-YYYY-NNNNN sequential
    password-generator.ts  SFR-XXXX (4 digit)
    iyzico.ts      mock + processPayment + initializePayment
    kolaybi.ts     mock e-fatura
    aras-kargo.ts  mock kargo
    email.ts       Resend wrapper, mock-default
    sms.ts         Twilio wrapper, mock-default
    delivery-pdf.ts  jsPDF teslim tutanagi
    shipping-label.ts  jsPDF kargo etiketi
    utils.ts
```

## Ana Akislar

### Veli Siparis Akisi
1. `/` - anasayfa - "Siparis Ver" butonu
2. `/siparis` - okul sifresi sor → `POST /api/veli/verify-password` → sinif listesi
3. Sinif sec → `/paket/[classId]` - paket detay
4. Form doldur (veli/ogrenci/adres/fatura/indirim/odeme yontemi)
5. `POST /api/veli/order` - siparis olustur
   - CASH_ON_DELIVERY → status=NEW → onay sayfasi
   - CREDIT_CARD → status=PAYMENT_PENDING + paymentUrl → odeme sayfasi
6. `/odeme/[orderId]` - kart formu → `POST /api/veli/payment` → status=PAID
7. `/siparis-onay/[orderNumber]` - onay
8. `/siparis-takip` - tekrar sorgulama (orderNumber + phone)

### Admin Siparis Yonetimi
1. `PAID` siparisler `CONFIRMED` yapilir
2. Toplu fatura: `POST /api/admin/orders/batch/invoices` → `INVOICED`
3. Hazirla → `PREPARING`
4. CARGO ise: kargo etiketi → `SHIPPED`; SCHOOL_DELIVERY ise: tutanak → `DELIVERED`
5. `COMPLETED`

## Mock Bayraklari (.env)
```
USE_MOCK_PAYMENT=true|false   (Iyzico)
USE_MOCK_INVOICE=true|false   (KolayBi)
USE_MOCK_CARGO=true|false     (Aras Kargo)
USE_MOCK_EMAIL=true|false     (Resend)
USE_MOCK_SMS=true|false       (Twilio)
```
**Default:** Tum bayraklar mock-acik. Production'da explicit `false` ve gercek API anahtari gerek.

## Onemli Notlar
- `directorPassword` (mudur giris) bcrypt hash, schema'da `directorPasswordPlain` yok
- `School.password` (veli giris) plaintext + uppercase, format `SFR-XXXX` (`password-generator.ts`)
- `auth.ts` zayif iki JWT secret'i (`dev-secret-do-not-use-in-production-change-me`, `okul-tedarik-super-secret-key-2024-change-in-production`) prod'da reddediyor
- Rate limit sadece `verify-password`'de aktifti (degisecek)
- Docker Compose MySQL 3306 portunda
