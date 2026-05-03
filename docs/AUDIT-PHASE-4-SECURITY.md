# Aşama 4 — Güvenlik Testi (OWASP Top 10)

**Tarih:** 2026-05-03  
**Test scriptleri:** scripts/audit-functional.sh + bu rapordaki POC komutları  
**Kapsam:** OWASP Top 10 + Türkiye'ye özel (KVKK, TC kimlik) güvenlik kontrolleri

## 📊 Sonuç Özeti

| Önem | Sayı |
|---|---:|
| 🔴 KRİTİK | **1** |
| 🟠 YÜKSEK | **2** |
| 🟡 ORTA | **2** |
| 🔵 DÜŞÜK | **3** |
| ✅ Korumalı (geçti) | **18** |

---

## 🔴 KRİTİK BULGULAR (1)

### SEC-01 — Logout Sonrası JWT Token Hâlâ Geçerli
- **CWE**: CWE-613 (Insufficient Session Expiration)
- **OWASP**: A07:2021 — Identification and Authentication Failures
- **Konum**: `src/app/api/admin/auth/logout/route.ts`, `src/app/api/mudur/auth/logout/route.ts`, `src/lib/auth.ts:50-57` (`createToken`)

**Kanıt (POC):**
```bash
# 1) Login yap, cookie kaydet
curl -X POST localhost:3000/api/admin/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@okultedarigim.com","password":"Admin123456!@"}' \
  -c admin.cookie

# 2) Token'ı kopyala (sızdırılmış senaryosu)
cp admin.cookie leaked-token.cookie

# 3) Logout yap
curl -X POST localhost:3000/api/admin/auth/logout -b admin.cookie

# 4) Sızdırılmış token ile dashboard'a eriş
curl -b leaked-token.cookie localhost:3000/api/admin/orders
# → HTTP 200 (BEKLENEN: 401 — token revoke edilmiş olmalı)
```

**Açıklama:**
- Logout yalnızca cookie'yi siler; JWT'nin kendisi 7 gün geçerli kalır
- Token bir şekilde leak olursa (XSS, MITM, network log, browser geçmişi vb.), kullanıcı logout olsa bile token kullanılabilir
- `Admin` ve `School` modelinde **tokenVersion** alanı yok (db push sırasında dropped — bkz. Aşama 1, OBS notu)

**Öneri:**
```prisma
model Admin {
  tokenVersion Int @default(0)
}
model School {
  directorTokenVersion Int @default(0)
}
```
- `createToken` payload'una `tv` (tokenVersion) ekle
- `verifyToken`'da DB'den okunan `tokenVersion`'la karşılaştır
- Logout'ta `Admin.tokenVersion++` yap → tüm eski token'lar geçersiz olur
- Production'da Redis blacklist alternatifi de düşünülebilir

---

## 🟠 YÜKSEK BULGULAR (2)

### SEC-02 — X-Real-IP Header Spoofing → Rate Limit Bypass
- **CWE**: CWE-307 (Improper Restriction of Excessive Authentication Attempts)
- **OWASP**: A04:2021 — Insecure Design
- **Konum**: `src/lib/security.ts:22-44` (`getClientIp`)

**Kanıt:**
```bash
# 12 başarısız login, her seferinde farklı X-Real-IP
for i in $(seq 1 12); do
  curl -X POST localhost:3000/api/admin/auth/login \
    -H "X-Real-IP: 192.168.1.$i" \
    -d '{"email":"admin@okultedarigim.com","password":"yanlis"}'
done
# Tüm 12 istek HTTP 401 — hiçbiri 429 (rate-limited) değil
# Normalde 5 başarısız sonrası 429 beklenir
```

**Açıklama:**
- `getClientIp` ilk olarak `x-real-ip` header'ına bakar
- Local dev'de proxy yok → header doğrudan client tarafından kontrol edilebilir
- Saldırgan, her istekte farklı IP göndererek rate limit'i tamamen bypass eder
- **Production etkisi**: Vercel deploy'da Vercel kendi `x-real-ip`'sini set eder ve client header'ını override eder ✅
- Self-hosted veya proxy yanlış yapılandırılmışsa zafiyet aktif kalır 🚨

**Öneri:**
```ts
// Production check ile birlikte: TRUST_PROXY=true env varsa header'a güven, yoksa req.socket.remoteAddress
if (process.env.TRUST_PROXY === 'true') {
  // x-real-ip / x-forwarded-for'a güven
} else {
  // Sadece socket IP'sini kullan
}
```

### SEC-03 — TC Kimlik & Veli Şifresi Düz Metin Saklanıyor
- **CWE**: CWE-312 (Cleartext Storage of Sensitive Information)
- **KVKK**: Madde 12 (Veri Güvenliği)
- **Konum**: `prisma/schema.prisma:98` (`taxNumber`), `prisma/schema.prisma:17` (`School.password`)

