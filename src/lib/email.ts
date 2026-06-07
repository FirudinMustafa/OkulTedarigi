/**
 * Email Servisi - Resend API
 * USE_MOCK_EMAIL=false ise Resend uzerinden gercek email gonderir
 */

import { escapeHtml } from './security'

export interface EmailData {
  to: string
  subject: string
  html: string
  text?: string
}

export interface EmailResult {
  success: boolean
  messageId?: string
  errorMessage?: string
}

// Default: mock KAPALI. Dev'de USE_MOCK_EMAIL=true belirtilmeli.
const USE_MOCK = process.env.USE_MOCK_EMAIL === 'true'
const isDev = process.env.NODE_ENV !== 'production'
const RESEND_API_KEY = process.env.RESEND_API_KEY || ''
const EMAIL_FROM = process.env.EMAIL_FROM || 'onboarding@resend.dev'
// Email icindeki tum linkler (logo, CTA butonlari) public URL kullanir.
// NEXT_PUBLIC_APP_URL localhost olabilir; mail client localhost'a erisemez.
const EMAIL_BASE_URL = process.env.NEXT_PUBLIC_EMAIL_BASE_URL || 'https://okul-tedarigi.vercel.app'
const LOGO_URL = `${EMAIL_BASE_URL}/logo-email.png`


async function sendViaResend(data: EmailData): Promise<EmailResult> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to: data.to,
      subject: data.subject,
      html: data.html
    })
  })

  const json = await res.json()

  if (!res.ok) {
    console.error('[RESEND] Email gonderilemedi:', json)
    return {
      success: false,
      errorMessage: json.message || 'Email gonderilemedi'
    }
  }

  console.log(`[RESEND] Email gonderildi: ${data.to} - ${data.subject} (${json.id})`)
  return {
    success: true,
    messageId: json.id
  }
}

export async function sendEmail(data: { to: string; subject: string; body: string }): Promise<EmailResult> {
  return sendEmailInternal({
    to: data.to,
    subject: data.subject,
    html: wrapTemplate(data.subject, `<p style="color: #334155; font-size: 15px; line-height: 1.6;">${escapeHtml(data.body)}</p>`)
  })
}

async function sendEmailInternal(data: EmailData): Promise<EmailResult> {
  if (USE_MOCK) {
    if (isDev) {
      console.log('[MOCK EMAIL] ===============================')
      console.log(`[MOCK EMAIL] To: ${data.to}`)
      console.log(`[MOCK EMAIL] Subject: ${data.subject}`)
      console.log('[MOCK EMAIL] ===============================')
    }

    await new Promise(resolve => setTimeout(resolve, 300))

    return {
      success: true,
      messageId: `mock_${Date.now()}`
    }
  }

  return sendViaResend(data)
}

// ============================================================
// Email Template System
// ============================================================

const COLORS = {
  primary: '#1e3a5f',
  primaryLight: '#2563eb',
  success: '#059669',
  warning: '#d97706',
  danger: '#dc2626',
  purple: '#7c3aed',
  bgDark: '#0f172a',
  bgLight: '#f1f5f9',
  bgCard: '#ffffff',
  textDark: '#1e293b',
  textMuted: '#64748b',
  textLight: '#94a3b8',
  border: '#e2e8f0',
}

