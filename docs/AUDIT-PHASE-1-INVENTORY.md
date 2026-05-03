# OkulTedarigi — Aşama 1: Sistem Envanteri

**Tarih:** 2026-05-03  
**Stack:** Next.js 16.2.4 (App Router) + Prisma 6 + MySQL 8 + jose JWT + bcryptjs  
**Toplam:** 47 API endpoint • 25 sayfa • 13 Prisma modeli • 6 enum

---

## 1.1 — API Endpoint Envanteri

### 🛠 Admin (32 endpoint, hepsi `getAdminSession()` kontrollü)

| HTTP | Path | Auth | Zod | Rate Limit | Notlar |
|---|---|---|---|---|---|
| POST | `/api/admin/auth/login` | — | `loginBodySchema` | ✅ 5/15dk specific + 30/30dk global | bcrypt verify |
| POST | `/api/admin/auth/logout` | — | — | — | Cookie temizle |
| GET  | `/api/admin/cancel-requests` | admin | — | — | Tüm iptal taleplerini listeler |
| POST | `/api/admin/cancel-requests/[id]/process` | admin | — | — | Atomic `WHERE status='PENDING'` |
| GET  | `/api/admin/classes` | admin | — | — | |
| POST | `/api/admin/classes` | admin | — | — | ⚠️ Validator yok, manuel kontrol |
| GET  | `/api/admin/classes/[id]` | admin | — | — | |
| PUT  | `/api/admin/classes/[id]` | admin | — | — | |
| DELETE | `/api/admin/classes/[id]` | admin | — | — | Aktif sipariş varsa engellenir |
| GET  | `/api/admin/dashboard` | admin | — | — | Özet metrikler |
| POST | `/api/admin/deliveries/batch` | admin | — | — | action: DELIVERED/COMPLETED |
| POST | `/api/admin/deliveries/sync-cargo` | admin | — | — | Aras kargo (mock) |
| GET  | `/api/admin/delivery-documents` | admin | — | — | |
| POST | `/api/admin/delivery-documents` | admin | — | — | |
| GET  | `/api/admin/delivery-documents/pending` | admin | — | — | |
| GET  | `/api/admin/discounts` | admin | — | — | |
| POST | `/api/admin/discounts` | admin | ✅ `adminDiscountBodySchema` | — | |
| PUT  | `/api/admin/discounts/[id]` | admin | ✅ `adminDiscountUpdateSchema` | — | |
| DELETE | `/api/admin/discounts/[id]` | admin | — | — | |
| GET  | `/api/admin/logs` | admin | — | — | SystemLog listesi |
| GET  | `/api/admin/orders` | admin | — | — | Pagination ✅ `students[]` döner |
| GET  | `/api/admin/orders/[id]` | admin | — | — | |
| PUT  | `/api/admin/orders/[id]` | admin | — | — | Status transition kontrolü ✅ |
| POST | `/api/admin/orders/[id]/invoice` | admin | — | — | Mock fatura |
| POST | `/api/admin/orders/[id]/invoice-cancel` | admin | — | — | INVOICED → CONFIRMED |
| POST | `/api/admin/orders/[id]/shipment` | admin | — | — | Auto-invoice + ship |
| POST | `/api/admin/orders/batch/invoices` | admin | — | — | |
| POST | `/api/admin/orders/batch/shipments` | admin | — | — | Status filter: PAID/CONFIRMED/INVOICED |
| GET  | `/api/admin/orders/export` | admin | — | — | Excel — ✅ RFC 5987 |
| GET  | `/api/admin/packages` | admin | — | — | |
| POST | `/api/admin/packages` | admin | — | — | ⚠️ Validator yok |
| GET  | `/api/admin/packages/[id]` | admin | — | — | |
| PUT  | `/api/admin/packages/[id]` | admin | — | — | |
| DELETE | `/api/admin/packages/[id]` | admin | — | — | |
| GET  | `/api/admin/payments` | admin | — | — | Hakediş listesi |
| POST | `/api/admin/payments` | admin | — | — | Hakediş oluştur |
| GET  | `/api/admin/payments/summaries` | admin | — | — | |
| POST | `/api/admin/payments/[id]/pay` | admin | — | — | Atomic `WHERE status='PENDING'` |
| DELETE | `/api/admin/payments/[id]/pay` | admin | — | — | |
| GET  | `/api/admin/payments/export` | admin | — | — | Excel |
| GET  | `/api/admin/reports` | admin | — | — | |
| GET  | `/api/admin/reports/export` | admin | — | — | Excel |
| GET  | `/api/admin/reports/okul-teslim/export` | admin | — | — | ✅ Yeni — okul teslim raporu |
| GET  | `/api/admin/schools` | admin | — | — | |
| POST | `/api/admin/schools` | admin | — | — | ⚠️ Validator yok, manuel kontrol |
| GET  | `/api/admin/schools/[id]` | admin | — | — | |
| PUT  | `/api/admin/schools/[id]` | admin | — | — | |
| DELETE | `/api/admin/schools/[id]` | admin | — | — | Cascade siniflar/orders |
| POST | `/api/admin/schools/[id]/regenerate-password` | admin | — | — | Yeni rastgele şifre |
| POST | `/api/admin/schools/rotate-legacy-passwords` | admin | — | — | Toplu şifre yenileme |
| GET  | `/api/admin/students/export` | admin | — | — | Excel |

