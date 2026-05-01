# Bulgular Raporu

> Tarih: 2026-04-08
> Inceleyen: 3 paralel kesif agenti + manuel dogrulama

Bu rapor sistem incelemesi sonucu tespit edilen tum bulgulari icerir. Her bulgu bir kategoriye dusurulur:
- **HATA** → duzeltilmeli (`02-FIX-LOG.md`'de takip)
- **TASARIM** → sistem akisi, dokunulmayacak (gerekce belirtilmis)
- **TODO** → karar gerekli, ileride

---

## KRITIK BULGULAR

### K1. mockPayment backend bypass
**Dosya:** `src/app/api/veli/payment/route.ts:11,46-48`
**Aciklama:** Endpoint body'sinde `mockPayment: true` gelirse hicbir kart bilgisi sorulmuyor, otomatik PAID. Frontend bunu gondermiyor ama backend kabul ediyor → herkes curl ile odeme atlatabilir.
**Kategori:** HATA → FIX-1
**Etki:** Para tahsil etmeden PAID (kritik finansal)

### K2. Sequential orderNumber + auth'siz veli/order GET = IDOR
**Dosya:** `src/lib/order-number.ts`, `src/app/api/veli/order/route.ts:275-360`
**Aciklama:** orderNumber `ORD-YYYY-00001` formatinda tahmin edilebilir; GET endpoint'i sadece orderNumber sorar, kisisel veriler (parent, student, phone, totalAmount, kargo no) doner.
**Kategori:** HATA → FIX-2
**Etki:** KVKK ihlali, toplu PII sizmasi

### K3. Veli payment endpoint auth yok
**Dosya:** `src/app/api/veli/payment/route.ts`
**Aciklama:** `orderId` bilen herkes baska bir siparisin odemesini yapabilir.
**Kategori:** HATA → FIX-2 ile birlikte cozulecek (orderNumber + phone)

### K4. classes/[id] DELETE cascade ile order/cancelRequest siliyor
**Dosya:** `src/app/api/admin/classes/[id]/route.ts:100-154`
**Aciklama:** Aktif siparis kontrolu yok. Sinif silinince butun siparisleri ve iptal talepleri SILINIYOR. schools/packages route'larinda kontrol var, classes'de yok.
**Kategori:** HATA → FIX-3
**Etki:** Buyuk veri kaybi riski

### K5. seed.ts admin password console.log + zayif default
**Dosya:** `prisma/seed.ts:17,47`
**Aciklama:** `ADMIN_PASSWORD` env yoksa default `admin123`; ayrica console'a yaziyor (CI/CD log toplayicilarinda kaliyor).
**Kategori:** HATA → FIX-4

### K6. orderNumber race condition
**Dosya:** `src/lib/order-number.ts:17-46`
**Aciklama:** `findFirst` + arta arta create transaction disinda. Eszamanli iki siparis denemesi UNIQUE patlatir.
**Kategori:** HATA → FIX-5

### K7. Status transition validation admin PUT'ta yok
**Dosya:** `src/app/api/admin/orders/[id]/route.ts`
**Aciklama:** `VALID_STATUS_TRANSITIONS` constants'ta tanimli ama PUT endpoint'i kullanmiyor. Admin (veya saldirgan admin token'i ele gecirirse) `COMPLETED → NEW` gibi geriye gidisleri yapabilir.
**Kategori:** HATA → FIX-6

### K8. REFUNDED status'una hicbir endpoint gecmiyor
**Dosya:** Schema'da var, `constants.ts`'de transition var (`CANCELLED → REFUNDED`), ama hicbir route bunu set etmiyor.
**Kategori:** TODO → manuel iade workflow gerekiyor (admin paneline buton + iyzico refund endpoint), bu surumde kapsam disi. `03-NEXT-STEPS.md`'ye yazildi.

---

## ORTA ONEMLI BULGULAR

### O1. Rate-limit sadece verify-password'de
**Dosyalar:** `admin/auth/login`, `mudur/auth/login`, `veli/order` POST, `veli/payment` POST, `veli/discount` POST
**Kategori:** HATA → FIX-12, FIX-13

### O2. Discount frontend/backend hesaplamasi
**Dosyalar:** `src/app/paket/[id]/page.tsx:229,260-266`, `src/app/api/veli/order/route.ts:117-153`
**Aciklama:** Frontend `/api/veli/discount` ile dogrulayip kendi hesabini ekranda gosteriyor, backend `POST /api/veli/order` icinde tekrar hesapliyor (authoritative). Backend dogru oldugu icin **tutarsiz risk yok**.
**Kategori:** TASARIM → dokunulmayacak (sadece UX iyilestirmesi yapilabilir, gerekirse next-steps'de)

### O3. CASH_ON_DELIVERY → NEW status
**Dosya:** `src/app/api/veli/order/route.ts:180`
**Aciklama:** Kapida odeme siparisi `NEW`, admin elle CONFIRMED yapacak.
**Kategori:** TASARIM → mevcut akis bu sekilde dusunulmus

### O4. deliveries/batch DELIVERED kosulu PAID kabul etmiyor
**Dosya:** `src/app/api/admin/deliveries/batch/route.ts:58`
**Aciklama:** SCHOOL_DELIVERY icin `[CONFIRMED, INVOICED, PREPARING]`. PAID akistan cikartilmis, normal akista PAID → CONFIRMED zorunlu adim. Bu kasıtlı.
**Kategori:** TASARIM → dokunulmayacak

### O5. cancel-request REJECTED bypass
**Dosya:** `src/app/api/veli/cancel-request/route.ts:43-46`
**Aciklama:** REJECTED talep silinip yenisi olusturulabilir → sonsuz dongu mumkun.
**Kategori:** HATA → FIX-7

### O6. Telefon format `-` veya bosluk reddediliyor
**Dosya:** `src/app/paket/[id]/page.tsx:276`
**Aciklama:** `/^05\d{9}$/` regex'i once normalize edilmemis girisi reddeder.
**Kategori:** HATA → FIX-8

### O7. PII loglamasi
**Dosyalar:** `src/lib/logger.ts:67`, `iyzico.ts`, `email.ts`, `sms.ts`
**Aciklama:** Email, telefon, ad-soyad systemLog detail JSON'a yaziliyor.
**Kategori:** TODO → KVKK uyumu icin masking helper, next-steps'de

### O8. Mock flag default ON
**Dosyalar:** `iyzico.ts:40`, `email.ts:20`, `sms.ts:12`, `kolaybi.ts:62`, `aras-kargo.ts:65`
**Aciklama:** `process.env.USE_MOCK_X !== 'false'` → env yoksa MOCK acik. Prod env'i eksikse para tahsil edilmez.
**Kategori:** HATA → FIX-9

### O9. .env repo'da olabilir
**Aciklama:** Eger `.env` git takipliyse anahtarlar acik. .gitignore kontrolu gerek.
**Kategori:** TODO → manuel kontrol gerekli, next-steps'de

### O10. students/export route dosyasi yok
**Aciklama:** `src/app/api/admin/students/export/route.ts` glob'da bulunamadi.
**Kategori:** HATA → FIX-15 (kontrol et, gerekirse olustur veya referansi temizle)

---

## KUCUK / TUTARLILIK SORUNLARI

### S1. `basePrice` vs `price` (packages)
**Dosyalar:** `api/admin/packages/route.ts:22-36, 59`
**Aciklama:** Mapping katmani var, calisiyor.
**Kategori:** TASARIM → dokunulmayacak (uretken refactor degil)

### S2. `unitPrice` vs `price` (PackageItem)
**Aciklama:** S1 ile ayni durum.
**Kategori:** TASARIM → dokunulmayacak

### S3. shipment vs invoice farkli status seti
**Dosyalar:** `orders/[id]/shipment/route.ts:44`, `orders/[id]/invoice/route.ts:35`
**Aciklama:** Iki endpoint farkli status'leri kabul ediyor. Dort durum (PAID, CONFIRMED, INVOICED, PREPARING) shipment'ta, sadece (PAID, CONFIRMED) invoice'ta. Kasitli olabilir cunku INVOICED siparisi tekrar fatura kesemezsin ama kargolayabilirsin.
**Kategori:** TASARIM → dokunulmayacak

### S4. TC kimlik checksum yok
**Dosyalar:** `paket/[id]/page.tsx:301`, `api/veli/order/route.ts:42`
**Kategori:** HATA → FIX-10

### S5. studentSection uzunluk validasyonu
**Aciklama:** DB `VarChar(4)`, frontend kontrol yok → 5+ karakter girisinde 500 hatasi.
**Kategori:** HATA → FIX-11

### S6. SFR-XXXX zayif okul sifresi
**Aciklama:** 10.000 kombinasyon, rate-limit ile 30 saatlik tarama mumkun.
**Kategori:** TASARIM → format degisirse uretilmis sifreler patlar; next-steps'de "8-12 hane karma" onerisi var

### S7. Mudur exports limit yok
**Aciklama:** Buyuk okul → RAM riski.
**Kategori:** TODO → next-steps

### S8. Dashboard timezone
**Aciklama:** MySQL DATE() server timezone bagimli.
**Kategori:** TODO → next-steps

### S9. Delivery PDF null check
**Aciklama:** `pdfPath null` durumunda silent fail.
**Kategori:** TODO → next-steps

### S10. Excel filename Turkce karakter
**Kategori:** TODO → next-steps

### S11. CSP header next.config.ts'de yok
**Kategori:** HATA → FIX-14

### S12. Cookie path tanimli degil
**Kategori:** TODO → next-steps (isolation iyilestirmesi)

---

## OZET SAYILAR
- **HATA** (duzeltilecek): 15 (FIX-1..FIX-15)
- **TASARIM** (dokunulmayacak): 6
- **TODO** (next-steps'e): 9