function wrapTemplate(title: string, content: string): string {
  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: ${COLORS.bgLight}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: ${COLORS.bgLight};">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width: 600px; width: 100%;">

          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, ${COLORS.bgDark} 0%, ${COLORS.primary} 100%); padding: 32px 40px; border-radius: 12px 12px 0 0; text-align: center;">
              <a href="${EMAIL_BASE_URL}" style="text-decoration: none; display: inline-block;">
                <img src="${LOGO_URL}" alt="OkulTedariğim" width="180" height="auto" style="display: block; margin: 0 auto 12px; max-width: 180px; height: auto; border: 0;" />
              </a>
              <p style="color: ${COLORS.textLight}; margin: 0; font-size: 12px; letter-spacing: 1.5px; text-transform: uppercase;">Okul tedariğinizin tek adresi</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="background-color: ${COLORS.bgCard}; padding: 40px; border-left: 1px solid ${COLORS.border}; border-right: 1px solid ${COLORS.border};">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: ${COLORS.bgCard}; padding: 0 40px 20px; border-left: 1px solid ${COLORS.border}; border-right: 1px solid ${COLORS.border};">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="border-top: 1px solid ${COLORS.border}; padding-top: 20px;">
                    <p style="color: ${COLORS.textMuted}; font-size: 12px; line-height: 1.5; margin: 0;">
                      Bu e-posta <strong>OkulTedarigim.com</strong> taraf\u0131ndan otomatik olarak g\u00f6nderilmi\u015ftir.
                      <br>Herhangi bir sorunuz varsa <a href="mailto:destek@okultedarigim.com" style="color: ${COLORS.primaryLight}; text-decoration: none;">destek@okultedarigim.com</a> adresinden bize ula\u015fabilirsiniz.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Bottom Bar -->
          <tr>
            <td style="background-color: ${COLORS.bgDark}; padding: 16px 40px; border-radius: 0 0 12px 12px; text-align: center;">
              <p style="color: ${COLORS.textLight}; font-size: 11px; margin: 0;">
                \u00a9 ${new Date().getFullYear()} OkulTedarigim.com - T\u00fcm haklar\u0131 sakl\u0131d\u0131r.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function infoRow(label: string, value: string): string {
  return `
    <tr>
      <td style="padding: 10px 16px; color: ${COLORS.textMuted}; font-size: 13px; white-space: nowrap; vertical-align: top;">${label}</td>
      <td style="padding: 10px 16px; color: ${COLORS.textDark}; font-size: 14px; font-weight: 600;">${value}</td>
    </tr>`
}

function infoTable(rows: string): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: ${COLORS.bgLight}; border-radius: 8px; margin: 20px 0; border: 1px solid ${COLORS.border};">
      ${rows}
    </table>`
}

function statusBadge(text: string, color: string): string {
  return `<span style="display: inline-block; background-color: ${color}; color: white; padding: 6px 16px; border-radius: 20px; font-size: 13px; font-weight: 600; letter-spacing: 0.5px;">${text}</span>`
}

function greeting(name: string): string {
  return `<p style="color: ${COLORS.textDark}; font-size: 15px; line-height: 1.6; margin: 0 0 16px;">Say\u0131n <strong>${name}</strong>,</p>`
}

function paragraph(text: string): string {
  return `<p style="color: ${COLORS.textDark}; font-size: 15px; line-height: 1.6; margin: 0 0 16px;">${text}</p>`
}

function ctaButton(text: string, url: string, color: string = COLORS.primaryLight): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
      <tr>
        <td style="background-color: ${color}; border-radius: 8px; padding: 12px 28px;">
          <a href="${url}" style="color: white; text-decoration: none; font-size: 14px; font-weight: 600; display: inline-block;">${text}</a>
        </td>
      </tr>
    </table>`
}

// ============================================================
// Email Functions
// ============================================================

/**
 * Siparis onay maili
 */
export async function sendOrderConfirmation(data: {
  email: string
  orderNumber: string
  parentName: string
  studentName: string
  packageName: string
  totalAmount: number
  isSchoolDelivery?: boolean
}): Promise<EmailResult> {
  const safeParent = escapeHtml(data.parentName)
  const safeStudent = escapeHtml(data.studentName)
  const safeOrder = escapeHtml(data.orderNumber)
  const safePackage = escapeHtml(data.packageName)

  // Okula teslim olan okullarda elden teslim notu eklenir
  const schoolDeliveryNote = data.isSchoolDelivery
    ? paragraph('Sat\u0131n alaca\u011f\u0131n\u0131z e\u011fitim materyalleri, yeni e\u011fitim-\u00f6\u011fretim d\u00f6neminin ba\u015flamas\u0131yla birlikte s\u0131n\u0131f ortam\u0131nda \u00f6\u011frencilere elden teslim edilecektir.')
    : ''

  const content = `
    ${greeting(safeParent)}
    ${paragraph(`<strong>${safeStudent}</strong> i\u00e7in \u00f6demeniz ba\u015far\u0131yla al\u0131nd\u0131 ve sipari\u015finiz olu\u015fturuldu.`)}

    <div style="text-align: center; margin: 24px 0;">
      ${statusBadge('Sipari\u015f Al\u0131nd\u0131', COLORS.primaryLight)}
    </div>

    ${infoTable(
      infoRow('Sipari\u015f No', safeOrder) +
      infoRow('\u00d6\u011frenci', safeStudent) +
      infoRow('Paket', safePackage) +
      infoRow('Toplam Tutar', `<span style="color: ${COLORS.primary}; font-size: 18px;">${data.totalAmount.toLocaleString('tr-TR')} TL</span>`)
    )}

    ${ctaButton('Sipari\u015fi Takip Et', `${EMAIL_BASE_URL}/siparis-takip`)}

    ${schoolDeliveryNote}
  `

  return sendEmailInternal({
    to: data.email,
    subject: `\u2705 Sipari\u015f Al\u0131nd\u0131 - ${safeOrder}`,
    html: wrapTemplate(`Sipari\u015f Onay - ${safeOrder}`, content)
  })
}

