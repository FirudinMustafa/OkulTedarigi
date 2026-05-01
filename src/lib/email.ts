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
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'


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
            <td style="background: linear-gradient(135deg, ${COLORS.bgDark} 0%, ${COLORS.primary} 100%); padding: 30px 40px; border-radius: 12px 12px 0 0; text-align: center;">
              <h1 style="color: #ffffff; margin: 0 0 6px; font-size: 24px; font-weight: 700; letter-spacing: 1px;">OKULTEDARIGIM.COM</h1>
              <p style="color: ${COLORS.textLight}; margin: 0; font-size: 13px; letter-spacing: 1px;">OKUL MALZEME TEDARIGINIZ BIZDEN</p>
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
}): Promise<EmailResult> {
  const safeParent = escapeHtml(data.parentName)
  const safeStudent = escapeHtml(data.studentName)
  const safeOrder = escapeHtml(data.orderNumber)
  const safePackage = escapeHtml(data.packageName)

  const content = `
    ${greeting(safeParent)}
    ${paragraph(`<strong>${safeStudent}</strong> i\u00e7in sipari\u015finiz ba\u015far\u0131yla olu\u015fturuldu.`)}

    <div style="text-align: center; margin: 24px 0;">
      ${statusBadge('Sipari\u015f Al\u0131nd\u0131', COLORS.primaryLight)}
    </div>

    ${infoTable(
      infoRow('Sipari\u015f No', safeOrder) +
      infoRow('\u00d6\u011frenci', safeStudent) +
      infoRow('Paket', safePackage) +
      infoRow('Toplam Tutar', `<span style="color: ${COLORS.primary}; font-size: 18px;">${data.totalAmount.toLocaleString('tr-TR')} TL</span>`)
    )}

    ${ctaButton('Sipari\u015fi Takip Et', `${APP_URL}/siparis-takip`)}

    ${paragraph('Sipari\u015finiz \u00f6deme a\u015famas\u0131na ge\u00e7irildi. \u00d6demenizi tamamlad\u0131\u011f\u0131n\u0131zda sipari\u015finiz haz\u0131rlanmaya ba\u015flayacakt\u0131r.')}
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

    ${ctaButton('Sipari\u015fi Takip Et', `${APP_URL}/siparis-takip`)}

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

    ${ctaButton('Siparişi Takip Et', `${APP_URL}/siparis-takip?orderNumber=${encodeURIComponent(data.orderNumber)}`)}

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

    ${ctaButton('Siparişi Takip Et', `${APP_URL}/siparis-takip?orderNumber=${encodeURIComponent(data.orderNumber)}`)}
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
