# Aşama 6 — Performans / Yük

**Tarih:** 2026-05-03  
**Test ortamı:** localhost (XAMPP MySQL + Next.js dev mode), 228 sipariş yüklü

## 6.1 — Endpoint Süreleri (228 sipariş yüklü)

| Endpoint | Süre | Boyut | Yorum |
|---|---:|---:|---|
| `GET /api/admin/orders` | **28 ms** | ~30KB | ✅ Çok hızlı, pagination 100/sayfa |
| `GET /api/admin/schools` | **21 ms** | — | ✅ |
| `GET /api/admin/dashboard` | **150 ms** | — | ⚠️ Biraz yavaş — 4 raw query + 4 aggregate, 215 sipariş için kabul edilebilir |
| `GET /api/admin/orders/export` | **93 ms** | 35 KB | ✅ Excel oluşturma çok hızlı |
| `GET /api/admin/students/export` | **89 ms** | 29 KB | ✅ |
| `GET /api/admin/reports/okul-teslim/export` | **90 ms** | 26 KB | ✅ Yeni rapor — performanslı |

## 6.2 — Pagination Durumu

| Endpoint | Pagination | Limit | Risk |
|---|---|---|---|
| `/api/admin/orders` | ✅ var | 100 max | OK |
| `/api/admin/schools` | ❌ **yok** | — | 1000+ okulda yavaşlar |
| `/api/admin/classes` | ❌ **yok** | — | 5000+ sınıfta yavaşlar |
| `/api/admin/packages` | ❌ **yok** | — | 1000+ pakette yavaşlar |
| `/api/admin/cancel-requests` | ❌ **yok** | — | 5000+ talepte yavaşlar |
| `/api/admin/payments` | ❌ **yok** | — | Aynı |
| `/api/admin/delivery-documents` | ❌ **yok** | — | Aynı |
| `/api/admin/logs` | ❌ **yok** | — | **YÜKSEK risk** (system_logs hızlı büyür) |

**PERF-01 (ORTA):** 7 endpoint pagination'sız. Şu anda sayılar küçük olduğu için sorun değil, ama production'da `system_logs` 10K+ olunca dashboard yavaşlar.

## 6.3 — N+1 Query Riski

| Endpoint | Include kullanımı | Durum |
|---|---|---|
| `/api/admin/orders` | `class.school` + `package` + `students` tek query'de | ✅ |
| `/api/admin/orders/export` | Aynı include | ✅ |
| `/api/admin/schools` | `_count: { classes }` | ✅ |
| `/api/admin/classes` | `school + package + _count: { orders }` | ✅ |
| `/api/admin/packages` | `items + _count: { classes }` | ✅ |
| `/api/admin/dashboard` | 4 raw query + Promise.all | ✅ |
| `/api/admin/reports/okul-teslim/export` | `class.school + students` | ✅ |

**N+1 yok ✅** — tüm liste endpoint'leri Prisma `include` ile tek query yapıyor.

## 6.4 — Index Kapsamı

| Tablo | Index'ler | Kapsam |
|---|---|---|
| `orders` | `orderNumber`, `status`, `createdAt`, `classId`, `packageId`, `deliveryDocumentId` | ✅ Yeterli |
| `order_students` | `orderId` | ✅ |
| `schools` | `password`, `directorEmail` | ✅ |
| `classes` | `schoolId`, `packageId` | ✅ |
| `cancel_requests` | `status`, `orderId` (unique) | ✅ |
| `system_logs` | `userId`, `action`, `createdAt` | ✅ |
| `discounts` | `code` | ✅ |
| `rate_limit_logs` | `identifier` | ✅ |

**Index kapsamı mükemmel.** Tüm yaygın WHERE/ORDER BY sütunları indexli.

## 6.5 — DB Connection Pool

Prisma default connection pool: `connection_limit = num_cpus * 2 + 1`.
- Local'de 8 core → 17 connection limit
- Concurrent 50 sipariş test'inde (Aşama 4.8 race condition) sorun yok ✅

## 6.6 — Bulgular

| ID | Bulgu | Önem |
|---|---|---|
| PERF-01 | 7 admin endpoint pagination'sız (özellikle `/api/admin/logs` riskli) | ORTA |
| PERF-02 | Dashboard 150ms — production'da 1000+ siparişle 500ms+'e çıkabilir; cache eklenebilir (Redis veya Next.js `revalidate`) | DÜŞÜK |
| PERF-03 | Excel export 100ms — şimdi iyi, ama 10K+ satırlı raporlarda streaming gerekebilir | KOZMETİK |
| PERF-04 | `Order.students` always include — küçük sipariş sayfalarında ekstra JOIN ama N+1 vs avantajlı | KOZMETİK |

## 🟢 Skor

**Performans: 88/100**
- (+10) Index kapsamı mükemmel
- (+10) N+1 yok
- (+8) Pagination var (admin/orders'ta) ve hızlı
- (-5) 7 endpoint'te pagination eksik
- (-5) Cache stratejisi yok (dashboard bilhassa)
- (-2) DB encryption yok (perf değil ama compliance — Aşama 4'te ele alındı)

---

**Aşama 6 tamamlandı ✅**