### 🏫 Mudur (5 endpoint, hepsi `getMudurSession()`)

| HTTP | Path | Auth | Zod | Rate Limit | Notlar |
|---|---|---|---|---|---|
| POST | `/api/mudur/auth/login` | — | `loginBodySchema` | ✅ 5/15dk + 30/30dk | bcrypt + token rotation |
| POST | `/api/mudur/auth/logout` | mudur | — | — | `invalidateSessionCache` çağırır |
| GET  | `/api/mudur/orders/export` | mudur | — | — | Excel — ✅ RFC 5987 |
| GET  | `/api/mudur/students/export` | mudur | — | — | Excel — ✅ RFC 5987 |
| GET  | `/api/mudur/reports/export` | mudur | — | — | Excel — ✅ RFC 5987 |

### 👨‍👩‍👧 Veli (6 endpoint, anonim ama rate limit + access token)

| HTTP | Path | Auth | Zod | Rate Limit | Notlar |
|---|---|---|---|---|---|
| POST | `/api/veli/verify-password` | — | `veliVerifyPasswordBodySchema` | ✅ 10/3dk + 50/60dk | Okul şifresi |
| GET  | `/api/veli/class/[id]` | — | — | ✅ 60/5dk | |
| POST | `/api/veli/order` | — | `veliOrderBodySchema` | ✅ 10/10dk | TC validation, TC+classId duplicate check |
| GET  | `/api/veli/order` | — | — | ✅ 30/5dk | orderNumber/orderId ile sorgu, accessToken döner |
| POST | `/api/veli/payment` | — | `veliPaymentBodySchema` | ✅ 10/10dk | accessToken zorunlu (HMAC) |
| POST | `/api/veli/discount` | — | `veliDiscountBodySchema` | ✅ 20/5dk | İndirim kodu doğrula |
| POST | `/api/veli/cancel-request` | — | `veliCancelRequestBodySchema` | ✅ 10/10dk | accessToken zorunlu |
| GET  | `/api/veli/cancel-request` | — | — | ✅ 60/5dk | |

### 🌐 Public (1 endpoint, auth yok)

| HTTP | Path | Notlar |
|---|---|---|
| GET  | `/api/health` | DB ping + uptime, hassas veri sızdırmıyor |

---

## 🚨 1.1 Gözlemler

| ID | Bulgu | Önem |
|---|---|---|
| OBS-1 | **Admin endpoint'lerinin çoğunda Zod validator YOK** (`schools`, `classes`, `packages`, `orders/[id]` PUT, `delivery-documents`, vb.). Manuel `if (!body.x)` kontrolüne güveniyor — eksik alan/oversized payload riski. | ORTA |
| OBS-2 | **Admin/mudur endpoint'lerinde rate limit yok** (sadece login'lerde). İçerideki bir admin/müdür accidental veya kötü niyetli loop atarsa DB'yi devirebilir. | DÜŞÜK |
| OBS-3 | **Veli/order POST'unda payload size sınırı yok** (Next.js default 1MB). 1MB'lık address gönderilirse DoS. | DÜŞÜK |
| OBS-4 | **`/api/admin/auth/logout` kimlik doğrulama yapmıyor** — bu doğru tasarım (logout her durumda çalışmalı), ama log atmıyor. | BİLGİ |
| OBS-5 | **Admin orders GET pagination var** (✅) ama `/api/admin/schools`, `/api/admin/classes`, `/api/admin/packages` pagination yok — N satır büyürse tek istekte hepsini döndürür. | DÜŞÜK |

---

## 1.2 — Sayfa Rotaları