/**
 * Odeme onay maili
 */
export async function sendPaymentConfirmation(data: {
  email: string
  orderNumber: string
  parentName: string
  totalAmount: number
}): Promise<EmailResult> {
  const safeParent = escapeHtml(data.parentName)
  const safeOrder = escapeHtml(data.orderNumber)

  const content = `
    ${greeting(safeParent)}
    ${paragraph(`<strong>${safeOrder}</strong> numaral\u0131 sipari\u015finiz i\u00e7in \u00f6demeniz ba\u015far\u0131yla al\u0131nd\u0131.`)}

    <div style="text-align: center; margin: 24px 0;">
      ${statusBadge('\u00d6deme Al\u0131nd\u0131', COLORS.success)}
    </div>

    ${infoTable(
      infoRow('Sipari\u015f No', safeOrder) +
      infoRow('\u00d6denen Tutar', `<span style="color: ${COLORS.success}; font-size: 18px;">${data.totalAmount.toLocaleString('tr-TR')} TL</span>`) +
      infoRow('\u00d6deme Tarihi', new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }))
    )}

    ${ctaButton('Sipari\u015fi Takip Et', `${EMAIL_BASE_URL}/siparis-takip`)}

    ${paragraph('Sipari\u015finiz en k\u0131sa s\u00fcrede haz\u0131rlanarak kargoya verilecektir. Kargo bilgileri ayr\u0131ca taraf\u0131n\u0131za iletilecektir.')}
  `

  return sendEmailInternal({
    to: data.email,
    subject: `\u2705 \u00d6deme Onayland\u0131 - ${safeOrder}`,
    html: wrapTemplate(`\u00d6deme Onay - ${safeOrder}`, content)
  })
}

/**
 * Kargo bildirim maili
 */
export async function sendCargoNotification(data: {
  email: string
  orderNumber: string
  parentName: string
  trackingNo: string
  trackingUrl: string
}): Promise<EmailResult> {
  const safeParent = escapeHtml(data.parentName)
  const safeOrder = escapeHtml(data.orderNumber)
  const safeTracking = escapeHtml(data.trackingNo)
  const safeTrackingUrl = encodeURI(data.trackingUrl)

  const content = `
    ${greeting(safeParent)}
    ${paragraph(`<strong>${safeOrder}</strong> numaral\u0131 sipari\u015finiz kargoya verildi!`)}

    <div style="text-align: center; margin: 24px 0;">
      ${statusBadge('Kargo Yolda', COLORS.purple)}
    </div>

    ${infoTable(
      infoRow('Sipari\u015f No', safeOrder) +
      infoRow('Kargo Takip No', `<span style="font-family: 'Courier New', monospace; font-size: 16px; background: ${COLORS.bgLight}; padding: 4px 8px; border-radius: 4px; letter-spacing: 1px;">${safeTracking}</span>`) +
      infoRow('Kargo Firmas\u0131', 'Aras Kargo')
    )}

    ${ctaButton('Kargoyu Takip Et', safeTrackingUrl, COLORS.purple)}

    ${paragraph('Kargonuz tahmini 2-4 i\u015f g\u00fcn\u00fc i\u00e7inde teslim edilecektir.')}
  `

  return sendEmailInternal({
    to: data.email,
    subject: `\ud83d\ude9a Kargonuz Yola \u00c7\u0131kt\u0131 - ${safeOrder}`,
    html: wrapTemplate(`Kargo Bildirim - ${safeOrder}`, content)
  })
}

/**
 * Teslim bildirim maili
 */
