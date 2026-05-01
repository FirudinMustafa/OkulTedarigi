/**
 * Iyzico Odeme Entegrasyonu (Mock)
 * Gercek API bilgileri verildiginde bu dosya guncellenecek
 */

export interface PaymentInitializeData {
  orderNumber: string
  amount: number
  buyerName: string
  buyerEmail: string
  buyerPhone: string
  buyerAddress?: string
  items: {
    name: string
    price: number
    quantity: number
  }[]
}

export interface PaymentResult {
  success: boolean
  paymentUrl?: string
  token?: string
  errorMessage?: string
}

export interface PaymentVerifyResult {
  success: boolean
  paymentStatus: 'COMPLETED' | 'FAILED' | 'PENDING'
  transactionId?: string
  errorMessage?: string
}

export interface RefundResult {
  success: boolean
  refundId?: string
  message?: string
}

// Default: mock KAPALI. Mock kullanmak icin .env'de USE_MOCK_PAYMENT=true belirtilmeli.
// Bu, prod'da .env eksikligi durumunda istem disi mock calismasini engeller.
const USE_MOCK = process.env.USE_MOCK_PAYMENT === 'true'
const isDev = process.env.NODE_ENV !== 'production'

/**
 * Odeme baslat
 */
export async function initializePayment(data: PaymentInitializeData): Promise<PaymentResult> {
  if (USE_MOCK) {
    if (isDev) console.log('[MOCK IYZICO] Odeme baslatiliyor:', data.orderNumber, data.amount, 'TL')

    // Simulasyon: 1 saniye bekle
    await new Promise(resolve => setTimeout(resolve, 1000))

    const token = `mock_${data.orderNumber}_${Date.now()}`

    return {
      success: true,
      paymentUrl: `/odeme/islem?token=${token}`,
      token
    }
  }

  // TODO: Gercek Iyzico entegrasyonu
  throw new Error('Gercek Iyzico entegrasyonu henuz yapilandirilmadi')
}

/**
 * Odeme dogrula
 */
export async function verifyPayment(token: string): Promise<PaymentVerifyResult> {
  if (USE_MOCK) {
    if (isDev) console.log('[MOCK IYZICO] Odeme dogrulaniyor:', token)

    // Simulasyon: 500ms bekle
    await new Promise(resolve => setTimeout(resolve, 500))

    // %95 basari orani
    const success = Math.random() > 0.05

    return {
      success,
      paymentStatus: success ? 'COMPLETED' : 'FAILED',
      transactionId: success ? `TRX_${Date.now()}` : undefined,
      errorMessage: success ? undefined : 'Odeme islemi basarisiz'
    }
  }

  // TODO: Gercek Iyzico dogrulama
  throw new Error('Gercek Iyzico entegrasyonu henuz yapilandirilmadi')
}

/**
 * Para iadesi
 */
export async function refundPayment(paymentId: string, amount: number): Promise<RefundResult> {
  if (USE_MOCK) {
    if (isDev) console.log('[MOCK IYZICO] Iade islemi:', paymentId, amount, 'TL')

    // Simulasyon: 1 saniye bekle
    await new Promise(resolve => setTimeout(resolve, 1000))

    return {
      success: true,
      refundId: `REFUND_${Date.now()}`,
      message: 'Iade islemi basariyla tamamlandi'
    }
  }

  // TODO: Gercek Iyzico iade
  throw new Error('Gercek Iyzico entegrasyonu henuz yapilandirilmadi')
}

/**
 * 3D Secure callback isleme
 */
export async function handle3DCallback(callbackData: Record<string, string>): Promise<PaymentVerifyResult> {
  if (USE_MOCK) {
    if (isDev) console.log('[MOCK IYZICO] 3D Callback:', callbackData)

    // Simulasyon
    const status = callbackData.status || 'success'

    return {
      success: status === 'success',
      paymentStatus: status === 'success' ? 'COMPLETED' : 'FAILED',
      transactionId: status === 'success' ? `TRX_${Date.now()}` : undefined
    }
  }

  // TODO: Gercek 3D callback isleme
  throw new Error('Gercek Iyzico entegrasyonu henuz yapilandirilmadi')
}

/**
 * Dogrudan odeme islemi (3D olmadan)
 */
export interface ProcessPaymentData {
  amount: number
  currency: string
  cardNumber: string
  cardHolder: string
  expiry: string
  cvv: string
  orderId: string
  orderNumber: string
  buyerName: string
  buyerEmail: string
  buyerPhone: string
}

export interface ProcessPaymentResult {
  success: boolean
  paymentId?: string
  errorMessage?: string
}

export async function processPayment(data: ProcessPaymentData): Promise<ProcessPaymentResult> {
  if (USE_MOCK) {
    if (isDev) console.log('[MOCK IYZICO] Odeme isleniyor:', data.orderNumber, data.amount, 'TL')

    // Simulasyon: 1.5 saniye bekle
    await new Promise(resolve => setTimeout(resolve, 1500))

    // Kart numarasi 4111 ile baslayanlar basarili, digerlerinde %90 basari
    const isTestCard = data.cardNumber.startsWith('4111')
    const success = isTestCard || Math.random() > 0.1

    return {
      success,
      paymentId: success ? `PAY_${Date.now()}` : undefined,
      errorMessage: success ? undefined : 'Kart bilgileri hatali veya bakiye yetersiz'
    }
  }

  // TODO: Gercek Iyzico odeme islemi
  throw new Error('Gercek Iyzico entegrasyonu henuz yapilandirilmadi')
}

/**
 * Iade islemi
 */
export interface RefundData {
  paymentId: string
  amount: number
}

export async function processRefund(data: RefundData): Promise<RefundResult> {
  if (USE_MOCK) {
    if (isDev) console.log('[MOCK IYZICO] Iade isleniyor:', data.paymentId, data.amount, 'TL')

    // Simulasyon: 1 saniye bekle
    await new Promise(resolve => setTimeout(resolve, 1000))

    return {
      success: true,
      refundId: `REF_${Date.now()}`,
      message: 'Iade islemi basariyla tamamlandi'
    }
  }

  // TODO: Gercek Iyzico iade entegrasyonu
  throw new Error('Gercek Iyzico entegrasyonu henuz yapilandirilmadi')
}
