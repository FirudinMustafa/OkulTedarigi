/**
 * Aras Kargo Entegrasyonu (Mock)
 * Gercek API bilgileri verildiginde bu dosya guncellenecek
 */

export interface ShipmentData {
  orderNumber: string
  receiverName: string
  receiverPhone: string
  receiverAddress: string
  receiverCity?: string
  receiverDistrict?: string
  packageCount: number
  packageWeight?: number
  packageContent: string
}

export interface ShipmentResult {
  success: boolean
  trackingNo?: string
  trackingUrl?: string
  errorMessage?: string
}

export interface TrackingInfo {
  status: string
  statusCode: string
  lastUpdate: string
  location: string
  estimatedDelivery?: string
  events: {
    date: string
    status: string
    location: string
  }[]
}

// Default: mock KAPALI. Dev'de USE_MOCK_CARGO=true belirtilmeli.
const USE_MOCK = process.env.USE_MOCK_CARGO === 'true'
const isDev = process.env.NODE_ENV !== 'production'

/**
 * Kargo kaydı olustur
 */
export async function createShipment(data: ShipmentData): Promise<ShipmentResult> {
  if (USE_MOCK) {
    if (isDev) {
      console.log('[MOCK ARAS KARGO] Kargo kaydi olusturuluyor:', data.orderNumber)
      console.log('  - Alici:', data.receiverName)
      console.log('  - Adres:', data.receiverAddress)
    }

    // Simulasyon: 1 saniye bekle
    await new Promise(resolve => setTimeout(resolve, 1000))

    const trackingNo = `ARAS${Date.now().toString().slice(-10)}`

    return {
      success: true,
      trackingNo,
      trackingUrl: `https://kargotakip.araskargo.com.tr/mainpage.aspx?code=${trackingNo}`
    }
  }

  // TODO: Gercek Aras Kargo entegrasyonu
  throw new Error('Gercek Aras Kargo entegrasyonu henuz yapilandirilmadi')
}

/**
 * Kargo takibi
 */
export async function getTrackingInfo(trackingNo: string): Promise<TrackingInfo> {
  if (USE_MOCK) {
    if (isDev) console.log('[MOCK ARAS KARGO] Kargo takip sorgusu:', trackingNo)

    const now = new Date()
    const estimatedDelivery = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000) // 2 gun sonra

    return {
      status: 'DAGITIMDA',
      statusCode: 'IN_TRANSIT',
      lastUpdate: now.toISOString(),
      location: 'Ankara Transfer Merkezi',
      estimatedDelivery: estimatedDelivery.toISOString(),
      events: [
        {
          date: now.toISOString(),
          status: 'Kargo dagitim subesine ulasti',
          location: 'Ankara Transfer Merkezi'
        },
        {
          date: new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString(),
          status: 'Kargo aracla yola cikti',
          location: 'Istanbul Merkez'
        },
        {
          date: new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString(),
          status: 'Kargo teslim alindi',
          location: 'Istanbul Merkez'
        }
      ]
    }
  }

  // TODO: Gercek Aras Kargo takip
  throw new Error('Gercek Aras Kargo entegrasyonu henuz yapilandirilmadi')
}

/**
 * Kargo iptal
 */
export async function cancelShipment(trackingNo: string): Promise<{ success: boolean; message?: string }> {
  if (USE_MOCK) {
    if (isDev) console.log('[MOCK ARAS KARGO] Kargo iptali:', trackingNo)

    await new Promise(resolve => setTimeout(resolve, 500))

    return {
      success: true,
      message: 'Kargo iptali basarili (Mock)'
    }
  }

  // TODO: Gercek Aras Kargo iptal
  throw new Error('Gercek Aras Kargo entegrasyonu henuz yapilandirilmadi')
}