| Path | Rol | Auth Mekanizması | API'leri |
|---|---|---|---|
| `/` | Public | — | landing |
| `/siparis` | Veli | sessionStorage + verify-password | `/api/veli/verify-password` |
| `/paket/[id]` | Veli | sessionStorage classData | `/api/veli/class/[id]`, `/api/veli/discount`, `/api/veli/order` |
| `/odeme/[orderId]` | Veli | accessToken (URL token) | `/api/veli/payment` |
| `/siparis-onay/[orderNumber]` | Veli | orderNumber (random) | `/api/veli/order` GET |
| `/siparis-takip` | Veli | orderNumber | `/api/veli/order` GET, `/api/veli/cancel-request` |
| `/kvkk` | Public | — | static |
| `/mesafeli-satis` | Public | — | static |
| `/admin` | Public | — | redirect to login |
| `/admin/login` | Public | — | `/api/admin/auth/login` |
| `/admin/(dashboard)` | Admin | `getAdminSession` server-side + middleware | `/api/admin/dashboard` |
| `/admin/(dashboard)/siparisler` | Admin | layout server-side check | `/api/admin/orders`, batch, label |
| `/admin/(dashboard)/okullar` | Admin | layout | `/api/admin/schools` |
| `/admin/(dashboard)/siniflar` | Admin | layout | `/api/admin/classes` |
| `/admin/(dashboard)/paketler` | Admin | layout | `/api/admin/packages` |
| `/admin/(dashboard)/indirimler` | Admin | layout | `/api/admin/discounts` |
| `/admin/(dashboard)/iptal-talepleri` | Admin | layout | `/api/admin/cancel-requests` |
| `/admin/(dashboard)/raporlar` | Admin | layout | `/api/admin/reports` |
| `/admin/(dashboard)/hakedisler` | Admin | layout | `/api/admin/payments` |
| `/admin/(dashboard)/teslim-tutanaklari` | Admin | layout | `/api/admin/delivery-documents` |
| `/mudur` | Public | — | redirect to login |
| `/mudur/login` | Public | — | `/api/mudur/auth/login` |
| `/mudur/(dashboard)` | Müdür | `getMudurSession` server-side + middleware | school-scoped data |
| `/mudur/(dashboard)/siparisler` | Müdür | layout (`session.schoolId` zorunlu) | server-side prisma sadece kendi okul |
| `/mudur/(dashboard)/raporlar` | Müdür | layout | server-side prisma |
| `/mudur/(dashboard)/siniflar` | Müdür | layout | server-side prisma |
| `/mudur/(dashboard)/hakedisler` | Müdür | layout | server-side prisma |

### 🛡 Çift Katmanlı Koruma

- **Middleware** (`src/middleware.ts`): `/admin/*` ve `/mudur/*` için cookie varlığı kontrolü (token verify YAPMIYOR, sadece existence)
- **Layout** (`(dashboard)/layout.tsx`): `getAdminSession()`/`getMudurSession()` ile gerçek doğrulama + DB validity cache
- **API endpoint**: her endpoint kendi başına `getAdminSession()`/`getMudurSession()` çağırıyor

Bu üçlü savunma iyi, ama middleware sadece existence kontrolü yapıyor — gerçek validation API katmanında. Production'da middleware token'ı verify edebilir (Edge Runtime uyumlu jose mevcut).

---

## 1.3 — Veri Modeli

### Modeller (13 adet)

| Model | Birincil Anahtar | Unique | Cascade | Notlar |
|---|---|---|---|---|
| `School` | `id` (cuid) | `password`, `directorEmail` | `Class` (Cascade) | Veli şifresi unique, müdür emaili unique |
| `Class` | `id` | — | — | School silinince cascade |
| `Package` | `id` | — | `PackageItem` (Cascade) | Class.packageId nullable (soft attach) |
| `PackageItem` | `id` | — | — | Package silinince cascade |
| `Order` | `id` | `orderNumber` | `OrderStudent` (Cascade) | classId, packageId zorunlu (no cascade — silmek için manuel) |
| `OrderStudent` | `id` | — | — | Order silinince cascade |
| `CancelRequest` | `id` | `orderId` | — | 1-1 ile Order |
| `SchoolPayment` | `id` | — | — | Hakediş/komisyon |
| `DeliveryDocument` | `id` | `documentNo` | — | Order.deliveryDocumentId nullable |
| `Admin` | `id` | `email` | — | bcrypt password |
| `Discount` | `id` | `code` | — | usedCount atomic increment |
| `RateLimitLog` | `id` | — | — | identifier + window |
| `SystemLog` | `id` | — | — | Audit trail |

### Enum'lar (6 adet)