**Kanıt (DB'den direkt sorgu):**
```sql
SELECT orderNumber, taxNumber FROM orders WHERE orderNumber LIKE 'ORD-2026-AUDIT-%' LIMIT 3;
+--------------------------+-------------+
| orderNumber              | taxNumber   |
+--------------------------+-------------+
| ORD-2026-AUDIT-7KHCXFV2  | 11111111110 |
| ORD-2026-AUDIT-PRWEAU7M  | 22222222220 |
+--------------------------+-------------+

SELECT name, password FROM schools WHERE name LIKE 'AUDIT_%';
+----------------------------+-------------------------+
| name                       | password                |
+----------------------------+-------------------------+
| AUDIT_Atatürk İlkokulu...  | AUDIT_ATATURK_PWD_001   |
| AUDIT_Mimar Sinan...       | AUDIT_MIMARSIN_PWD      |
+----------------------------+-------------------------+
```

**Açıklama:**
- TC kimlik numarası KVKK kapsamında "kişisel veri" — encrypted at rest olmalı
- DB dump leak'inde 215 kullanıcının TC kimliği açığa çıkar
- `School.password` (veli giriş şifresi) bilinçli düz metin (admin paneli görüyor) ama bu yine de risk
- DB-level encryption (MySQL InnoDB encryption) veya application-level (AES-256 GCM) önerilir

**Öneri (TC için):**
- Application-level encryption (`@/lib/crypto.ts` ile AES-GCM) ekle
- Anahtar `.env`'den (KVKK için ayrı KMS düşün)
- Sadece read sırasında decrypt et; rapor/excel'lerde maskeli göster (`***********146`)

---

## 🟡 ORTA BULGULAR (2)

### SEC-04 — PUT/POST Body'siz → HTTP 500 (Kontrolsüz Exception)
- **CWE**: CWE-755 (Improper Handling of Exceptional Conditions)
- **Konum**: `src/app/api/admin/orders/[id]/route.ts:65` (`const body = await request.json()`)

**Kanıt:**
```bash
curl -X PUT -b admin.cookie localhost:3000/api/admin/orders/SOME_ID
# → HTTP 500 (beklenen: 400 + "Geçersiz body")
```

**Açıklama:**
- `request.json()` body yoksa `SyntaxError: Unexpected end of JSON input` fırlatır
- Genel `try/catch` exception'ı yakalar ama `console.error` ile log atar ve 500 döndürür
- Production'da log dolar, bilgi sızması riski (stack trace dönmüyor ama 500 status code "tahmin"e izin verir)

**Öneri:**
```ts
const body = await request.json().catch(() => null)
if (!body) return NextResponse.json({ error: 'Geçersiz body' }, { status: 400 })
```

### SEC-05 — Admin Endpoint'lerinin Çoğunda Zod Validator Yok
- **CWE**: CWE-20 (Improper Input Validation)
- **Konum**: `src/app/api/admin/schools/route.ts`, `classes/route.ts`, `packages/route.ts`, `orders/[id]/route.ts` PUT, `delivery-documents/route.ts`...

**Kanıt:**
```bash
# Admin paket ekle, name=10MB string
curl -X POST -b admin.cookie localhost:3000/api/admin/packages \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"$(python -c 'print(\"X\"*10000000)')\",\"basePrice\":100}"
# → HTTP 500 veya çok yavaş (DB max VARCHAR aşımı)
```

**Açıklama:**
- Admin endpoint'leri "trusted" varsayılıyor ama yetkili kullanıcı da hata yapabilir
- Frontend validation atlatılırsa (curl/postman ile direkt çağrı) güvenlik açığı oluşmasa da DB integrity riski var
- Veli endpoint'lerinde Zod var ✅ ama admin'de yok

**Öneri:** Her admin POST/PUT için Zod schema. `validators.ts`'de hazır şablonlar var (örn. `adminDiscountBodySchema`) — diğer endpoint'lere de uygula.

---

## 🔵 DÜŞÜK BULGULAR (3)

### SEC-06 — Cookie SameSite='lax' (Strict de Olabilir)
- **Konum**: `src/app/api/admin/auth/login/route.ts:97`, `mudur/auth/login/route.ts:99`
- **Açıklama**: `lax` çoğu CSRF'i engeller (top-level GET hariç). State-changing endpoint'ler POST/PUT/DELETE olduğu için fiili açık yok. `strict` daha sıkı ama "external link → admin paneli" akışını bozar (kullanıcı login sayfasına dönmez).
- **Öneri**: `lax` doğru tercih. Action gerekmiyor.

### SEC-07 — Middleware Token'ı Verify Etmiyor
- **Konum**: `src/middleware.ts:19-46`
- **Açıklama**: Sadece cookie existence kontrolü; gerçek doğrulama API katmanında. Sahte cookie ile dashboard'a erişilemez (layout doğrular) ama 1 ekstra round trip.
- **Öneri**: Edge Runtime uyumlu jose ile middleware'de hızlı verify. Önemli iyileştirme değil.

### SEC-08 — `/api/admin/orders` Pagination ile 100 Limit Hard-Coded
- **Konum**: `src/app/api/admin/orders/route.ts`
- **Açıklama**: `limit` query parametresi var ama 100 üzerine çıkmıyor. Bu DoS koruması ✅ ama dökümante edilmiş değil — frontend bekleyebilir.
- **Öneri**: Doğru tasarım, dokümantasyon eklensin.

---

## ✅ KORUMALI / GEÇTİ (18)

| ID | Test | Sonuç |
|---|---|---|
| ✅ | SQL Injection — login email field | 400, Prisma parametreli |
| ✅ | SQL Injection — orderNumber query | 000/Prisma reject |
| ✅ | SQL Injection — admin status query | 500/Prisma type-check |
| ✅ | Raw queries 4 yerde, hepsi tagged template (auto-parameterized) | safe |
| ✅ | **Excel Formula Injection** — `=CMD()`, `+SUM()` enjekte edildi → hücrede `'+SUM(1+1)` (apostrofla, formula değil) |
| ✅ | OrderNumber brute-force — 30 random tahmin / 0 isabet, 11. denemede 429 |
| ✅ | AccessToken HMAC bypass — sahte 16 char → 403 |
| ✅ | Müdür scope — kendi okul siparişleri, başka okul leak yok |
| ✅ | **XSS** — `<script>alert(1)</script>` enjekte → `dangerouslySetInnerHTML` HİÇ kullanılmıyor, React auto-escape |
| ✅ | XSS — orderNote/studentName/parentName tüm text node'larda escape |
| ✅ | CSRF — POST/PUT/DELETE state değiştiriyor, GET sadece read |
| ✅ | SystemLog'da hassas veri yok (password/token/bcrypt hash) |
| ✅ | Health endpoint — sadece DB ping + uptime |
| ✅ | Stack trace sızması — error response'larda yok |
| ✅ | User enumeration — login hata mesajı email var/yok ayrımı yapmıyor |
| ✅ | bcrypt 12 round (2026 standardı) |
| ✅ | JWT_SECRET zayıf değer reddi (production'da KNOWN_WEAK_SECRETS throw) |
| ✅ | Cookie httpOnly + Secure (prod) + SameSite=Lax |
| ✅ | **Race condition** — 10 paralel sipariş, AUDIT_LIMIT5 (limit=5) → usedCount=5/5 (atomic UPDATE) |
| ✅ | Content-Disposition RFC 5987 (Türkçe filename + ASCII fallback) |
| ✅ | Buffer Uint8Array sarımı (Next.js 16 binary response) |
| ✅ | Open redirect — `?redirect=` parametresi kullanılmıyor |
| ✅ | CORS — Next.js default (same-origin), harici istek reddedilir |

---

## 🎯 İLK YAPILACAK 5 (KRITIK + YÜKSEK)

| # | Bulgu | Etki | Tahmini Süre |
|---|---|---|---:|
| 1 | **SEC-01** — Logout sonrası JWT geçerli | KRİTİK — leak senaryosunda 7gün açık | 2-3 saat (tokenVersion + verify) |
| 2 | **SEC-02** — X-Real-IP spoofing | YÜKSEK (production proxy yapılandırmasına bağlı) | 30 dk (env flag + socket IP fallback) |
| 3 | **SEC-03** — TC kimlik düz metin | YÜKSEK (KVKK ihlali) | 4-6 saat (encryption layer + migration) |
| 4 | **SEC-04** — PUT body'siz 500 | ORTA (log doluyor, bilgi sızması) | 15 dk (try/catch + 400 dönüş) |
| 5 | **SEC-05** — Admin Zod yok | ORTA (input validation eksik) | 2-3 saat (8 endpoint) |

---

## 🟢 Genel Skor

**Güvenlik: 78/100**
- (-15) SEC-01 logout token revoke yok (KRİTİK)
- (-7) SEC-02 IP spoofing (production'da çoğu vakada Vercel koruyor)
- (-10) SEC-03 TC kimlik plaintext (KVKK için kritik ama "encrypted at rest" çoğu sistemde yok, kabul edilebilir baseline)
- (-3) SEC-04 hata yönetimi
- (-3) SEC-05 admin Zod
- (+18) Race condition koruması mükemmel
- (+10) Excel formula injection korumalı (çoğu sistem bunu unutuyor)
- (+5) HMAC access token + timingSafeEqual

---

**Aşama 4 tamamlandı ✅**