export async function sendDeliveryConfirmation(data: {
  email: string
  orderNumber: string
  parentName: string
  deliveryDate: string
}): Promise<EmailResult> {
  const safeParent = escapeHtml(data.parentName)
  const safeOrder = escapeHtml(data.orderNumber)
  const safeDate = escapeHtml(data.deliveryDate)

  const content = `
    ${greeting(safeParent)}
    ${paragraph(`<strong>${safeOrder}</strong> numaral\u0131 sipari\u015finiz ba\u015far\u0131yla teslim edildi!`)}

    <div style="text-align: center; margin: 24px 0;">
      ${statusBadge('Teslim Edildi', COLORS.success)}
    </div>

    ${infoTable(
      infoRow('Sipari\u015f No', safeOrder) +
      infoRow('Teslim Tarihi', safeDate) +
      infoRow('Durum', `<span style="color: ${COLORS.success};">Tamamland\u0131</span>`)
    )}

    ${paragraph('Bizi tercih etti\u011finiz i\u00e7in \u00e7ok te\u015fekk\u00fcr ederiz! Herhangi bir sorunuz veya \u00f6neriniz varsa bizimle ileti\u015fime ge\u00e7mekten \u00e7ekinmeyin.')}

    <div style="background: linear-gradient(135deg, ${COLORS.bgLight} 0%, #e0e7ff 100%); border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
      <p style="color: ${COLORS.textDark}; font-size: 14px; margin: 0 0 4px; font-weight: 600;">Memnun kald\u0131n\u0131z m\u0131?</p>
      <p style="color: ${COLORS.textMuted}; font-size: 13px; margin: 0;">Bizi arkada\u015flar\u0131n\u0131za \u00f6nerin!</p>
    </div>
  `

  return sendEmailInternal({
    to: data.email,
    subject: `\u2705 Sipari\u015finiz Teslim Edildi - ${safeOrder}`,
    html: wrapTemplate(`Teslim Bildirim - ${safeOrder}`, content)
  })
}

/**
 * Fatura kesim bildirimi maili
 * Mock modda sadece mock email gonderir; gercek KolayBi entegrasyonunda
 * KolayBi'nin kendisi de e-arsiv mail'i gonderir, biz ek olarak bilgilendirme
 * yapariz.
 */
export async function sendInvoiceCreated(data: {
  email: string
  orderNumber: string
  parentName: string
  invoiceNo: string
  totalAmount: number
}): Promise<EmailResult> {
  const safeParent = escapeHtml(data.parentName)
  const safeOrder = escapeHtml(data.orderNumber)
  const safeInvoice = escapeHtml(data.invoiceNo)

  const content = `
    ${greeting(safeParent)}
    ${paragraph(`<strong>${safeOrder}</strong> numaralı siparişiniz için faturanız kesildi.`)}

    <div style="text-align: center; margin: 24px 0;">
      ${statusBadge('Fatura Kesildi', COLORS.purple)}
    </div>

    ${infoTable(
      infoRow('Sipariş No', safeOrder) +
      infoRow('Fatura No', `<span style="font-family: 'Courier New', monospace; font-size: 16px; background: ${COLORS.bgLight}; padding: 4px 8px; border-radius: 4px; letter-spacing: 0.5px;">${safeInvoice}</span>`) +
      infoRow('Tutar', `<span style="color: ${COLORS.primary}; font-size: 18px;">${data.totalAmount.toLocaleString('tr-TR')} TL</span>`) +
      infoRow('Tarih', new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }))
    )}

    ${ctaButton('Siparişi Takip Et', `${EMAIL_BASE_URL}/siparis-takip?orderNumber=${encodeURIComponent(data.orderNumber)}`)}

    ${paragraph('Faturanızın elektronik (e-Arşiv / e-Fatura) kopyası kayıt altına alınmıştır. Siparişinize ait detayları sipariş takip sayfasından görebilirsiniz.')}
  `

  return sendEmailInternal({
    to: data.email,
    subject: `🧾 Faturanız Kesildi - ${safeOrder}`,
    html: wrapTemplate(`Fatura Bildirim - ${safeOrder}`, content)
  })
}

/**
 * Fatura iptal bildirimi maili (admin fatura iptali yaptığında veliye)
 */