| Enum | Değerler |
|---|---|
| `DeliveryType` | `CARGO`, `SCHOOL_DELIVERY` |
| `OrderStatus` | `NEW`, `PAYMENT_PENDING`, `PAID`, `CONFIRMED`, `INVOICED`, `SHIPPED`, `DELIVERED`, `COMPLETED`, `CANCELLED`, `REFUNDED` (10 değer — PREPARING kaldırıldı ✅) |
| `PaymentMethod` | `CREDIT_CARD` |
| `CancelRequestStatus` | `PENDING`, `APPROVED`, `REJECTED` |
| `DiscountType` | `PERCENTAGE`, `FIXED` |
| `PaymentStatus` | `PENDING`, `PAID` |

### Index'ler

- `Order.orderNumber` (unique + index)
- `Order.status` ✅
- `Order.createdAt` ✅
- `Order.classId`, `packageId`, `deliveryDocumentId`
- `OrderStudent.orderId`
- `School.password`, `directorEmail`
- `Discount.code`
- `RateLimitLog.identifier`
- `SystemLog.createdAt`, `userId`, `action`

### 🚨 1.3 Gözlemler

| ID | Bulgu | Önem |
|---|---|---|
| OBS-6 | **`Order` → `Class`/`Package` ilişkisinde cascade YOK** — School cascade ediliyor ama paket silmek istenen senaryoda Order önce taşınmalı (silme kontrolü var, iyi). | BİLGİ |
| OBS-7 | **`Order.taxNumber` (TC kimlik) düz metin saklanıyor**. Bu KVKK kapsamında "kişisel veri" — encrypted at rest düşünülmeli. | YÜKSEK (uyumluluk) |
| OBS-8 | **`School.password` (veli giriş şifresi) DÜZ METİN** (`SFR-7R7B-NABV-NLDU` gibi). Veli paneli için geri çevrilebilir/admin görünür olduğu için bilinçli ama, leak senaryosunda tüm okul siparişleri açılır. | YÜKSEK |
| OBS-9 | **`SystemLog` modelinde değişiklik diff'i yok** — kim ne yaptı yazıyor ama before/after değer karşılaştırması zayıf. | DÜŞÜK |

---

## 1.4 — Güvenlik Altyapısı

### `src/middleware.ts` (59 satır)

- `/admin/*` + `/api/admin/*`: cookie `token` var mı? Yoksa redirect/401
- `/mudur/*` + `/api/mudur/*`: cookie `mudur_token` var mı? Yoksa redirect/401
- **DİKKAT**: Token'ı VERIFY ETMİYOR, sadece existence kontrolü. Gerçek doğrulama API katmanında.

### `src/lib/auth.ts`

| Fonksiyon | Ne Yapıyor |
|---|---|
| `getJwtSecret()` | `JWT_SECRET` env'i okur. Production'da boş veya bilinen zayıf değerse THROW. Dev'de `dev-secret-...` fallback |
| `KNOWN_WEAK_SECRETS` | 2 bilinen zayıf değer reddediliyor |
| `hashPassword(p)` | bcrypt 12 round ✅ |
| `verifyPassword` | bcrypt compare |
| `createToken(payload)` | jose SignJWT, exp = 7d default |
| `verifyToken(token)` | jose jwtVerify |
| `getSession()` | cookie'den oku, verify et |
| `getAdminSession()` | session + DB'de admin hala isActive mi? (60s cache) |
| `getMudurSession()` | session + DB'de okul isActive ve email değişmemiş mi? |
| `invalidateSessionCache(key?)` | Logout'ta çağrılır |

### `src/lib/security.ts`

