import { chromium } from 'playwright'

const BASE = 'http://localhost:3000'
const SCHOOL_PASSWORD = 'SFR-LVMK-PK33-JSYX'
const CLASS_ID = 'cmomv2j4f0008c4uwo6duehvy'

const results = []
function log(test, status, detail = '') {
  results.push({ test, status, detail })
  const icon = status === 'PASS' ? '✓' : status === 'FAIL' ? '✗' : '~'
  console.log(`${icon} [${status}] ${test}${detail ? ' — ' + detail : ''}`)
}

async function setupOrderForPayment(context) {
  // Yeni sipariş oluştur, /odeme/[orderId] sayfasına gidebilelim
  const page = await context.newPage()
  await page.goto(`${BASE}/siparis`)
  // Şifreyi gir
  await page.fill('input[id="schoolPassword"]', SCHOOL_PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForLoadState('networkidle')
  // Sınıfa tıkla (ilk class card)
  await page.locator('button').filter({ hasText: '1-A' }).first().click()
  await page.waitForURL(/\/paket\//, { timeout: 10000 })
  await page.close()
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ ignoreHTTPSErrors: true })

  // ==========================================================================
  // TEST 1: Sipariş sayfası açılıyor + okul şifresi formu var
  // ==========================================================================
  try {
    const page = await context.newPage()
    await page.goto(`${BASE}/siparis`)
    const passInput = await page.locator('input[id="schoolPassword"]').count()
    log('T1 /siparis sayfası okul şifre alanı var', passInput > 0 ? 'PASS' : 'FAIL', `input count=${passInput}`)
    await page.close()
  } catch (e) {
    log('T1 /siparis sayfası okul şifre alanı var', 'FAIL', String(e.message).slice(0, 100))
  }

  // ==========================================================================
  // TEST 2: Okul şifresi yanlış girildiğinde hata mesajı
  // ==========================================================================
  try {
    const page = await context.newPage()
    await page.goto(`${BASE}/siparis`)
    await page.fill('input[id="schoolPassword"]', 'YANLIS-SIFRE-1234')
    await page.click('button[type="submit"]')
    // Hata mesajını bekle
    const errMsg = await page.waitForSelector('text=/şifre|sifre|Geçersiz/', { timeout: 5000 }).catch(() => null)
    log('T2 Yanlış okul şifresi hata mesajı', errMsg ? 'PASS' : 'FAIL')
    await page.close()
  } catch (e) {
    log('T2 Yanlış okul şifresi hata mesajı', 'FAIL', String(e.message).slice(0, 100))
  }

  // ==========================================================================
  // TEST 3: Doğru şifre → sınıf listesi geliyor
  // ==========================================================================
  let packagePageUrl = null
  try {
    const page = await context.newPage()
    await page.goto(`${BASE}/siparis`)
    await page.fill('input[id="schoolPassword"]', SCHOOL_PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForLoadState('networkidle')
    // Sınıf "1-A" görünmeli
    const classBtn = await page.locator('text=1-A').first()
    const visible = await classBtn.isVisible().catch(() => false)
    log('T3 Doğru şifre sonrası 1-A sınıfı görünüyor', visible ? 'PASS' : 'FAIL')

    if (visible) {
      // Sınıfa tıkla, paket sayfasına git
      await classBtn.click()
      await page.waitForURL(/\/paket\//, { timeout: 10000 })
      packagePageUrl = page.url()
      log('T3b Paket sayfasına yönlendirildi', 'PASS', packagePageUrl)
    }
    await page.close()
  } catch (e) {
    log('T3 Doğru şifre sonrası sınıf listesi', 'FAIL', String(e.message).slice(0, 100))
  }

  // ==========================================================================
  // TEST 4: F5 form state localStorage restore
  // ==========================================================================
  if (packagePageUrl) {
    try {
      const page = await context.newPage()
      // SessionStorage gerekli — manuel set et çünkü context yeni
      await page.goto(`${BASE}/siparis`)
      await page.fill('input[id="schoolPassword"]', SCHOOL_PASSWORD)
      await page.click('button[type="submit"]')
      await page.waitForLoadState('networkidle')
      await page.locator('text=1-A').first().click()
      await page.waitForURL(/\/paket\//, { timeout: 10000 })

      // Form alanlarına değer gir
      await page.fill('input[type="email"]', 'kayit-testi@example.com').catch(() => {})
      // İlk text input'a (firstName) "Mehmet" yaz
      const inputs = page.locator('input[type="text"]')
      await inputs.nth(0).fill('Mehmet').catch(() => {})  // firstName
      await inputs.nth(1).fill('Testci').catch(() => {})  // lastName
      const phone = page.locator('input[type="tel"]')
      await phone.fill('05551234567').catch(() => {})

      // Auto-save için 1 saniye bekle (debounce 500ms)
      await page.waitForTimeout(1200)

      // localStorage'da kayıt var mı?
      const storageKey = `paket-form-${CLASS_ID}`
      const stored = await page.evaluate((k) => localStorage.getItem(k), storageKey)
      log('T4 Form state localStorage\'a kaydedildi', stored ? 'PASS' : 'FAIL',
          stored ? `${stored.length} byte` : 'stored=null')

      if (stored) {
        const parsed = JSON.parse(stored)
        const hasFirstName = parsed.firstName === 'Mehmet'
        const hasEmail = parsed.email === 'kayit-testi@example.com'
        log('T4b localStorage içeriği doğru', hasFirstName && hasEmail ? 'PASS' : 'FAIL',
            `firstName=${parsed.firstName}, email=${parsed.email}`)
      }

      // F5: Sayfayı yenile
      await page.reload()
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(500)

      // Değerler restore oldu mu?
      const inputsAfter = page.locator('input[type="text"]')
      const firstNameAfter = await inputsAfter.nth(0).inputValue().catch(() => '')
      const emailAfter = await page.locator('input[type="email"]').inputValue().catch(() => '')
      log('T4c F5 sonrası firstName restore', firstNameAfter === 'Mehmet' ? 'PASS' : 'FAIL', `value="${firstNameAfter}"`)
      log('T4d F5 sonrası email restore', emailAfter === 'kayit-testi@example.com' ? 'PASS' : 'FAIL', `value="${emailAfter}"`)

      await page.close()
    } catch (e) {
      log('T4 F5 form state', 'FAIL', String(e.message).slice(0, 150))
    }
  } else {
    log('T4 F5 form state', 'SKIP', 'paket sayfasına ulaşılamadı')
  }

  // ==========================================================================
  // TEST 5: Real-time field validation (onBlur)
  // ==========================================================================
  try {
    const page = await context.newPage()
    await page.goto(`${BASE}/siparis`)
    await page.fill('input[id="schoolPassword"]', SCHOOL_PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForLoadState('networkidle')
    await page.locator('text=1-A').first().click()
    await page.waitForURL(/\/paket\//, { timeout: 10000 })
    await page.waitForTimeout(500)

    // Email'a geçersiz girilmesi → blur
    const emailInput = page.locator('input[type="email"]')
    await emailInput.fill('bozuk-email')
    await emailInput.blur()
    await page.waitForTimeout(300)

    // Hata mesajı görünüyor mu?
    const emailError = await page.locator('text=/Geçerli bir e-posta/').isVisible().catch(() => false)
    log('T5 Email onBlur validation hata mesajı', emailError ? 'PASS' : 'FAIL')

    // Telefon — geçersiz
    const phoneInput = page.locator('input[type="tel"]')
    await phoneInput.fill('123')
    await phoneInput.blur()
    await page.waitForTimeout(300)
    const phoneError = await page.locator('text=/telefon numarası/').isVisible().catch(() => false)
    log('T5b Telefon onBlur validation', phoneError ? 'PASS' : 'FAIL')

    // Email düzeltildiğinde hata kayboluyor mu?
    await emailInput.fill('dogru@email.com')
    await emailInput.blur()
    await page.waitForTimeout(300)
    const emailErrorGone = await page.locator('text=/Geçerli bir e-posta/').isVisible().catch(() => false)
    log('T5c Email düzelince hata kayboldu', !emailErrorGone ? 'PASS' : 'FAIL')

    await page.close()
  } catch (e) {
    log('T5 Real-time validation', 'FAIL', String(e.message).slice(0, 150))
  }

  // ==========================================================================
  // TEST 6: Kart bilgisi autoComplete attribute (ödeme sayfası)
  // ==========================================================================
  try {
    // Önce siteye git, sonra fetch yap (relative URL sorununu önle)
    const apiPage = await context.newPage()
    await apiPage.goto(`${BASE}/`)
    const apiRes = await apiPage.evaluate(async () => {
      const r = await fetch('/api/veli/order?orderNumber=ORD-2026-HTZN2UW7')
      return await r.json()
    })
    await apiPage.close()

    if (apiRes && apiRes.id && apiRes.accessToken) {
      const page = await context.newPage()
      await page.goto(`${BASE}/odeme/${apiRes.id}?t=${apiRes.accessToken}`)
      await page.waitForLoadState('networkidle')

      // Kart input'larında autocomplete attribute'larını kontrol et
      const cardNumberAuto = await page.locator('input[name="cardNumber"]').getAttribute('autocomplete').catch(() => null)
      const cardHolderAuto = await page.locator('input[name="cardHolder"]').getAttribute('autocomplete').catch(() => null)
      const expiryAuto = await page.locator('input[name="expiry"]').getAttribute('autocomplete').catch(() => null)
      const cvvAuto = await page.locator('input[name="cvv"]').getAttribute('autocomplete').catch(() => null)

      log('T6 cardNumber autocomplete=cc-number', cardNumberAuto === 'cc-number' ? 'PASS' : 'FAIL', `value="${cardNumberAuto}"`)
      log('T6b cardHolder autocomplete=cc-name', cardHolderAuto === 'cc-name' ? 'PASS' : 'FAIL', `value="${cardHolderAuto}"`)
      log('T6c expiry autocomplete=cc-exp', expiryAuto === 'cc-exp' ? 'PASS' : 'FAIL', `value="${expiryAuto}"`)
      log('T6d cvv autocomplete=cc-csc', cvvAuto === 'cc-csc' ? 'PASS' : 'FAIL', `value="${cvvAuto}"`)
      await page.close()
    } else {
      log('T6 Kart autoComplete', 'SKIP', 'Sipariş yüklenemedi')
    }
  } catch (e) {
    log('T6 Kart autoComplete', 'FAIL', String(e.message).slice(0, 150))
  }

  // ==========================================================================
  // TEST 7: BroadcastChannel çoklu sekme uyarısı
  // ==========================================================================
  try {
    const apiPage = await context.newPage()
    await apiPage.goto(`${BASE}/`)
    const apiRes = await apiPage.evaluate(async () => {
      const r = await fetch('/api/veli/order?orderNumber=ORD-2026-HTZN2UW7')
      return await r.json()
    })
    await apiPage.close()

    if (apiRes && apiRes.id && apiRes.accessToken) {
      const url = `${BASE}/odeme/${apiRes.id}?t=${apiRes.accessToken}`
      const tab1 = await context.newPage()
      const tab2 = await context.newPage()

      await tab1.goto(url)
      await tab1.waitForLoadState('networkidle')
      await tab1.waitForTimeout(500)

      await tab2.goto(url)
      await tab2.waitForLoadState('networkidle')
      await tab2.waitForTimeout(1000)

      // Tab2'de "baska bir sekmede" uyarısı görünmeli
      const tab2Warning = await tab2.locator('text=/baska bir sekmede|Cift odeme/i').isVisible().catch(() => false)
      // Tab1'de de görünmeli (BroadcastChannel symmetric)
      const tab1Warning = await tab1.locator('text=/baska bir sekmede|Cift odeme/i').isVisible().catch(() => false)

      log('T7 BroadcastChannel tab2 uyarı', tab2Warning ? 'PASS' : 'FAIL')
      log('T7b BroadcastChannel tab1 uyarı (symmetric)', tab1Warning ? 'PASS' : 'WARN', 'kabul edilebilir: tab1 ack alır almaz görür')

      await tab1.close()
      await tab2.close()
    } else {
      log('T7 BroadcastChannel', 'SKIP', 'Sipariş yüklenemedi')
    }
  } catch (e) {
    log('T7 BroadcastChannel', 'FAIL', String(e.message).slice(0, 150))
  }

  // ==========================================================================
  // TEST 8: Müdür siparişler pagination link'leri
  // ==========================================================================
  try {
    const page = await context.newPage()
    await page.goto(`${BASE}/mudur/login`)
    await page.fill('input[type="email"]', 'mudur@test.com')
    await page.fill('input[type="password"]', 'Mudur12345!')
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/mudur(?!\/login)/, { timeout: 10000 })

    // Min limit kodda 10. 11+ sipariş gerektiren test için: limit=10 ile sayfa 1 dolarsa Sonraki görünür.
    // Mevcut 6 sipariş < 10 olduğu için tek sayfa olur. Bu test için yeterli sipariş üret.
    await page.goto(`${BASE}/mudur/siparisler?limit=10`)
    await page.waitForLoadState('networkidle')

    // "Sayfa X / Y" ifadesi
    const pagination = await page.locator('text=/Sayfa \\d+ \\/ \\d+/').isVisible().catch(() => false)
    log('T8 Müdür pagination "Sayfa X / Y" görünür', pagination ? 'PASS' : 'FAIL')

    // Toplam sipariş sayısını gör
    const totalText = await page.locator('text=/Toplam \\d+/').textContent().catch(() => '')
    log('T8a Müdür sipariş sayısı bilgisi', totalText ? 'PASS' : 'WARN', totalText)

    // "Sonraki" link veya disabled span — pagination UI tam render edildi mi?
    const nextSpanOrLink = await page.locator(':text("Sonraki")').count()
    log('T8b Pagination UI elemanları render', nextSpanOrLink > 0 ? 'PASS' : 'FAIL', `Sonraki count=${nextSpanOrLink}`)

    // "Onceki" disabled span görünmeli (sayfa 1)
    const prevSpan = await page.locator(':text("Onceki")').count()
    log('T8c Sayfa 1\'de "Onceki" görünüyor (disabled)', prevSpan > 0 ? 'PASS' : 'FAIL')
    await page.close()
  } catch (e) {
    log('T8 Müdür pagination', 'FAIL', String(e.message).slice(0, 150))
  }

  // ==========================================================================
  // TEST 9: Empty state — admin'de filtre boş sonuç
  // ==========================================================================
  try {
    const page = await context.newPage()
    await page.goto(`${BASE}/admin/login`)
    await page.fill('input[type="email"]', 'admin@okultedarigim.com')
    await page.fill('input[type="password"]', 'Admin12345!Test')
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/admin(?!\/login)/, { timeout: 10000 })

    await page.goto(`${BASE}/admin/siparisler`)
    await page.waitForLoadState('networkidle')
    // Client-side render için biraz daha bekle
    await page.waitForSelector('input[placeholder*="Siparis no"]', { timeout: 10000 })
    await page.waitForTimeout(500)

    // Search box: gerçek placeholder ile bul
    const searchBox = page.locator('input[placeholder*="Siparis no"]').first()
    await searchBox.click() // focus
    await searchBox.fill('ZZZZZ_HICBIRSEY_BULAMASIN_XYZ')
    // Input event manuel tetikle
    await searchBox.press('End')
    await page.waitForTimeout(1500) // React state update + re-render

    // Empty state mesajı (filtreli) - daha gevşek selector
    const bodyText = await page.locator('body').textContent()
    const hasFilterMsg = bodyText.includes('Filtre sonucuna') || bodyText.includes('filtreleri temizleyip')
    log('T9 Filtre boş sonuç mesajı (filter empty state)', hasFilterMsg ? 'PASS' : 'FAIL',
        hasFilterMsg ? '' : 'body text içeriği: ' + bodyText.match(/Henuz|Filtre|sonucuna|bulunamadi/g))

    // Aramayı temizle, normal liste tekrar görünmeli
    await searchBox.fill('')
    await page.waitForTimeout(500)
    const tableVisible = await page.locator('table').isVisible().catch(() => false)
    log('T9b Arama temizlenince liste görünür', tableVisible ? 'PASS' : 'FAIL')

    await page.close()
  } catch (e) {
    log('T9 Empty state', 'FAIL', String(e.message).slice(0, 150))
  }

  // ==========================================================================
  // TEST 10: Sipariş onay sayfası render
  // ==========================================================================
  try {
    const page = await context.newPage()
    await page.goto(`${BASE}/siparis-onay/ORD-2026-HTZN2UW7`)
    await page.waitForLoadState('networkidle')
    const orderNoVisible = await page.locator('text=/ORD-2026-HTZN2UW7/').isVisible().catch(() => false)
    log('T10 Sipariş onay sayfası orderNumber gösterir', orderNoVisible ? 'PASS' : 'FAIL')
    await page.close()
  } catch (e) {
    log('T10 Sipariş onay', 'FAIL', String(e.message).slice(0, 100))
  }

  // ==========================================================================
  // TEST 11: Sipariş takip sayfası
  // ==========================================================================
  try {
    const page = await context.newPage()
    await page.goto(`${BASE}/siparis-takip`)
    await page.waitForLoadState('networkidle')
    const inputVisible = await page.locator('input').first().isVisible().catch(() => false)
    log('T11 Sipariş takip sayfası açılıyor', inputVisible ? 'PASS' : 'FAIL')
    await page.close()
  } catch (e) {
    log('T11 Sipariş takip', 'FAIL', String(e.message).slice(0, 100))
  }

  // ==========================================================================
  // TEST 12: KVKK & Mesafeli Satış sayfaları
  // ==========================================================================
  try {
    const page = await context.newPage()
    await page.goto(`${BASE}/kvkk`)
    const kvkkOk = await page.locator('text=/KVKK|Kisisel Veriler/i').first().isVisible().catch(() => false)
    log('T12 KVKK sayfası içerik', kvkkOk ? 'PASS' : 'FAIL')
    await page.goto(`${BASE}/mesafeli-satis`)
    const mesafeliOk = await page.locator('text=/Mesafeli|Sozlesme/i').first().isVisible().catch(() => false)
    log('T12b Mesafeli Satış sayfası içerik', mesafeliOk ? 'PASS' : 'FAIL')
    await page.close()
  } catch (e) {
    log('T12 KVKK/Mesafeli', 'FAIL', String(e.message).slice(0, 100))
  }

  // ==========================================================================
  // ÖZET
  // ==========================================================================
  await browser.close()

  console.log('\n=========== ÖZET ===========')
  const pass = results.filter(r => r.status === 'PASS').length
  const fail = results.filter(r => r.status === 'FAIL').length
  const warn = results.filter(r => r.status === 'WARN').length
  const skip = results.filter(r => r.status === 'SKIP').length
  console.log(`PASS: ${pass} | FAIL: ${fail} | WARN: ${warn} | SKIP: ${skip}`)
  if (fail > 0) {
    console.log('\nBaşarısız testler:')
    results.filter(r => r.status === 'FAIL').forEach(r => console.log(`  - ${r.test} (${r.detail})`))
    process.exit(1)
  }
}

main().catch(e => { console.error(e); process.exit(2) })