export async function sendInvoiceCancelled(data: {
  email: string
  orderNumber: string
  parentName: string
  invoiceNo: string
}): Promise<EmailResult> {
  const safeParent = escapeHtml(data.parentName)
  const safeOrder = escapeHtml(data.orderNumber)
  const safeInvoice = escapeHtml(data.invoiceNo)

  const content = `
    ${greeting(safeParent)}
    ${paragraph(`<strong>${safeOrder}</strong> numaralı siparişiniz için kesilen fatura iptal edilmiştir.`)}

    <div style="text-align: center; margin: 24px 0;">
      ${statusBadge('Fatura İptal Edildi', COLORS.warning)}
    </div>

    ${infoTable(
      infoRow('Sipariş No', safeOrder) +
      infoRow('İptal Edilen Fatura No', `<span style="font-family: 'Courier New', monospace; font-size: 16px; background: ${COLORS.bgLight}; padding: 4px 8px; border-radius: 4px; letter-spacing: 0.5px; text-decoration: line-through;">${safeInvoice}</span>`) +
      infoRow('İptal Tarihi', new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }))
    )}

    ${paragraph('Eğer siparişiniz hâlâ aktif ise yeni bir fatura kesim sürecine alınacaktır. Sorularınız için bize ulaşabilirsiniz.')}

    ${ctaButton('Siparişi Takip Et', `${EMAIL_BASE_URL}/siparis-takip?orderNumber=${encodeURIComponent(data.orderNumber)}`)}
  `

  return sendEmailInternal({
    to: data.email,
    subject: `🧾 Fatura İptal Edildi - ${safeOrder}`,
    html: wrapTemplate(`Fatura İptal - ${safeOrder}`, content)
  })
}

/**
 * Iptal onay maili
 */
export async function sendCancellationConfirmation(data: {
  email: string
  orderNumber: string
  parentName: string
  refundAmount?: number
}): Promise<EmailResult> {
  const safeParent = escapeHtml(data.parentName)
  const safeOrder = escapeHtml(data.orderNumber)

  const refundRow = data.refundAmount
    ? infoRow('\u0130ade Tutar\u0131', `<span style="color: ${COLORS.danger}; font-size: 18px;">${data.refundAmount.toLocaleString('tr-TR')} TL</span>`)
    : ''

  const refundNote = data.refundAmount
    ? paragraph(`\u0130ade tutar\u0131 olan <strong>${data.refundAmount.toLocaleString('tr-TR')} TL</strong>, \u00f6deme yapt\u0131\u011f\u0131n\u0131z y\u00f6ntemle 3-5 i\u015f g\u00fcn\u00fc i\u00e7inde hesab\u0131n\u0131za yans\u0131yacakt\u0131r.`)
    : ''

  const content = `
    ${greeting(safeParent)}
    ${paragraph(`<strong>${safeOrder}</strong> numaral\u0131 sipari\u015finiz iptal edilmi\u015ftir.`)}

    <div style="text-align: center; margin: 24px 0;">
      ${statusBadge('\u0130ptal Edildi', COLORS.danger)}
    </div>

    ${infoTable(
      infoRow('Sipari\u015f No', data.orderNumber) +
      infoRow('\u0130ptal Tarihi', new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })) +
      refundRow
    )}

    ${refundNote}
    ${paragraph('Herhangi bir sorunuz i\u00e7in bizimle ileti\u015fime ge\u00e7ebilirsiniz. Sizi tekrar g\u00f6rmekten mutluluk duyar\u0131z.')}
  `

  return sendEmailInternal({
    to: data.email,
    subject: `\u274c Sipari\u015f \u0130ptal Edildi - ${safeOrder}`,
    html: wrapTemplate(`Sipari\u015f \u0130ptal - ${safeOrder}`, content)
  })
}

/**
 * Veliye iptal talebinin reddedildigini bildiren mail
 */