| Fonksiyon | Ne Yapıyor |
|---|---|
| `getClientIp(request)` | `x-real-ip` > `cf-connecting-ip` > `x-forwarded-for[0]` > `req.headers` (Vercel için iyi) |
| `escapeHtml(value)` | HTML injection koruması (email template'leri için) |
| `escapeCsvValue(value)` | Excel formula injection (`=`, `+`, `-`, `@` ile başlarsa `'` prefix) |
| `safeCellValue(value)` | ExcelJS hücre değeri güvenli tip dönüşümü |
| `sanitizeForLog(value, depth)` | Log'lara hassas veri yazılmasın diye |
| `generateOrderAccessToken(orderId)` | **HMAC-SHA256(orderId, JWT_SECRET) → base64url, 16 char** |
| `verifyOrderAccessToken(orderId, token)` | timingSafeEqual ile sabit-süre karşılaştırma ✅ |
| `buildContentDisposition(filename)` | RFC 5987 — ASCII fallback + `filename*=UTF-8''…` ✅ |

### `src/lib/rate-limit.ts`

| Fonksiyon | Ne Yapıyor |
|---|---|
| `checkRateLimit(id, max, windowMin)` | `RateLimitLog` tablosunda son `windowMin` dakikadaki başarısız sayar; max'ı geçtiyse blokla |
| `recordFailedAttempt(id)` | Başarısızlığı kaydet |
| `resetRateLimit(id)` | Başarılı işlemde sayacı sıfırla |
| `cleanupExpiredRateLimits()` | Eski kayıtları sil (cron-style) |
| `maybeTriggerCleanup()` | Her N istekte bir auto-cleanup tetikler |

### `src/lib/validators.ts`

| Schema | Alanlar | Limitler |
|---|---|---|
| `phoneSchema` | TR cep tel | regex `^0?5[0-9]{9}$` |
| `emailSchema` | trim + toLowerCase + max 254 | |
| `discountCodeSchema` | UPPERCASE, 3-40 char, `[A-Z0-9_-]+` | |
| `studentSectionSchema` | max 4 char | |
| `MAX_STUDENTS_PER_ORDER` | **5** | |
| `orderStudentSchema` | firstName/lastName 2-100 + section | |
| `veliOrderBodySchema` | classId, parentName, students[1..5], phone, email, address (5-1000), … | TC: `^\d{10,11}$` (algoritmik kontrolü route içinde) |
| `veliPaymentBodySchema` | accessToken **16 char** zorunlu, kart bilgileri | |
| `loginBodySchema` | email + password (1-200) | |
| `veliCancelRequestBodySchema` | orderId, **accessToken 16 char**, reason 5-1000 | |
| `adminDiscountBodySchema` | refine: validFrom < validUntil; PERCENTAGE 0-100 | |

### Cookie Ayarları

| Cookie | httpOnly | secure | sameSite | maxAge |
|---|---|---|---|---|
| `token` (admin) | ✅ | prod-only | `lax` | 7d |
| `mudur_token` | ✅ | prod-only | `lax` | 7d |

### 🚨 1.4 Gözlemler

| ID | Bulgu | Önem |
|---|---|---|
| OBS-10 | **Cookie `sameSite: 'lax'`** — `strict` olabilir mi? Lax CSRF'in çoğunu engeller ama state-changing GET/HEAD'ler için açık (sistem POST/PUT kullandığı için riskte değil). | BİLGİ |
| OBS-11 | **Middleware token'ı verify etmiyor** — sahte cookie'yle dashboard'a erişilemez (layout doğrular) ama 1 ekstra round trip oluyor. Edge'de jose verify yapılabilir. | DÜŞÜK |
| OBS-12 | **`/api/health` zaman damgası + uptime döndürür**, DB credentials sızmıyor ✅ | BİLGİ |
| OBS-13 | **bcrypt 12 round** ✅ — 2026 standardına uygun |
| OBS-14 | **HMAC access token 16 char** (96 bit) — brute-force güvenli ama IDOR önleme için ek tedbir |
| OBS-15 | **`process.env.NODE_ENV === 'production'` weak secret check var** ama dev'de fallback kullanıyor — production deploy'da .env zorunlu, iyi |

---

## 📊 ÖZET TABLO

| Alan | Sayı | Sağlık |
|---|---:|---|
| API endpoint | 47 | 🟢 İyi yapılandırılmış |
| Sayfa rotası | 25 | 🟢 Rol bazlı isolation var |
| Prisma modeli | 13 | 🟢 İlişki/index iyi |
| Enum | 6 | 🟢 Temiz |
| Zod validator | 11 | 🟡 Admin'de eksik (8+ endpoint) |
| Rate limit'li endpoint | 9 | 🟡 Sadece veli + login |
| Bilinen güvenlik gözlemi | 15 | — |
| KRİTİK uyarı | 0 | — |
| YÜKSEK uyarı | 2 | OBS-7 (TC encryption), OBS-8 (school password plaintext) |
| ORTA uyarı | 1 | OBS-1 (admin Zod eksik) |

---

## 🔜 Sonraki Aşamalar İçin Notlar

- **Aşama 2** test verisi seed'i hazırlanacak (200+ sipariş, edge cases)
- **Aşama 3** odak: 47 endpoint × 3 rol = ~140 test case + 8 status × her transition
- **Aşama 4** odak: OBS-7, OBS-8'i exploit POC ile doğrula; ayrıca Excel formula injection, IDOR (orderNumber), accessToken bypass denemeleri
- **Aşama 5** odak: 25 sayfa × 3 viewport (mobile/tablet/desktop) = 75 ekran
- **Aşama 6** odak: 200 siparişle pagination, N+1, export süresi

---

**Aşama 1 tamamlandı ✅**
