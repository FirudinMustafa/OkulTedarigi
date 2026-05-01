/**
 * KolayBi izole entegrasyon testi
 * Calistirma:
 *   USE_MOCK_INVOICE=true npx ts-node scripts/test-kolaybi.ts        # Mock akis
 *   USE_MOCK_INVOICE=false KOLAYBI_API_KEY=xxx KOLAYBI_CHANNEL=yyy \
 *     npx ts-node scripts/test-kolaybi.ts                             # Gercek sandbox
 */

import { createInvoice, cancelInvoice, getInvoiceStatus, kolayBiConfig, _clearKolayBiTokenCache } from '../src/lib/kolaybi'

const fakeOrder = {
  orderNumber: 'ORD-2026-TEST0001',
  customerName: 'Ahmet Yilmaz',
  customerPhone: '+905551234567',
  customerEmail: 'test@example.com',
  customerAddress: 'Test Mahallesi, No: 1, Istanbul',
  isCorporate: false,
  taxNumber: '12345678901', // Sahte TC
  taxOffice: undefined,
  items: [
    { name: 'Okul Defteri', quantity: 5, unitPrice: 25.5, totalPrice: 127.5 },
    { name: 'Kalem Seti', quantity: 1, unitPrice: 50, totalPrice: 50 },
  ],
  totalAmount: 177.5,
}

async function run() {
  console.log('═════════════════════════════════════════')
  console.log('KolayBi Entegrasyon Testi')
  console.log('═════════════════════════════════════════')
  console.log('Konfig:')
  console.log('  baseUrl:    ', kolayBiConfig.baseUrl)
  console.log('  isSandbox:  ', kolayBiConfig.isSandbox)
  console.log('  isConfigured:', kolayBiConfig.isConfigured)
  console.log('  USE_MOCK:   ', process.env.USE_MOCK_INVOICE === 'true' ? 'YES' : 'NO')
  console.log('───────────────────────────────────────')

  console.log('\n[TEST 1] createInvoice')
  const result = await createInvoice(fakeOrder)
  console.log('  Result:', JSON.stringify(result, null, 2))
  if (!result.success) {
    console.log('  ⚠ Beklenen sonuc (mock=false ve key yok ise yapilandirilmadi mesaji)')
    return
  }

  if (!result.invoiceNo) {
    console.log('  ✗ Fatura no donmedi')
    return
  }
  console.log('  ✓ Fatura olusturuldu:', result.invoiceNo)

  console.log('\n[TEST 2] getInvoiceStatus')
  const status = await getInvoiceStatus(result.invoiceNo)
  console.log('  Status:', JSON.stringify(status, null, 2))

  console.log('\n[TEST 3] cancelInvoice')
  const cancel = await cancelInvoice(result.invoiceNo)
  console.log('  Cancel:', JSON.stringify(cancel, null, 2))

  console.log('\n═════════════════════════════════════════')
  console.log('Test tamamlandi')
  console.log('═════════════════════════════════════════')
}

run().catch(err => {
  console.error('TEST HATASI:', err)
  process.exit(1)
})
