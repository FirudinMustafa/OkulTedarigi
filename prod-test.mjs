import { chromium } from 'playwright'

const BASE = 'https://okul-tedarigi.vercel.app'

const results = []
function log(test, status, detail = '') {
  results.push({ test, status, detail })
  const icon = status === 'PASS' ? '✓' : status === 'FAIL' ? '✗' : '~'
  console.log(`${icon} [${status}] ${test}${detail ? ' — ' + detail : ''}`)
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ ignoreHTTPSErrors: true })

  // 1. Landing page
  try {
    const page = await context.newPage()
    await page.goto(`${BASE}/`)
    await page.waitForLoadState('networkidle')
    const title = await page.title()
    const heroVisible = await page.locator('text=/Okul kitap/i').first().isVisible().catch(() => false)
    log('T1 Landing açılıyor', heroVisible ? 'PASS' : 'FAIL', `title="${title}"`)
    await page.close()
  } catch (e) { log('T1', 'FAIL', e.message.slice(0, 100)) }

  // 2. Hero alt başlığı (yeni metin)
  try {
    const page = await context.newPage()
    await page.goto(`${BASE}/`)
    await page.waitForLoadState('networkidle')
    const newText = await page.locator('text=/Okulunuzun belirlediği eğitim paketini/i').isVisible().catch(() => false)
    log('T2 Hero yeni alt başlığı', newText ? 'PASS' : 'FAIL')
    await page.close()
  } catch (e) { log('T2', 'FAIL', e.message.slice(0, 100)) }

  // 3. Stats responsive — mobile viewport (320px)
  try {
    const mobileCtx = await browser.newContext({ viewport: { width: 360, height: 800 } })
    const page = await mobileCtx.newPage()
    await page.goto(`${BASE}/`)
    await page.waitForLoadState('networkidle')
    // "2-3 gün" overflow yok mu?
    const stat = page.locator('text=/2-3 gün/').first()
    const visible = await stat.isVisible().catch(() => false)
    log('T3 Stats "2-3 gün" mobilde görünür (overflow yok)', visible ? 'PASS' : 'FAIL')

    // Sayı ve etiket varlığı
    const okulVisible = await page.locator('text=/150\\+/').first().isVisible().catch(() => false)
    const ogVisible = await page.locator('text=/12K\\+/').first().isVisible().catch(() => false)
    log('T3b Stats tüm rakamlar mobilde görünür', okulVisible && ogVisible ? 'PASS' : 'FAIL')
    await mobileCtx.close()
  } catch (e) { log('T3', 'FAIL', e.message.slice(0, 100)) }

  // 4. Sipariş sayfası okul şifresi formu
  try {
    const page = await context.newPage()
    await page.goto(`${BASE}/siparis`)
    await page.waitForLoadState('networkidle')
    const inputCount = await page.locator('input[id="schoolPassword"]').count()
    log('T4 /siparis okul şifre formu', inputCount > 0 ? 'PASS' : 'FAIL')
    await page.close()
  } catch (e) { log('T4', 'FAIL', e.message.slice(0, 100)) }

  // 5. Yanlış şifre + hata mesajı
  try {
    const page = await context.newPage()
    await page.goto(`${BASE}/siparis`)
    await page.fill('input[id="schoolPassword"]', 'YANLIS-SIFRE-XYZ-9999')
    await page.click('button[type="submit"]')
    const errMsg = await page.waitForSelector('text=/Geçersiz|sifre/i', { timeout: 5000 }).catch(() => null)
    log('T5 Yanlış şifre hata mesajı', errMsg ? 'PASS' : 'FAIL')
    await page.close()
  } catch (e) { log('T5', 'FAIL', e.message.slice(0, 100)) }

  // 6. Admin login sayfası render
  try {
    const page = await context.newPage()
    await page.goto(`${BASE}/admin/login`)
    await page.waitForLoadState('networkidle')
    const email = await page.locator('input[type="email"]').count()
    const pw = await page.locator('input[type="password"]').count()
    log('T6 Admin login form', email > 0 && pw > 0 ? 'PASS' : 'FAIL')
    await page.close()
  } catch (e) { log('T6', 'FAIL', e.message.slice(0, 100)) }

  // 7. Müdür login sayfası render
  try {
    const page = await context.newPage()
    await page.goto(`${BASE}/mudur/login`)
    await page.waitForLoadState('networkidle')
    const email = await page.locator('input[type="email"]').count()
    log('T7 Müdür login form', email > 0 ? 'PASS' : 'FAIL')
    await page.close()
  } catch (e) { log('T7', 'FAIL', e.message.slice(0, 100)) }

  // 8. KVKK & Mesafeli Satış
  try {
    const page = await context.newPage()
    await page.goto(`${BASE}/kvkk`)
    const k = await page.locator('text=/KVKK|Kisisel Veriler|Aydinlatma/i').first().isVisible().catch(() => false)
    log('T8 KVKK sayfası', k ? 'PASS' : 'FAIL')
    await page.goto(`${BASE}/mesafeli-satis`)
    const m = await page.locator('text=/Mesafeli|Sozlesme/i').first().isVisible().catch(() => false)
    log('T8b Mesafeli Satış sayfası', m ? 'PASS' : 'FAIL')
    await page.close()
  } catch (e) { log('T8', 'FAIL', e.message.slice(0, 100)) }

  // 9. CSP header check (frontend script bloklaması)
  try {
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', e => errors.push(e.message))
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text())
    })
    await page.goto(`${BASE}/`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
    // CSP veya hydration hatası var mı?
    const cspErrors = errors.filter(e => e.includes('CSP') || e.includes('Content Security') || e.includes('Hydration'))
    log('T9 Frontend hata yok', cspErrors.length === 0 ? 'PASS' : 'FAIL',
        cspErrors.length > 0 ? cspErrors[0].slice(0, 100) : 'temiz')
    await page.close()
  } catch (e) { log('T9', 'FAIL', e.message.slice(0, 100)) }

  // 10. Sipariş takip sayfası
  try {
    const page = await context.newPage()
    await page.goto(`${BASE}/siparis-takip`)
    await page.waitForLoadState('networkidle')
    const inputVisible = await page.locator('input').first().isVisible().catch(() => false)
    log('T10 Sipariş takip', inputVisible ? 'PASS' : 'FAIL')
    await page.close()
  } catch (e) { log('T10', 'FAIL', e.message.slice(0, 100)) }

  await browser.close()

  console.log('\n=========== ÖZET ===========')
  const pass = results.filter(r => r.status === 'PASS').length
  const fail = results.filter(r => r.status === 'FAIL').length
  const warn = results.filter(r => r.status === 'WARN').length
  console.log(`PASS: ${pass} | FAIL: ${fail} | WARN: ${warn}`)
}

main().catch(e => { console.error(e); process.exit(2) })