export async function sendCancellationRejected(data: {
  email: string
  orderNumber: string
  parentName: string
  reason: string
}): Promise<EmailResult> {
  const safeParent = escapeHtml(data.parentName)
  const safeOrder = escapeHtml(data.orderNumber)
  const safeReason = escapeHtml(data.reason)

  const content = `
    ${greeting(safeParent)}
    ${paragraph(`<strong>${safeOrder}</strong> numaral\u0131 sipari\u015finize ait iptal talebiniz de\u011ferlendirildi ve <strong>reddedilmi\u015ftir</strong>.`)}

    <div style="text-align: center; margin: 24px 0;">
      ${statusBadge('Talep Reddedildi', COLORS.danger)}
    </div>

    <div style="background-color: #fef2f2; border-left: 4px solid ${COLORS.danger}; border-radius: 4px; padding: 14px 16px; margin: 16px 0;">
      <p style="color: ${COLORS.textMuted}; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 6px;">Reddedilme Nedeni</p>
      <p style="color: ${COLORS.textDark}; font-size: 14px; line-height: 1.5; margin: 0;">${safeReason}</p>
    </div>

    ${paragraph('Sipari\u015finiz i\u015flemine kald\u0131\u011f\u0131 yerden devam edecektir. E\u011fer bu konuda farkl\u0131 bir sorunuz varsa bizimle ileti\u015fime ge\u00e7ebilirsiniz.')}

    ${ctaButton('Sipari\u015fi G\u00f6r\u00fcnt\u00fcle', `${EMAIL_BASE_URL}/siparis-takip?orderNumber=${encodeURIComponent(data.orderNumber)}`)}
  `

  return sendEmailInternal({
    to: data.email,
    subject: `\u0130ptal Talebiniz Reddedildi - ${safeOrder}`,
    html: wrapTemplate(`\u0130ptal Talebi Reddedildi - ${safeOrder}`, content)
  })
}

// ============================================================
// Admin Notification Emails
// ============================================================

/**
 * Yeni sipari\u015f geldi\u011finde admine bildiren mail.
 * Veli \u00f6demeyi tamamlad\u0131\u011f\u0131nda tetiklenir (PENDING degil, PAID siparis).
 */
export async function sendAdminNewOrder(data: {
  adminEmail: string
  orderNumber: string
  parentName: string
  studentName: string
  schoolName: string
  className: string
  packageName: string
  totalAmount: number
}): Promise<EmailResult> {
  const safeParent = escapeHtml(data.parentName)
  const safeStudent = escapeHtml(data.studentName)
  const safeSchool = escapeHtml(data.schoolName)
  const safeClass = escapeHtml(data.className)
  const safePackage = escapeHtml(data.packageName)
  const safeOrder = escapeHtml(data.orderNumber)

  const content = `
    ${paragraph(`<strong>${safeSchool}</strong> okulundan yeni bir sipari\u015f geldi.`)}

    <div style="text-align: center; margin: 24px 0;">
      ${statusBadge('Yeni Sipari\u015f', COLORS.success)}
    </div>

    ${infoTable(
      infoRow('Sipari\u015f No', safeOrder) +
      infoRow('Veli', safeParent) +
      infoRow('\u00d6\u011frenci', safeStudent) +
      infoRow('Okul', safeSchool) +
      infoRow('S\u0131n\u0131f', safeClass) +
      infoRow('Paket', safePackage) +
      infoRow('Tutar', `<span style="color: ${COLORS.success}; font-size: 18px;">${data.totalAmount.toLocaleString('tr-TR')} TL</span>`)
    )}

    ${ctaButton('Y\u00f6netim Paneli', `${EMAIL_BASE_URL}/admin/siparisler`)}

    ${paragraph('Sipari\u015f y\u00f6netim panelinde "Aktif" sekmesinde i\u015fleme al\u0131nmay\u0131 bekliyor.')}
  `

  return sendEmailInternal({
    to: data.adminEmail,
    subject: `Yeni Sipari\u015f - ${safeOrder} - ${data.totalAmount.toLocaleString('tr-TR')} TL`,
    html: wrapTemplate(`Yeni Sipari\u015f - ${safeOrder}`, content)
  })
}

/**
 * Veli iptal talebi olusturdugunda admine bildiren mail.
 */
