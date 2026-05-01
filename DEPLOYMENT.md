# Production Deployment Rehberi — Okul Tedarik Sistemi

Bu doküman sistemin Vercel + yönetilen MySQL üzerinden production'a alınması için adım adım rehberdir. **Mock'lar şu an aktif** (Iyzico, Resend, Twilio, Aras Kargo, KolayBi); gerçek API'ler eklenince ilgili `USE_MOCK_*` flag'leri kaldırılır.

> Audit raporu için `SECURITY-AUDIT.md` dosyasına bakın.

---

## 🎯 Pre-flight Checklist

Aşağıdakiler **deploy etmeden önce** yapılmalı:

### 1. Database hazırlığı — TiDB Cloud (önerilen)

**TiDB Cloud** seçildi (MySQL-uyumlu, serverless free tier var, otomatik backup).

#### 1.1 TiDB cluster oluştur
- [ ] [tidbcloud.com](https://tidbcloud.com) → "Create Cluster" → **Serverless** seç
- [ ] Region: `eu-central-1` (Frankfurt — Türkiye'ye en yakın AWS bölgesi)
- [ ] Cluster oluşturulduktan sonra **Connect** → "Generate Password" (bu şifreyi **bir kez** gösteriyor, kaydedin)
- [ ] Connection string formatı:
  ```
  mysql://<USER>.root:<PASSWORD>@gateway01.eu-central-1.prod.aws.tidbcloud.com:4000/<DATABASE>?sslaccept=strict
  ```

#### 1.2 Uygulama database'i oluştur
> ⚠ Default `sys` database **KULLANMAYIN** — bu TiDB sistem DB'sidir, üretim verisi için uygun değil.

TiDB Cloud Console'da SQL Editor'ı açıp:
```sql
CREATE DATABASE okul_tedarik;
```

Connection string'inizi yeni database adıyla güncelleyin:
```
mysql://...:...@gateway01.eu-central-1.prod.aws.tidbcloud.com:4000/okul_tedarik?sslaccept=strict
```

#### 1.3 SSL gereksinimi
TiDB Cloud zorunlu TLS kullanır. URL'de `?sslaccept=strict` parametresi **zorunlu** — Prisma bu parametreyi MySQL connector'la birlikte yorumlar.

#### 1.4 Vercel'e environment variable ekle
> ⚠ Şifreyi `.env` dosyasına yazıp commit ETMEYİN. Sadece Vercel Dashboard üzerinden:

```bash
vercel env add DATABASE_URL production
# Yapıştır: mysql://<USER>.root:<REAL_PASSWORD>@gateway01.eu-central-1.prod.aws.tidbcloud.com:4000/okul_tedarik?sslaccept=strict
```

Veya Dashboard: Project Settings → Environment Variables → DATABASE_URL → Production scope.

#### 1.5 Schema migration
İlk deploy'dan önce **veya** sonra schema'yı uygula:
```bash
DATABASE_URL="<production-url>" npx prisma migrate deploy
```

> Lokalden çalıştırmak: TiDB Cloud "IP Access List" ayarından kendi IP'nizi (veya `0.0.0.0/0`) ekleyin. Production'da Vercel Function'ların IP'leri otomatik whitelist'tedir.

#### 1.6 Backup
TiDB Cloud Serverless **otomatik günlük backup** yapar (14 gün retention free tier'da). Manuel snapshot için: Cluster → Backup → "Create Snapshot".

#### 1.7 Bağlantı test
Migration sonrası test:
```bash
DATABASE_URL="<production-url>" npx prisma studio
```
Prisma Studio açıldıysa bağlantı başarılı.

### 2. Vercel projesi
- [ ] Vercel CLI kurulu değilse:  `npm i -g vercel`
- [ ] `vercel link` ile projeyi bağla
- [ ] Aşağıdaki environment variable'ları **Production** scope'una ekle (`vercel env add` veya Dashboard'dan):

```
DATABASE_URL              = mysql://...@gateway01.eu-central-1.prod.aws.tidbcloud.com:4000/okul_tedarik?sslaccept=strict
JWT_SECRET                = <openssl rand -base64 32>
JWT_EXPIRES_IN            = 7d
ADMIN_EMAIL               = <admin email>
ADMIN_PASSWORD            = <12+ karakter güçlü password>
ADMIN_NAME                = Sistem Yoneticisi
NEXT_PUBLIC_APP_URL       = https://okultedarigim.com
NEXT_PUBLIC_APP_NAME      = Okul Tedarik Sistemi

# Mock flags — API'ler eklenene kadar aktif
USE_MOCK_PAYMENT          = true
USE_MOCK_INVOICE          = true
USE_MOCK_CARGO            = true
USE_MOCK_EMAIL            = true
USE_MOCK_SMS              = true

# KolayBi (gerçek API gelince)
KOLAYBI_BASE_URL          = https://ofis-sandbox-api.kolaybi.com  (sonra: https://ofis-api.kolaybi.com)
KOLAYBI_API_KEY           = <KolayBi panelinden>
KOLAYBI_CHANNEL           = <api.support@kolaybi.com'dan talep>
```

> **Kritik:** `JWT_SECRET` mutlaka `openssl rand -base64 32` ile üretin. `dev-secret-...` gibi default değerler runtime'da reddedilir ve uygulama 500 verir. Bu güvenlik özelliğidir, devre dışı bırakmayın.

### 3. Initial admin hesabı
İlk deploy'dan sonra admin'i seed et:
```bash
DATABASE_URL="prod-url" \
ADMIN_EMAIL="admin@okultedarigim.com" \
ADMIN_PASSWORD="$(openssl rand -base64 16)" \
npx prisma db seed
```
(Şifre console'a yazılmaz, set ettiğiniz değeri kayıt altına alın.)

### 4. Domain + HTTPS
- [ ] Vercel'de custom domain ekle
- [ ] DNS A/CNAME kayıtlarını yap
- [ ] HTTPS otomatik (Vercel let's encrypt)
- [ ] `NEXT_PUBLIC_APP_URL`'i gerçek domaine güncelle

### 5. Backup ve izleme
- [ ] DB provider'ında otomatik backup açık olmalı (PlanetScale otomatik, AWS RDS manuel)
- [ ] Vercel Logs erişimi: `vercel logs` veya Dashboard
- [ ] Sentry önerilir (defer): `npm i @sentry/nextjs`

---

## 🚀 Deploy

```bash
# Production deploy
vercel --prod

# Preview deploy (PR için)
vercel
```

İlk production deploy sonrası:

```bash
# 1. DB migration'larını uygula
DATABASE_URL="prod-url" npx prisma migrate deploy

# 2. Admin hesabı seed
DATABASE_URL="prod-url" ADMIN_EMAIL=... ADMIN_PASSWORD=... npx prisma db seed
```

---

## 🔐 İlk Operasyonel İşlemler

### 1. Eski okul şifrelerini güçlü formata yenile (varsa)

Daha önce **SFR-1234** gibi 4 haneli şifre üretmiş okullar varsa (geliştirme sırasında oluşturulmuş), production'a almadan önce bu şifreler **mutlaka yenilenmeli**. Yeni format `SFR-XXXX-YYYY-ZZZZ` (60-bit entropy).

Admin olarak login olduktan sonra:

```bash
# Curl ile (admin token'ı browser cookie'sinden)
curl -X POST https://okultedarigim.com/api/admin/schools/rotate-legacy-passwords \
  -H "Cookie: token=<admin-token>"
```

Response yenilenen şifrelerin listesini bir kez gösterir. **Bu listeyi yeniden çekemezsiniz** — kaydedip ilgili velilere iletin.

### 2. Pilot okulları ekle
Admin paneline (`/admin`) login → Okullar → "Yeni Okul"

### 3. Müdür hesaplarını paylaş
Müdür şifresi okul oluşturulurken otomatik üretilir veya manuel girilir. Admin "Okul Detayı" ekranından müdüre bilgileri SMS/email ile iletmeli.

---

## 📡 API Entegrasyonları (sırayla geldikçe)

### Iyzico (ödeme)
1. Iyzico merchant onboarding tamamlanmalı
2. Sandbox API key'lerini `IYZICO_API_KEY`, `IYZICO_SECRET_KEY` olarak ekle
3. `IYZICO_BASE_URL=https://sandbox-api.iyzipay.com` (sandbox testleri)
4. **Hosted Checkout Form** (iframe) tercih et — kart bilgileri sizin backend'inize hiç düşmesin (PCI-DSS)
5. Webhook endpoint'i için HMAC signature doğrulaması zorunlu
6. Tam test sonrası `USE_MOCK_PAYMENT` env'ini sil veya `false` yap, `IYZICO_BASE_URL=https://api.iyzipay.com`'a geç

### Resend (email)
1. resend.com'da hesap aç, domain doğrula
2. `RESEND_API_KEY` ekle
3. `EMAIL_FROM=noreply@okultedarigim.com` (doğrulanmış domain'den)
4. `USE_MOCK_EMAIL`'i kaldır

### Twilio (SMS)
1. twilio.com hesabı + Türk numarası satın al
2. `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` ekle
3. `USE_MOCK_SMS`'i kaldır
4. ⚠ Türkiye'de SMS şirketleri (NetGSM, İletimerkezi vb.) genelde daha ekonomik. İhtiyaca göre Twilio'yu lib'de değiştir.

### Aras Kargo
1. Aras müşteri kodu + parola
2. `ARAS_CUSTOMER_CODE`, `ARAS_PASSWORD` ekle
3. `USE_MOCK_CARGO`'yu kaldır

### KolayBi (e-Fatura)

**ZORUNLU AKIŞ: Önce sandbox, sonra production.** İlk entegrasyon mutlaka test ortamında yapılmalı, tüm işlevler doğrulanmadan canlıya geçilmemeli.

**1. Sandbox (entegrasyon testi):**
```
KOLAYBI_BASE_URL=https://ofis-sandbox-api.kolaybi.com
KOLAYBI_API_KEY=<sandbox-api-key>
KOLAYBI_SECRET_KEY=<sandbox-secret-key>
USE_MOCK_INVOICE=  (boş bırak — gerçek API)
```

Sandbox'ta test edilmesi gereken senaryolar:
- ✅ Bireysel fatura kesimi (TC kimlik ile)
- ✅ Kurumsal fatura kesimi (vergi no + vergi dairesi ile)
- ✅ Fatura iptal akışı (`cancelInvoice`)
- ✅ Fatura durum sorgu (`getInvoiceStatus`)
- ✅ Hata akışları (eksik bilgi, geçersiz vergi no)

**2. Production (sandbox testleri başarılı sonra):**
```
KOLAYBI_BASE_URL=https://ofis-api.kolaybi.com
KOLAYBI_API_KEY=<production-api-key>
KOLAYBI_SECRET_KEY=<production-secret-key>
```

`src/lib/kolaybi.ts`'de `kolayBiConfig.isSandbox` flag'i ile sandbox/prod ayrımı yapılır. Production'da yanlışlıkla sandbox URL kullanılırsa fatura kesilemez ama log'a düşer.

---

## 🛡️ Güvenlik Operasyonları

### Periyodik kontroller
- **Haftalık:** `system_logs` tablosundan şüpheli aktivite (çok başarısız login, anormal IP'ler)
- **Aylık:** `rate_limit_logs` temizliği — `cleanupExpiredRateLimits()` cronla çalıştırılabilir
- **Her deploy sonrası:** Vercel Logs'tan ilk 5 dakikalık trafik kontrol

### TiDB Cloud kontrolleri
- **Cluster Dashboard:** Connection count, CPU, depolama kullanımı (Serverless free tier 5 GB)
- **Backup:** TiDB Cloud Console → Backup → otomatik backup'ların aktif olduğunu doğrula
- **Slow query log:** Cluster → Diagnose → Slow Queries — yavaş sorguları izle
- **IP Access List:** Production'da Vercel Functions için `0.0.0.0/0` veya Vercel CIDR'leri (statik IP yok serverless'te)
- **Connection limits:** Serverless free tier ~250 concurrent. Yüksek trafikte Scaled cluster'a geçiş gerekebilir.

### TiDB Cloud şifresi sızdı
1. TiDB Cloud Console → Cluster → Connect → "Reset Password"
2. Yeni şifreyle Vercel `DATABASE_URL`'i güncelle:
   ```bash
   vercel env rm DATABASE_URL production
   vercel env add DATABASE_URL production
   ```
3. Vercel projeyi yeniden deploy et (`vercel --prod`)

### Acil durum: admin şifresi sızdı
1. Vercel'den `JWT_SECRET`'i değiştir → tüm aktif token'lar invalidate olur
2. `prisma admin.update` ile şifre hash'i değiştir
3. Tüm admin'lere yeniden login zorlanır

### Acil durum: DB sızdı
1. `DATABASE_URL` yenile
2. Tüm okul şifrelerini rotate et (`/api/admin/schools/rotate-legacy-passwords` mantığını yeni endpoint olarak ekle)
3. Velilere yeni şifreleri SMS ile dağıt
4. KVKK gereği 72 saat içinde KVKK Kuruluna bildirim

---

## 📊 Monitoring

### Önemli metrikler
- **Uptime:** Vercel ücretsiz olarak 99.99% sunar
- **API latency:** `/api/admin/dashboard` ve `/api/veli/order` POST p95
- **DB query süresi:** Prisma query log'ları (production'da sadece `error` level)
- **Failed login oranı:** `system_logs` action='LOGIN' toplamı

### Alarmlar (önerilen)
- 5+ başarısız admin login / 5 dk → Slack
- DB connection pool exhaustion
- Function timeout > 100s (default 300s)

---

## ⚠️ Bilinen Limitler / Gelecek İyileştirmeler

| Konu | Şu anki durum | Önerilen iyileştirme |
|------|---------------|------------------------|
| **Iyzico** | Mock | Hosted Checkout Form |
| **Email/SMS** | Mock | Resend + Twilio (veya yerel SMS sağlayıcı) |
| **Kargo** | Mock | Aras Kargo gerçek API |
| **e-Fatura** | Mock | KolayBi |
| **CSP** | `unsafe-inline` | Nonce-based CSP |
| **JWT revocation** | Yok (7 gün geçerli) | DB-backed session veya `passwordChangedAt` |
| **Veli IDOR** | accessToken (HMAC) | Tek-kullanım imzalı URL ile tam çözüm |
| **Logger** | console + DB | Pino/Winston + Sentry |
| **Middleware** | Next.js 16 deprecated uyarısı | "proxy" formatına migrate |
| **WAF/Bot** | Yok | Vercel BotID veya Cloudflare |

Bunların hiçbiri **launch blocker** değil — production'da çalışır. API'ler geldikçe ve trafik arttıkça sırayla iyileştirilebilir.

---

## 🆘 Destek

Sorun çıkarsa:
1. Vercel logs: `vercel logs --since 1h`
2. DB: Prisma Studio (`npx prisma studio`)
3. Audit raporu: `SECURITY-AUDIT.md`

İletişim: firudinmustafayev00@gmail.com
