/**
 * SMS Servisi - Twilio API
 * USE_MOCK_SMS=false ise Twilio uzerinden gercek SMS gonderir
 */

export interface SMSResult {
  success: boolean
  messageId?: string
  errorMessage?: string
}

// Default: mock KAPALI. Dev'de USE_MOCK_SMS=true belirtilmeli.
const USE_MOCK = process.env.USE_MOCK_SMS === 'true'
const isDev = process.env.NODE_ENV !== 'production'
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || ''
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || ''
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER || ''

function formatPhone(phone: string): string {
  // 05xx -> +905xx formatina cevir
  const cleaned = phone.replace(/\s+/g, '').replace(/-/g, '')
  if (cleaned.startsWith('0') && cleaned.length === 11) {
    return '+9' + cleaned
  }
  if (cleaned.startsWith('+')) return cleaned
  if (cleaned.startsWith('9') && cleaned.length === 12) return '+' + cleaned
  return '+90' + cleaned
}

async function sendViaTwilio(phone: string, message: string): Promise<SMSResult> {
  const to = formatPhone(phone)
  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`
  const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64')

  const body = new URLSearchParams({
    From: TWILIO_PHONE_NUMBER,
    To: to,
    Body: message
  })

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: body.toString()
  })

  const json = await res.json()

  if (!res.ok) {
    console.error(`[TWILIO] SMS gonderilemedi: ${json.message} (code: ${json.code})`)
    return {
      success: false,
      errorMessage: json.message || 'SMS gonderilemedi'
    }
  }

  console.log(`[TWILIO] SMS gonderildi: ${to} - SID: ${json.sid} Status: ${json.status}`)
  return {
    success: true,
    messageId: json.sid
  }
}

export async function sendSMS(data: { to: string; message: string }): Promise<SMSResult> {
  return sendSMSInternal(data.to, data.message)
}

async function sendSMSInternal(phone: string, message: string): Promise<SMSResult> {
  if (USE_MOCK) {
    if (isDev) {
      console.log('[MOCK SMS] ===============================')
      console.log(`[MOCK SMS] To: ${phone}`)
      console.log(`[MOCK SMS] Message: ${message}`)
      console.log('[MOCK SMS] ===============================')
    }

    await new Promise(resolve => setTimeout(resolve, 200))

    return {
      success: true,
      messageId: `sms_${Date.now()}`
    }
  }

  return sendViaTwilio(phone, message)
}

/**
 * Siparis onay SMS
 */
export async function sendOrderSMS(phone: string, orderNumber: string): Promise<SMSResult> {
  const message = `Siparisiniz alindi. Siparis No: ${orderNumber}. Takip icin web sitemizi ziyaret edin. - OkulTedarigim.com`
  return sendSMSInternal(phone, message)
}

/**
 * Odeme onay SMS
 */
export async function sendPaymentSMS(phone: string, orderNumber: string, amount: number): Promise<SMSResult> {
  const message = `${orderNumber} no'lu siparisiniz icin ${amount} TL odeme alindi. Tesekkurler! - OkulTedarigim.com`
  return sendSMSInternal(phone, message)
}

/**
 * Kargo takip SMS
 */
export async function sendCargoTrackingSMS(phone: string, trackingNo: string): Promise<SMSResult> {
  const message = `Kargonuz yola cikti! Takip No: ${trackingNo} - OkulTedarigim.com`
  return sendSMSInternal(phone, message)
}

/**
 * Teslim bildirim SMS
 */
export async function sendDeliverySMS(phone: string, orderNumber: string): Promise<SMSResult> {
  const message = `${orderNumber} no'lu siparisiniz teslim edildi. Bizi tercih ettiginiz icin tesekkurler! - OkulTedarigim.com`
  return sendSMSInternal(phone, message)
}

/**
 * Iptal bildirim SMS
 */
export async function sendCancellationSMS(phone: string, orderNumber: string): Promise<SMSResult> {
  const message = `${orderNumber} no'lu siparisiniz iptal edildi. Detaylar icin web sitemizi ziyaret edin. - OkulTedarigim.com`
  return sendSMSInternal(phone, message)
}