export async function sendAdminNewCancelRequest(data: {
  adminEmail: string
  orderNumber: string
  parentName: string
  schoolName: string
  totalAmount: number
  reason: string
}): Promise<EmailResult> {
  const safeParent = escapeHtml(data.parentName)
  const safeSchool = escapeHtml(data.schoolName)
  const safeOrder = escapeHtml(data.orderNumber)
  const safeReason = escapeHtml(data.reason)

  const content = `
    ${paragraph(`<strong>${safeSchool}</strong> okulundan bir veli sipari\u015f iptali talep ediyor.`)}

    <div style="text-align: center; margin: 24px 0;">
      ${statusBadge('\u0130ptal Talebi', COLORS.warning)}
    </div>

    ${infoTable(
      infoRow('Sipari\u015f No', safeOrder) +
      infoRow('Veli', safeParent) +
      infoRow('Okul', safeSchool) +
      infoRow('Tutar', `<span style="color: ${COLORS.warning}; font-size: 18px;">${data.totalAmount.toLocaleString('tr-TR')} TL</span>`)
    )}

    <div style="background-color: ${COLORS.bgLight}; border-left: 4px solid ${COLORS.warning}; border-radius: 4px; padding: 14px 16px; margin: 16px 0;">
      <p style="color: ${COLORS.textMuted}; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 6px;">Velinin Belirttigi Neden</p>
      <p style="color: ${COLORS.textDark}; font-size: 14px; line-height: 1.5; margin: 0;">${safeReason}</p>
    </div>

    ${ctaButton('\u0130ptal Taleplerini \u0130ncele', `${EMAIL_BASE_URL}/admin/iptal-talepleri`, COLORS.warning)}

    ${paragraph('L\u00fctfen iptal talebini de\u011ferlendirip onayla veya reddet.')}
  `

  return sendEmailInternal({
    to: data.adminEmail,
    subject: `\u0130ptal Talebi - ${safeOrder}`,
    html: wrapTemplate(`\u0130ptal Talebi - ${safeOrder}`, content)
  })
}

// ============================================================
// Director (Mudur) Emails
// ============================================================

/**
 * Yeni okul/mudur kaydi yapildiginda mudure giden hos geldin maili.
 * Hem mudur panel kimligi hem de veli sifresi tek bir mailde gonderilir.
 */
function passwordBox(label: string, value: string, color: string): string {
  return `
    <div style="background-color: ${COLORS.bgLight}; border: 1px dashed ${color}; border-radius: 8px; padding: 14px 18px; margin: 12px 0;">
      <p style="color: ${COLORS.textMuted}; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px; margin: 0 0 6px;">${label}</p>
      <p style="font-family: 'Courier New', monospace; font-size: 18px; font-weight: 700; color: ${color}; margin: 0; letter-spacing: 1px; word-break: break-all;">${value}</p>
    </div>`
}

export async function sendDirectorWelcome(data: {
  directorEmail: string
  directorName: string | null
  schoolName: string
  loginPassword: string
  veliPassword: string
}): Promise<EmailResult> {
  const safeName = escapeHtml(data.directorName || 'Say\u0131n Yetkili')
  const safeSchool = escapeHtml(data.schoolName)
  const safeEmail = escapeHtml(data.directorEmail)
  const safeLoginPwd = escapeHtml(data.loginPassword)
  const safeVeliPwd = escapeHtml(data.veliPassword)

  const content = `
    ${greeting(safeName)}
    ${paragraph(`<strong>${safeSchool}</strong> i\u00e7in m\u00fcd\u00fcr paneli hesab\u0131n\u0131z haz\u0131rlanm\u0131\u015ft\u0131r.`)}

    <div style="text-align: center; margin: 24px 0;">
      ${statusBadge('Hesap Aktifle\u015ftirildi', COLORS.success)}
    </div>

    <h3 style="color: ${COLORS.textDark}; font-size: 16px; margin: 24px 0 8px;">M\u00fcd\u00fcr Paneli Giri\u015f Bilgileriniz</h3>
    ${paragraph('A\u015fa\u011f\u0131daki bilgilerle m\u00fcd\u00fcr paneline giri\u015f yapabilirsiniz:')}
    ${passwordBox('Email', safeEmail, COLORS.primary)}
    ${passwordBox('\u015eifre', safeLoginPwd, COLORS.primary)}

    ${ctaButton('M\u00fcd\u00fcr Paneline Giri\u015f Yap', `${EMAIL_BASE_URL}/mudur/login`)}

    <h3 style="color: ${COLORS.textDark}; font-size: 16px; margin: 24px 0 8px;">Velilerinize \u0130letmeniz Gereken \u015eifre</h3>
    ${paragraph('Velilerinizin sipari\u015f verirken kullanaca\u011f\u0131 okul \u015fifresi a\u015fa\u011f\u0131dad\u0131r. Bu \u015fifreyi okul ileti\u015fim kanallar\u0131nda velilere duyurman\u0131z gerekmektedir:')}
    ${passwordBox('Veli Sipari\u015f \u015eifresi', safeVeliPwd, COLORS.success)}

    ${ctaButton('Sipari\u015f Sayfas\u0131', `${EMAIL_BASE_URL}/siparis`, COLORS.success)}

    <div style="background-color: #fffbeb; border-left: 4px solid ${COLORS.warning}; border-radius: 4px; padding: 14px 16px; margin: 24px 0;">
      <p style="color: ${COLORS.textDark}; font-size: 13px; line-height: 1.5; margin: 0;">
        <strong>G\u00fcvenlik:</strong> L\u00fctfen bu \u015fifreleri kimseyle payla\u015fmay\u0131n. M\u00fcd\u00fcr panel \u015fifrenizi yaln\u0131zca kendiniz kullan\u0131n. Veli \u015fifresini ise yaln\u0131zca okul velilerine duyurun.
      </p>
    </div>
  `

  return sendEmailInternal({
    to: data.directorEmail,
    subject: `M\u00fcd\u00fcr Paneli Hesab\u0131n\u0131z Haz\u0131r - ${safeSchool}`,
    html: wrapTemplate(`Ho\u015f Geldiniz - ${safeSchool}`, content)
  })
}

/**
 * Mudur sifresi yenilendiginde gonderilen mail.
 */
export async function sendDirectorPasswordReset(data: {
  directorEmail: string
  directorName: string | null
  schoolName: string
  newPassword: string
}): Promise<EmailResult> {
  const safeName = escapeHtml(data.directorName || 'Say\u0131n Yetkili')
  const safeSchool = escapeHtml(data.schoolName)
  const safePwd = escapeHtml(data.newPassword)

  const content = `
    ${greeting(safeName)}
    ${paragraph(`<strong>${safeSchool}</strong> m\u00fcd\u00fcr panelinizin \u015fifresi yenilenmi\u015ftir.`)}

    <div style="text-align: center; margin: 24px 0;">
      ${statusBadge('\u015eifre Yenilendi', COLORS.warning)}
    </div>

    ${passwordBox('Yeni \u015eifreniz', safePwd, COLORS.primary)}

    ${ctaButton('M\u00fcd\u00fcr Paneline Giri\u015f Yap', `${EMAIL_BASE_URL}/mudur/login`)}

    <div style="background-color: #fffbeb; border-left: 4px solid ${COLORS.warning}; border-radius: 4px; padding: 14px 16px; margin: 24px 0;">
      <p style="color: ${COLORS.textDark}; font-size: 13px; line-height: 1.5; margin: 0;">
        Bu i\u015flemi siz yapmad\u0131ysan\u0131z l\u00fctfen derhal <a href="mailto:destek@okultedarigim.com" style="color: ${COLORS.primaryLight};">destek@okultedarigim.com</a> adresine bildirin.
      </p>
    </div>
  `

  return sendEmailInternal({
    to: data.directorEmail,
    subject: `M\u00fcd\u00fcr Panel \u015eifreniz Yenilendi - ${safeSchool}`,
    html: wrapTemplate(`\u015eifre Yenileme - ${safeSchool}`, content)
  })
}

/**
 * Veli/okul sipari\u015f sifresi yenilendiginde mudure haber veren mail.
 * Mudur bu yeni sifreyi velilere duyurmak zorunda.
 */
export async function sendSchoolPasswordRegenerated(data: {
  directorEmail: string
  directorName: string | null
  schoolName: string
  newPassword: string
}): Promise<EmailResult> {
  const safeName = escapeHtml(data.directorName || 'Say\u0131n Yetkili')
  const safeSchool = escapeHtml(data.schoolName)
  const safePwd = escapeHtml(data.newPassword)

  const content = `
    ${greeting(safeName)}
    ${paragraph(`<strong>${safeSchool}</strong> okulunun veli sipari\u015f \u015fifresi yenilenmi\u015ftir.`)}

    <div style="text-align: center; margin: 24px 0;">
      ${statusBadge('Veli \u015eifresi Yenilendi', COLORS.warning)}
    </div>

    ${passwordBox('Yeni Veli Sipari\u015f \u015eifresi', safePwd, COLORS.success)}

    ${paragraph('Bu yeni \u015fifreyi velilerinize duyurman\u0131z gerekmektedir. Eski \u015fifre art\u0131k ge\u00e7erli de\u011fildir.')}

    ${ctaButton('Sipari\u015f Sayfas\u0131', `${EMAIL_BASE_URL}/siparis`, COLORS.success)}
  `

  return sendEmailInternal({
    to: data.directorEmail,
    subject: `Veli \u015eifresi Yenilendi - ${safeSchool}`,
    html: wrapTemplate(`Veli \u015eifresi Yenileme - ${safeSchool}`, content)
  })
}
