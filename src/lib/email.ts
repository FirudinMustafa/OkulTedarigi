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
// Localization
// ============================================================

export type EmailLocale = 'tr' | 'en' | 'de' | 'ar'

// Locale -> BCP47 tag for date/number formatting
const LOCALE_TAG: Record<EmailLocale, string> = {
  tr: 'tr-TR',
  en: 'en-US',
  de: 'de-DE',
  ar: 'ar',
}

function pickLocale(locale?: EmailLocale): EmailLocale {
  if (locale === 'en' || locale === 'de' || locale === 'ar') return locale
  return 'tr'
}

function isRtl(locale: EmailLocale): boolean {
  return locale === 'ar'
}

// Localized "Dear <name>," greeting
function greetingL(name: string, dear: string): string {
  return `<p style="color: ${COLORS.textDark}; font-size: 15px; line-height: 1.6; margin: 0 0 16px;">${dear} <strong>${name}</strong>,</p>`
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

// Wrapper-level translatable strings (header tagline, footer, copyright)
const WRAP_T: Record<EmailLocale, { tagline: string; footerLine1Html: string; footerLine2Html: string; rights: string }> = {
  tr: {
    tagline: 'Okul tedariğinizin tek adresi',
    footerLine1Html: 'Bu e-posta <strong>OkulTedarigim.com</strong> tarafından otomatik olarak gönderilmiştir.',
    footerLine2Html: 'Herhangi bir sorunuz varsa <a href="mailto:destek@okultedarigim.com" style="color: ${LINK}; text-decoration: none;">destek@okultedarigim.com</a> adresinden bize ulaşabilirsiniz.',
    rights: 'Tüm hakları saklıdır.',
  },
  en: {
    tagline: 'Your one-stop shop for school supplies',
    footerLine1Html: 'This email was sent automatically by <strong>OkulTedarigim.com</strong>.',
    footerLine2Html: 'If you have any questions, you can reach us at <a href="mailto:destek@okultedarigim.com" style="color: ${LINK}; text-decoration: none;">destek@okultedarigim.com</a>.',
    rights: 'All rights reserved.',
  },
  de: {
    tagline: 'Ihre zentrale Anlaufstelle für Schulbedarf',
    footerLine1Html: 'Diese E-Mail wurde automatisch von <strong>OkulTedarigim.com</strong> gesendet.',
    footerLine2Html: 'Bei Fragen erreichen Sie uns unter <a href="mailto:destek@okultedarigim.com" style="color: ${LINK}; text-decoration: none;">destek@okultedarigim.com</a>.',
    rights: 'Alle Rechte vorbehalten.',
  },
  ar: {
    tagline: 'وجهتكم الأولى لتجهيزات المدرسة',
    footerLine1Html: 'تم إرسال هذا البريد الإلكتروني تلقائيًا بواسطة <strong>OkulTedarigim.com</strong>.',
    footerLine2Html: 'إذا كان لديك أي استفسار، يمكنك التواصل معنا عبر <a href="mailto:destek@okultedarigim.com" style="color: ${LINK}; text-decoration: none;">destek@okultedarigim.com</a>.',
    rights: 'جميع الحقوق محفوظة.',
  },
}

function wrapTemplate(title: string, content: string, locale: EmailLocale = 'tr'): string {
  const rtl = isRtl(locale)
  const w = WRAP_T[locale] ?? WRAP_T.tr
  const dirAttr = rtl ? 'rtl' : 'ltr'
  const footerLine1 = w.footerLine1Html
  const footerLine2 = w.footerLine2Html.replace('${LINK}', COLORS.primaryLight)
  return `<!DOCTYPE html>
<html lang="${locale}" dir="${dirAttr}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: ${COLORS.bgLight}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: ${COLORS.bgLight};" dir="${dirAttr}">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width: 600px; width: 100%;" dir="${dirAttr}">

          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, ${COLORS.bgDark} 0%, ${COLORS.primary} 100%); padding: 32px 40px; border-radius: 12px 12px 0 0; text-align: center;">
              <a href="${EMAIL_BASE_URL}" style="text-decoration: none; display: inline-block;">
                <img src="${LOGO_URL}" alt="OkulTedariğim" width="180" height="auto" style="display: block; margin: 0 auto 12px; max-width: 180px; height: auto; border: 0;" />
              </a>
              <p style="color: ${COLORS.textLight}; margin: 0; font-size: 12px; letter-spacing: 1.5px; text-transform: uppercase;">${w.tagline}</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td dir="${dirAttr}" style="background-color: ${COLORS.bgCard}; padding: 40px; border-left: 1px solid ${COLORS.border}; border-right: 1px solid ${COLORS.border};${rtl ? ' direction: rtl; text-align: right;' : ''}">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td dir="${dirAttr}" style="background-color: ${COLORS.bgCard}; padding: 0 40px 20px; border-left: 1px solid ${COLORS.border}; border-right: 1px solid ${COLORS.border};${rtl ? ' direction: rtl; text-align: right;' : ''}">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="border-top: 1px solid ${COLORS.border}; padding-top: 20px;">
                    <p style="color: ${COLORS.textMuted}; font-size: 12px; line-height: 1.5; margin: 0;">
                      ${footerLine1}
                      <br>${footerLine2}
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
\u00a9 ${new Date().getFullYear()} OkulTedarigim.com - ${w.rights}
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
  locale?: EmailLocale
}): Promise<EmailResult> {
  const locale = pickLocale(data.locale)
  const tag = LOCALE_TAG[locale]
  const safeParent = escapeHtml(data.parentName)
  const safeStudent = escapeHtml(data.studentName)
  const safeOrder = escapeHtml(data.orderNumber)
  const safePackage = escapeHtml(data.packageName)

  const T = {
    tr: {
      subject: `\u2705 Sipari\u015f Al\u0131nd\u0131 - ${safeOrder}`,
      title: `Sipari\u015f Onay - ${safeOrder}`,
      dear: 'Say\u0131n',
      intro: `<strong>${safeStudent}</strong> i\u00e7in \u00f6demeniz ba\u015far\u0131yla al\u0131nd\u0131 ve sipari\u015finiz olu\u015fturuldu.`,
      badge: 'Sipari\u015f Al\u0131nd\u0131',
      orderNo: 'Sipari\u015f No',
      student: '\u00d6\u011frenci',
      pkg: 'Paket',
      total: 'Toplam Tutar',
      cta: 'Sipari\u015fi Takip Et',
      schoolNote: 'Sat\u0131n alaca\u011f\u0131n\u0131z e\u011fitim materyalleri, yeni e\u011fitim-\u00f6\u011fretim d\u00f6neminin ba\u015flamas\u0131yla birlikte s\u0131n\u0131f ortam\u0131nda \u00f6\u011frencilere elden teslim edilecektir.',
    },
    en: {
      subject: `\u2705 Order Received - ${safeOrder}`,
      title: `Order Confirmation - ${safeOrder}`,
      dear: 'Dear',
      intro: `Your payment for <strong>${safeStudent}</strong> was received successfully and your order has been created.`,
      badge: 'Order Received',
      orderNo: 'Order No',
      student: 'Student',
      pkg: 'Package',
      total: 'Total Amount',
      cta: 'Track Order',
      schoolNote: 'The educational materials you purchased will be handed to the students in the classroom at the start of the new academic year.',
    },
    de: {
      subject: `\u2705 Bestellung erhalten - ${safeOrder}`,
      title: `Bestellbest\u00e4tigung - ${safeOrder}`,
      dear: 'Sehr geehrte/r',
      intro: `Ihre Zahlung f\u00fcr <strong>${safeStudent}</strong> ist erfolgreich eingegangen und Ihre Bestellung wurde erstellt.`,
      badge: 'Bestellung erhalten',
      orderNo: 'Bestellnr.',
      student: 'Sch\u00fcler/in',
      pkg: 'Paket',
      total: 'Gesamtbetrag',
      cta: 'Bestellung verfolgen',
      schoolNote: 'Die von Ihnen gekauften Lernmaterialien werden den Sch\u00fclern zu Beginn des neuen Schuljahres im Klassenzimmer pers\u00f6nlich ausgeh\u00e4ndigt.',
    },
    ar: {
      subject: `\u2705 \u062a\u0645 \u0627\u0633\u062a\u0644\u0627\u0645 \u0627\u0644\u0637\u0644\u0628 - ${safeOrder}`,
      title: `\u062a\u0623\u0643\u064a\u062f \u0627\u0644\u0637\u0644\u0628 - ${safeOrder}`,
      dear: '\u0639\u0632\u064a\u0632\u064a/\u0639\u0632\u064a\u0632\u062a\u064a',
      intro: `\u062a\u0645 \u0627\u0633\u062a\u0644\u0627\u0645 \u062f\u0641\u0639\u062a\u0643 \u0627\u0644\u062e\u0627\u0635\u0629 \u0628\u0640 <strong>${safeStudent}</strong> \u0628\u0646\u062c\u0627\u062d \u0648\u062a\u0645 \u0625\u0646\u0634\u0627\u0621 \u0637\u0644\u0628\u0643.`,
      badge: '\u062a\u0645 \u0627\u0633\u062a\u0644\u0627\u0645 \u0627\u0644\u0637\u0644\u0628',
      orderNo: '\u0631\u0642\u0645 \u0627\u0644\u0637\u0644\u0628',
      student: '\u0627\u0644\u0637\u0627\u0644\u0628',
      pkg: '\u0627\u0644\u0628\u0627\u0642\u0629',
      total: '\u0627\u0644\u0645\u0628\u0644\u063a \u0627\u0644\u0625\u062c\u0645\u0627\u0644\u064a',
      cta: '\u062a\u062a\u0628\u0651\u0639 \u0627\u0644\u0637\u0644\u0628',
      schoolNote: '\u0633\u064a\u062a\u0645 \u062a\u0633\u0644\u064a\u0645 \u0627\u0644\u0645\u0648\u0627\u062f \u0627\u0644\u062a\u0639\u0644\u064a\u0645\u064a\u0629 \u0627\u0644\u062a\u064a \u0627\u0634\u062a\u0631\u064a\u062a\u0647\u0627 \u0625\u0644\u0649 \u0627\u0644\u0637\u0644\u0627\u0628 \u062f\u0627\u062e\u0644 \u0627\u0644\u0635\u0641 \u0645\u0639 \u0628\u062f\u0627\u064a\u0629 \u0627\u0644\u0639\u0627\u0645 \u0627\u0644\u062f\u0631\u0627\u0633\u064a \u0627\u0644\u062c\u062f\u064a\u062f.',
    },
  }
  const tr = T[locale] ?? T.tr

  const schoolDeliveryNote = data.isSchoolDelivery ? paragraph(tr.schoolNote) : ''

  const content = `
    ${greetingL(safeParent, tr.dear)}
    ${paragraph(tr.intro)}

    <div style="text-align: center; margin: 24px 0;">
      ${statusBadge(tr.badge, COLORS.primaryLight)}
    </div>

    ${infoTable(
      infoRow(tr.orderNo, safeOrder) +
      infoRow(tr.student, safeStudent) +
      infoRow(tr.pkg, safePackage) +
      infoRow(tr.total, `<span style="color: ${COLORS.primary}; font-size: 18px;">${data.totalAmount.toLocaleString(tag)} TL</span>`)
    )}

    ${ctaButton(tr.cta, `${EMAIL_BASE_URL}/siparis-takip`)}

    ${schoolDeliveryNote}
  `

  return sendEmailInternal({
    to: data.email,
    subject: tr.subject,
    html: wrapTemplate(tr.title, content, locale)
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
  locale?: EmailLocale
}): Promise<EmailResult> {
  const locale = pickLocale(data.locale)
  const tag = LOCALE_TAG[locale]
  const safeParent = escapeHtml(data.parentName)
  const safeOrder = escapeHtml(data.orderNumber)

  const T = {
    tr: {
      subject: `\u2705 \u00d6deme Onayland\u0131 - ${safeOrder}`,
      title: `\u00d6deme Onay - ${safeOrder}`,
      dear: 'Say\u0131n',
      intro: `<strong>${safeOrder}</strong> numaral\u0131 sipari\u015finiz i\u00e7in \u00f6demeniz ba\u015far\u0131yla al\u0131nd\u0131.`,
      badge: '\u00d6deme Al\u0131nd\u0131',
      orderNo: 'Sipari\u015f No',
      paid: '\u00d6denen Tutar',
      date: '\u00d6deme Tarihi',
      cta: 'Sipari\u015fi Takip Et',
      note: 'Sipari\u015finiz en k\u0131sa s\u00fcrede haz\u0131rlanarak kargoya verilecektir. Kargo bilgileri ayr\u0131ca taraf\u0131n\u0131za iletilecektir.',
    },
    en: {
      subject: `\u2705 Payment Confirmed - ${safeOrder}`,
      title: `Payment Confirmation - ${safeOrder}`,
      dear: 'Dear',
      intro: `Your payment for order <strong>${safeOrder}</strong> was received successfully.`,
      badge: 'Payment Received',
      orderNo: 'Order No',
      paid: 'Amount Paid',
      date: 'Payment Date',
      cta: 'Track Order',
      note: 'Your order will be prepared and shipped as soon as possible. Shipping details will be sent to you separately.',
    },
    de: {
      subject: `\u2705 Zahlung best\u00e4tigt - ${safeOrder}`,
      title: `Zahlungsbest\u00e4tigung - ${safeOrder}`,
      dear: 'Sehr geehrte/r',
      intro: `Ihre Zahlung f\u00fcr die Bestellung <strong>${safeOrder}</strong> ist erfolgreich eingegangen.`,
      badge: 'Zahlung erhalten',
      orderNo: 'Bestellnr.',
      paid: 'Gezahlter Betrag',
      date: 'Zahlungsdatum',
      cta: 'Bestellung verfolgen',
      note: 'Ihre Bestellung wird schnellstm\u00f6glich vorbereitet und versandt. Die Versanddetails werden Ihnen separat mitgeteilt.',
    },
    ar: {
      subject: `\u2705 \u062a\u0645 \u062a\u0623\u0643\u064a\u062f \u0627\u0644\u062f\u0641\u0639 - ${safeOrder}`,
      title: `\u062a\u0623\u0643\u064a\u062f \u0627\u0644\u062f\u0641\u0639 - ${safeOrder}`,
      dear: '\u0639\u0632\u064a\u0632\u064a/\u0639\u0632\u064a\u0632\u062a\u064a',
      intro: `\u062a\u0645 \u0627\u0633\u062a\u0644\u0627\u0645 \u062f\u0641\u0639\u062a\u0643 \u0644\u0644\u0637\u0644\u0628 \u0631\u0642\u0645 <strong>${safeOrder}</strong> \u0628\u0646\u062c\u0627\u062d.`,
      badge: '\u062a\u0645 \u0627\u0633\u062a\u0644\u0627\u0645 \u0627\u0644\u062f\u0641\u0639',
      orderNo: '\u0631\u0642\u0645 \u0627\u0644\u0637\u0644\u0628',
      paid: '\u0627\u0644\u0645\u0628\u0644\u063a \u0627\u0644\u0645\u062f\u0641\u0648\u0639',
      date: '\u062a\u0627\u0631\u064a\u062e \u0627\u0644\u062f\u0641\u0639',
      cta: '\u062a\u062a\u0628\u0651\u0639 \u0627\u0644\u0637\u0644\u0628',
      note: '\u0633\u064a\u062a\u0645 \u062a\u062c\u0647\u064a\u0632 \u0637\u0644\u0628\u0643 \u0648\u0634\u062d\u0646\u0647 \u0641\u064a \u0623\u0642\u0631\u0628 \u0648\u0642\u062a \u0645\u0645\u0643\u0646. \u0648\u0633\u064a\u062a\u0645 \u0625\u0631\u0633\u0627\u0644 \u062a\u0641\u0627\u0635\u064a\u0644 \u0627\u0644\u0634\u062d\u0646 \u0625\u0644\u064a\u0643 \u0628\u0634\u0643\u0644 \u0645\u0646\u0641\u0635\u0644.',
    },
  }
  const tr = T[locale] ?? T.tr

  const content = `
    ${greetingL(safeParent, tr.dear)}
    ${paragraph(tr.intro)}

    <div style="text-align: center; margin: 24px 0;">
      ${statusBadge(tr.badge, COLORS.success)}
    </div>

    ${infoTable(
      infoRow(tr.orderNo, safeOrder) +
      infoRow(tr.paid, `<span style="color: ${COLORS.success}; font-size: 18px;">${data.totalAmount.toLocaleString(tag)} TL</span>`) +
      infoRow(tr.date, new Date().toLocaleDateString(tag, { day: 'numeric', month: 'long', year: 'numeric' }))
    )}

    ${ctaButton(tr.cta, `${EMAIL_BASE_URL}/siparis-takip`)}

    ${paragraph(tr.note)}
  `

  return sendEmailInternal({
    to: data.email,
    subject: tr.subject,
    html: wrapTemplate(tr.title, content, locale)
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
  locale?: EmailLocale
}): Promise<EmailResult> {
  const locale = pickLocale(data.locale)
  const safeParent = escapeHtml(data.parentName)
  const safeOrder = escapeHtml(data.orderNumber)
  const safeTracking = escapeHtml(data.trackingNo)
  const safeTrackingUrl = encodeURI(data.trackingUrl)

  const T = {
    tr: {
      subject: `\ud83d\ude9a Kargonuz Yola \u00c7\u0131kt\u0131 - ${safeOrder}`,
      title: `Kargo Bildirim - ${safeOrder}`,
      dear: 'Say\u0131n',
      intro: `<strong>${safeOrder}</strong> numaral\u0131 sipari\u015finiz kargoya verildi!`,
      badge: 'Kargo Yolda',
      orderNo: 'Sipari\u015f No',
      tracking: 'Kargo Takip No',
      carrier: 'Kargo Firmas\u0131',
      cta: 'Kargoyu Takip Et',
      note: 'Kargonuz tahmini 2-4 i\u015f g\u00fcn\u00fc i\u00e7inde teslim edilecektir.',
    },
    en: {
      subject: `\ud83d\ude9a Your Order Has Shipped - ${safeOrder}`,
      title: `Shipping Notification - ${safeOrder}`,
      dear: 'Dear',
      intro: `Your order <strong>${safeOrder}</strong> has been shipped!`,
      badge: 'In Transit',
      orderNo: 'Order No',
      tracking: 'Tracking No',
      carrier: 'Carrier',
      cta: 'Track Shipment',
      note: 'Your package is expected to be delivered within 2-4 business days.',
    },
    de: {
      subject: `\ud83d\ude9a Ihre Bestellung wurde versandt - ${safeOrder}`,
      title: `Versandbenachrichtigung - ${safeOrder}`,
      dear: 'Sehr geehrte/r',
      intro: `Ihre Bestellung <strong>${safeOrder}</strong> wurde versandt!`,
      badge: 'Unterwegs',
      orderNo: 'Bestellnr.',
      tracking: 'Sendungsnummer',
      carrier: 'Versanddienst',
      cta: 'Sendung verfolgen',
      note: 'Ihr Paket wird voraussichtlich innerhalb von 2-4 Werktagen zugestellt.',
    },
    ar: {
      subject: `\ud83d\ude9a \u062a\u0645 \u0634\u062d\u0646 \u0637\u0644\u0628\u0643 - ${safeOrder}`,
      title: `\u0625\u0634\u0639\u0627\u0631 \u0627\u0644\u0634\u062d\u0646 - ${safeOrder}`,
      dear: '\u0639\u0632\u064a\u0632\u064a/\u0639\u0632\u064a\u0632\u062a\u064a',
      intro: `\u062a\u0645 \u0634\u062d\u0646 \u0637\u0644\u0628\u0643 \u0631\u0642\u0645 <strong>${safeOrder}</strong>!`,
      badge: '\u0642\u064a\u062f \u0627\u0644\u062a\u0648\u0635\u064a\u0644',
      orderNo: '\u0631\u0642\u0645 \u0627\u0644\u0637\u0644\u0628',
      tracking: '\u0631\u0642\u0645 \u062a\u062a\u0628\u0651\u0639 \u0627\u0644\u0634\u062d\u0646\u0629',
      carrier: '\u0634\u0631\u0643\u0629 \u0627\u0644\u0634\u062d\u0646',
      cta: '\u062a\u062a\u0628\u0651\u0639 \u0627\u0644\u0634\u062d\u0646\u0629',
      note: '\u0645\u0646 \u0627\u0644\u0645\u062a\u0648\u0642\u0639 \u062a\u0633\u0644\u064a\u0645 \u0637\u0631\u062f\u0643 \u062e\u0644\u0627\u0644 2-4 \u0623\u064a\u0627\u0645 \u0639\u0645\u0644.',
    },
  }
  const tr = T[locale] ?? T.tr

  const content = `
    ${greetingL(safeParent, tr.dear)}
    ${paragraph(tr.intro)}

    <div style="text-align: center; margin: 24px 0;">
      ${statusBadge(tr.badge, COLORS.purple)}
    </div>

    ${infoTable(
      infoRow(tr.orderNo, safeOrder) +
      infoRow(tr.tracking, `<span style="font-family: 'Courier New', monospace; font-size: 16px; background: ${COLORS.bgLight}; padding: 4px 8px; border-radius: 4px; letter-spacing: 1px;">${safeTracking}</span>`) +
      infoRow(tr.carrier, 'Yurtiçi Kargo')
    )}

    ${ctaButton(tr.cta, safeTrackingUrl, COLORS.purple)}

    ${paragraph(tr.note)}
  `

  return sendEmailInternal({
    to: data.email,
    subject: tr.subject,
    html: wrapTemplate(tr.title, content, locale)
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
  locale?: EmailLocale
}): Promise<EmailResult> {
  const locale = pickLocale(data.locale)
  const safeParent = escapeHtml(data.parentName)
  const safeOrder = escapeHtml(data.orderNumber)
  const safeDate = escapeHtml(data.deliveryDate)

  const T = {
    tr: {
      subject: `\u2705 Sipari\u015finiz Teslim Edildi - ${safeOrder}`,
      title: `Teslim Bildirim - ${safeOrder}`,
      dear: 'Say\u0131n',
      intro: `<strong>${safeOrder}</strong> numaral\u0131 sipari\u015finiz ba\u015far\u0131yla teslim edildi!`,
      badge: 'Teslim Edildi',
      orderNo: 'Sipari\u015f No',
      deliveryDate: 'Teslim Tarihi',
      status: 'Durum',
      completed: 'Tamamland\u0131',
      thanks: 'Bizi tercih etti\u011finiz i\u00e7in \u00e7ok te\u015fekk\u00fcr ederiz! Herhangi bir sorunuz veya \u00f6neriniz varsa bizimle ileti\u015fime ge\u00e7mekten \u00e7ekinmeyin.',
      satisfiedTitle: 'Memnun kald\u0131n\u0131z m\u0131?',
      satisfiedText: 'Bizi arkada\u015flar\u0131n\u0131za \u00f6nerin!',
    },
    en: {
      subject: `\u2705 Your Order Has Been Delivered - ${safeOrder}`,
      title: `Delivery Notification - ${safeOrder}`,
      dear: 'Dear',
      intro: `Your order <strong>${safeOrder}</strong> has been delivered successfully!`,
      badge: 'Delivered',
      orderNo: 'Order No',
      deliveryDate: 'Delivery Date',
      status: 'Status',
      completed: 'Completed',
      thanks: 'Thank you very much for choosing us! If you have any questions or suggestions, please do not hesitate to contact us.',
      satisfiedTitle: 'Are you satisfied?',
      satisfiedText: 'Recommend us to your friends!',
    },
    de: {
      subject: `\u2705 Ihre Bestellung wurde geliefert - ${safeOrder}`,
      title: `Lieferbenachrichtigung - ${safeOrder}`,
      dear: 'Sehr geehrte/r',
      intro: `Ihre Bestellung <strong>${safeOrder}</strong> wurde erfolgreich geliefert!`,
      badge: 'Geliefert',
      orderNo: 'Bestellnr.',
      deliveryDate: 'Lieferdatum',
      status: 'Status',
      completed: 'Abgeschlossen',
      thanks: 'Vielen Dank, dass Sie sich f\u00fcr uns entschieden haben! Bei Fragen oder Anregungen k\u00f6nnen Sie uns jederzeit kontaktieren.',
      satisfiedTitle: 'Sind Sie zufrieden?',
      satisfiedText: 'Empfehlen Sie uns Ihren Freunden weiter!',
    },
    ar: {
      subject: `\u2705 \u062a\u0645 \u062a\u0633\u0644\u064a\u0645 \u0637\u0644\u0628\u0643 - ${safeOrder}`,
      title: `\u0625\u0634\u0639\u0627\u0631 \u0627\u0644\u062a\u0633\u0644\u064a\u0645 - ${safeOrder}`,
      dear: '\u0639\u0632\u064a\u0632\u064a/\u0639\u0632\u064a\u0632\u062a\u064a',
      intro: `\u062a\u0645 \u062a\u0633\u0644\u064a\u0645 \u0637\u0644\u0628\u0643 \u0631\u0642\u0645 <strong>${safeOrder}</strong> \u0628\u0646\u062c\u0627\u062d!`,
      badge: '\u062a\u0645 \u0627\u0644\u062a\u0633\u0644\u064a\u0645',
      orderNo: '\u0631\u0642\u0645 \u0627\u0644\u0637\u0644\u0628',
      deliveryDate: '\u062a\u0627\u0631\u064a\u062e \u0627\u0644\u062a\u0633\u0644\u064a\u0645',
      status: '\u0627\u0644\u062d\u0627\u0644\u0629',
      completed: '\u0645\u0643\u062a\u0645\u0644',
      thanks: '\u0646\u0634\u0643\u0631\u0643 \u062c\u0632\u064a\u0644 \u0627\u0644\u0634\u0643\u0631 \u0644\u0627\u062e\u062a\u064a\u0627\u0631\u0643 \u0625\u064a\u0627\u0646\u0627! \u0625\u0630\u0627 \u0643\u0627\u0646 \u0644\u062f\u064a\u0643 \u0623\u064a \u0627\u0633\u062a\u0641\u0633\u0627\u0631 \u0623\u0648 \u0627\u0642\u062a\u0631\u0627\u062d\u060c \u0641\u0644\u0627 \u062a\u062a\u0631\u062f\u062f \u0641\u064a \u0627\u0644\u062a\u0648\u0627\u0635\u0644 \u0645\u0639\u0646\u0627.',
      satisfiedTitle: '\u0647\u0644 \u0623\u0646\u062a \u0631\u0627\u0636\u064d\u061f',
      satisfiedText: '\u0623\u0648\u0635\u0650 \u0628\u0646\u0627 \u0644\u0623\u0635\u062f\u0642\u0627\u0626\u0643!',
    },
  }
  const tr = T[locale] ?? T.tr

  const content = `
    ${greetingL(safeParent, tr.dear)}
    ${paragraph(tr.intro)}

    <div style="text-align: center; margin: 24px 0;">
      ${statusBadge(tr.badge, COLORS.success)}
    </div>

    ${infoTable(
      infoRow(tr.orderNo, safeOrder) +
      infoRow(tr.deliveryDate, safeDate) +
      infoRow(tr.status, `<span style="color: ${COLORS.success};">${tr.completed}</span>`)
    )}

    ${paragraph(tr.thanks)}

    <div style="background: linear-gradient(135deg, ${COLORS.bgLight} 0%, #e0e7ff 100%); border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
      <p style="color: ${COLORS.textDark}; font-size: 14px; margin: 0 0 4px; font-weight: 600;">${tr.satisfiedTitle}</p>
      <p style="color: ${COLORS.textMuted}; font-size: 13px; margin: 0;">${tr.satisfiedText}</p>
    </div>
  `

  return sendEmailInternal({
    to: data.email,
    subject: tr.subject,
    html: wrapTemplate(tr.title, content, locale)
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
  locale?: EmailLocale
}): Promise<EmailResult> {
  const locale = pickLocale(data.locale)
  const tag = LOCALE_TAG[locale]
  const safeParent = escapeHtml(data.parentName)
  const safeOrder = escapeHtml(data.orderNumber)
  const safeInvoice = escapeHtml(data.invoiceNo)

  const T = {
    tr: {
      subject: `🧾 Faturanız Kesildi - ${safeOrder}`,
      title: `Fatura Bildirim - ${safeOrder}`,
      dear: 'Sayın',
      intro: `<strong>${safeOrder}</strong> numaralı siparişiniz için faturanız kesildi.`,
      badge: 'Fatura Kesildi',
      orderNo: 'Sipariş No',
      invoiceNo: 'Fatura No',
      amount: 'Tutar',
      date: 'Tarih',
      cta: 'Siparişi Takip Et',
      note: 'Faturanızın elektronik (e-Arşiv / e-Fatura) kopyası kayıt altına alınmıştır. Siparişinize ait detayları sipariş takip sayfasından görebilirsiniz.',
    },
    en: {
      subject: `🧾 Your Invoice Has Been Issued - ${safeOrder}`,
      title: `Invoice Notification - ${safeOrder}`,
      dear: 'Dear',
      intro: `An invoice has been issued for your order <strong>${safeOrder}</strong>.`,
      badge: 'Invoice Issued',
      orderNo: 'Order No',
      invoiceNo: 'Invoice No',
      amount: 'Amount',
      date: 'Date',
      cta: 'Track Order',
      note: 'An electronic (e-Archive / e-Invoice) copy of your invoice has been recorded. You can view your order details on the order tracking page.',
    },
    de: {
      subject: `🧾 Ihre Rechnung wurde ausgestellt - ${safeOrder}`,
      title: `Rechnungsbenachrichtigung - ${safeOrder}`,
      dear: 'Sehr geehrte/r',
      intro: `Für Ihre Bestellung <strong>${safeOrder}</strong> wurde eine Rechnung ausgestellt.`,
      badge: 'Rechnung ausgestellt',
      orderNo: 'Bestellnr.',
      invoiceNo: 'Rechnungsnr.',
      amount: 'Betrag',
      date: 'Datum',
      cta: 'Bestellung verfolgen',
      note: 'Eine elektronische Kopie Ihrer Rechnung (e-Archiv / e-Rechnung) wurde erfasst. Die Details Ihrer Bestellung finden Sie auf der Bestellverfolgungsseite.',
    },
    ar: {
      subject: `🧾 تم إصدار فاتورتك - ${safeOrder}`,
      title: `إشعار الفاتورة - ${safeOrder}`,
      dear: 'عزيزي/عزيزتي',
      intro: `تم إصدار فاتورة لطلبك رقم <strong>${safeOrder}</strong>.`,
      badge: 'تم إصدار الفاتورة',
      orderNo: 'رقم الطلب',
      invoiceNo: 'رقم الفاتورة',
      amount: 'المبلغ',
      date: 'التاريخ',
      cta: 'تتبّع الطلب',
      note: 'تم حفظ نسخة إلكترونية من فاتورتك (e-Arşiv / e-Fatura). يمكنك الاطلاع على تفاصيل طلبك من صفحة تتبّع الطلب.',
    },
  }
  const tr = T[locale] ?? T.tr

  const content = `
    ${greetingL(safeParent, tr.dear)}
    ${paragraph(tr.intro)}

    <div style="text-align: center; margin: 24px 0;">
      ${statusBadge(tr.badge, COLORS.purple)}
    </div>

    ${infoTable(
      infoRow(tr.orderNo, safeOrder) +
      infoRow(tr.invoiceNo, `<span style="font-family: 'Courier New', monospace; font-size: 16px; background: ${COLORS.bgLight}; padding: 4px 8px; border-radius: 4px; letter-spacing: 0.5px;">${safeInvoice}</span>`) +
      infoRow(tr.amount, `<span style="color: ${COLORS.primary}; font-size: 18px;">${data.totalAmount.toLocaleString(tag)} TL</span>`) +
      infoRow(tr.date, new Date().toLocaleDateString(tag, { day: 'numeric', month: 'long', year: 'numeric' }))
    )}

    ${ctaButton(tr.cta, `${EMAIL_BASE_URL}/siparis-takip?orderNumber=${encodeURIComponent(data.orderNumber)}`)}

    ${paragraph(tr.note)}
  `

  return sendEmailInternal({
    to: data.email,
    subject: tr.subject,
    html: wrapTemplate(tr.title, content, locale)
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
  locale?: EmailLocale
}): Promise<EmailResult> {
  const locale = pickLocale(data.locale)
  const tag = LOCALE_TAG[locale]
  const safeParent = escapeHtml(data.parentName)
  const safeOrder = escapeHtml(data.orderNumber)
  const safeInvoice = escapeHtml(data.invoiceNo)

  const T = {
    tr: {
      subject: `🧾 Fatura İptal Edildi - ${safeOrder}`,
      title: `Fatura İptal - ${safeOrder}`,
      dear: 'Sayın',
      intro: `<strong>${safeOrder}</strong> numaralı siparişiniz için kesilen fatura iptal edilmiştir.`,
      badge: 'Fatura İptal Edildi',
      orderNo: 'Sipariş No',
      cancelledInvoice: 'İptal Edilen Fatura No',
      cancelDate: 'İptal Tarihi',
      note: 'Eğer siparişiniz hâlâ aktif ise yeni bir fatura kesim sürecine alınacaktır. Sorularınız için bize ulaşabilirsiniz.',
      cta: 'Siparişi Takip Et',
    },
    en: {
      subject: `🧾 Invoice Cancelled - ${safeOrder}`,
      title: `Invoice Cancellation - ${safeOrder}`,
      dear: 'Dear',
      intro: `The invoice issued for your order <strong>${safeOrder}</strong> has been cancelled.`,
      badge: 'Invoice Cancelled',
      orderNo: 'Order No',
      cancelledInvoice: 'Cancelled Invoice No',
      cancelDate: 'Cancellation Date',
      note: 'If your order is still active, a new invoice will be issued. Please contact us if you have any questions.',
      cta: 'Track Order',
    },
    de: {
      subject: `🧾 Rechnung storniert - ${safeOrder}`,
      title: `Rechnungsstornierung - ${safeOrder}`,
      dear: 'Sehr geehrte/r',
      intro: `Die für Ihre Bestellung <strong>${safeOrder}</strong> ausgestellte Rechnung wurde storniert.`,
      badge: 'Rechnung storniert',
      orderNo: 'Bestellnr.',
      cancelledInvoice: 'Stornierte Rechnungsnr.',
      cancelDate: 'Stornierungsdatum',
      note: 'Sofern Ihre Bestellung weiterhin aktiv ist, wird eine neue Rechnung ausgestellt. Bei Fragen können Sie uns gerne kontaktieren.',
      cta: 'Bestellung verfolgen',
    },
    ar: {
      subject: `🧾 تم إلغاء الفاتورة - ${safeOrder}`,
      title: `إلغاء الفاتورة - ${safeOrder}`,
      dear: 'عزيزي/عزيزتي',
      intro: `تم إلغاء الفاتورة الصادرة لطلبك رقم <strong>${safeOrder}</strong>.`,
      badge: 'تم إلغاء الفاتورة',
      orderNo: 'رقم الطلب',
      cancelledInvoice: 'رقم الفاتورة الملغاة',
      cancelDate: 'تاريخ الإلغاء',
      note: 'إذا كان طلبك لا يزال نشطًا، فسيتم إصدار فاتورة جديدة. يمكنك التواصل معنا لأي استفسار.',
      cta: 'تتبّع الطلب',
    },
  }
  const tr = T[locale] ?? T.tr

  const content = `
    ${greetingL(safeParent, tr.dear)}
    ${paragraph(tr.intro)}

    <div style="text-align: center; margin: 24px 0;">
      ${statusBadge(tr.badge, COLORS.warning)}
    </div>

    ${infoTable(
      infoRow(tr.orderNo, safeOrder) +
      infoRow(tr.cancelledInvoice, `<span style="font-family: 'Courier New', monospace; font-size: 16px; background: ${COLORS.bgLight}; padding: 4px 8px; border-radius: 4px; letter-spacing: 0.5px; text-decoration: line-through;">${safeInvoice}</span>`) +
      infoRow(tr.cancelDate, new Date().toLocaleDateString(tag, { day: 'numeric', month: 'long', year: 'numeric' }))
    )}

    ${paragraph(tr.note)}

    ${ctaButton(tr.cta, `${EMAIL_BASE_URL}/siparis-takip?orderNumber=${encodeURIComponent(data.orderNumber)}`)}
  `

  return sendEmailInternal({
    to: data.email,
    subject: tr.subject,
    html: wrapTemplate(tr.title, content, locale)
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
  locale?: EmailLocale
}): Promise<EmailResult> {
  const locale = pickLocale(data.locale)
  const tag = LOCALE_TAG[locale]
  const safeParent = escapeHtml(data.parentName)
  const safeOrder = escapeHtml(data.orderNumber)
  const safeOrderData = escapeHtml(data.orderNumber)

  const refundFmt = data.refundAmount ? data.refundAmount.toLocaleString(tag) : ''

  const T = {
    tr: {
      subject: `\u274c Sipari\u015f \u0130ptal Edildi - ${safeOrder}`,
      title: `Sipari\u015f \u0130ptal - ${safeOrder}`,
      dear: 'Say\u0131n',
      intro: `<strong>${safeOrder}</strong> numaral\u0131 sipari\u015finiz iptal edilmi\u015ftir.`,
      badge: '\u0130ptal Edildi',
      orderNo: 'Sipari\u015f No',
      cancelDate: '\u0130ptal Tarihi',
      refundLabel: '\u0130ade Tutar\u0131',
      refundNote: `\u0130ade tutar\u0131 olan <strong>${refundFmt} TL</strong>, \u00f6deme yapt\u0131\u011f\u0131n\u0131z y\u00f6ntemle 3-5 i\u015f g\u00fcn\u00fc i\u00e7inde hesab\u0131n\u0131za yans\u0131yacakt\u0131r.`,
      closing: 'Herhangi bir sorunuz i\u00e7in bizimle ileti\u015fime ge\u00e7ebilirsiniz. Sizi tekrar g\u00f6rmekten mutluluk duyar\u0131z.',
    },
    en: {
      subject: `\u274c Order Cancelled - ${safeOrder}`,
      title: `Order Cancellation - ${safeOrder}`,
      dear: 'Dear',
      intro: `Your order <strong>${safeOrder}</strong> has been cancelled.`,
      badge: 'Cancelled',
      orderNo: 'Order No',
      cancelDate: 'Cancellation Date',
      refundLabel: 'Refund Amount',
      refundNote: `The refund amount of <strong>${refundFmt} TL</strong> will be credited to your account via your original payment method within 3-5 business days.`,
      closing: 'You can contact us if you have any questions. We would be happy to see you again.',
    },
    de: {
      subject: `\u274c Bestellung storniert - ${safeOrder}`,
      title: `Bestellstornierung - ${safeOrder}`,
      dear: 'Sehr geehrte/r',
      intro: `Ihre Bestellung <strong>${safeOrder}</strong> wurde storniert.`,
      badge: 'Storniert',
      orderNo: 'Bestellnr.',
      cancelDate: 'Stornierungsdatum',
      refundLabel: 'Erstattungsbetrag',
      refundNote: `Der Erstattungsbetrag von <strong>${refundFmt} TL</strong> wird innerhalb von 3-5 Werktagen \u00fcber Ihre urspr\u00fcngliche Zahlungsmethode auf Ihr Konto gutgeschrieben.`,
      closing: 'Bei Fragen k\u00f6nnen Sie uns gerne kontaktieren. Wir w\u00fcrden uns freuen, Sie wiederzusehen.',
    },
    ar: {
      subject: `\u274c \u062a\u0645 \u0625\u0644\u063a\u0627\u0621 \u0627\u0644\u0637\u0644\u0628 - ${safeOrder}`,
      title: `\u0625\u0644\u063a\u0627\u0621 \u0627\u0644\u0637\u0644\u0628 - ${safeOrder}`,
      dear: '\u0639\u0632\u064a\u0632\u064a/\u0639\u0632\u064a\u0632\u062a\u064a',
      intro: `\u062a\u0645 \u0625\u0644\u063a\u0627\u0621 \u0637\u0644\u0628\u0643 \u0631\u0642\u0645 <strong>${safeOrder}</strong>.`,
      badge: '\u062a\u0645 \u0627\u0644\u0625\u0644\u063a\u0627\u0621',
      orderNo: '\u0631\u0642\u0645 \u0627\u0644\u0637\u0644\u0628',
      cancelDate: '\u062a\u0627\u0631\u064a\u062e \u0627\u0644\u0625\u0644\u063a\u0627\u0621',
      refundLabel: '\u0645\u0628\u0644\u063a \u0627\u0644\u0627\u0633\u062a\u0631\u062f\u0627\u062f',
      refundNote: `\u0633\u064a\u064f\u0639\u0627\u062f \u0645\u0628\u0644\u063a \u0627\u0644\u0627\u0633\u062a\u0631\u062f\u0627\u062f \u0627\u0644\u0628\u0627\u0644\u063a <strong>${refundFmt} TL</strong> \u0625\u0644\u0649 \u062d\u0633\u0627\u0628\u0643 \u0639\u0628\u0631 \u0637\u0631\u064a\u0642\u0629 \u0627\u0644\u062f\u0641\u0639 \u0646\u0641\u0633\u0647\u0627 \u062e\u0644\u0627\u0644 3-5 \u0623\u064a\u0627\u0645 \u0639\u0645\u0644.`,
      closing: '\u064a\u0645\u0643\u0646\u0643 \u0627\u0644\u062a\u0648\u0627\u0635\u0644 \u0645\u0639\u0646\u0627 \u0644\u0623\u064a \u0627\u0633\u062a\u0641\u0633\u0627\u0631. \u0648\u064a\u0633\u0639\u062f\u0646\u0627 \u0623\u0646 \u0646\u0631\u0627\u0643 \u0645\u0631\u0629 \u0623\u062e\u0631\u0649.',
    },
  }
  const tr = T[locale] ?? T.tr

  const refundRow = data.refundAmount
    ? infoRow(tr.refundLabel, `<span style="color: ${COLORS.danger}; font-size: 18px;">${refundFmt} TL</span>`)
    : ''

  const refundNote = data.refundAmount ? paragraph(tr.refundNote) : ''

  const content = `
    ${greetingL(safeParent, tr.dear)}
    ${paragraph(tr.intro)}

    <div style="text-align: center; margin: 24px 0;">
      ${statusBadge(tr.badge, COLORS.danger)}
    </div>

    ${infoTable(
      infoRow(tr.orderNo, safeOrderData) +
      infoRow(tr.cancelDate, new Date().toLocaleDateString(tag, { day: 'numeric', month: 'long', year: 'numeric' })) +
      refundRow
    )}

    ${refundNote}
    ${paragraph(tr.closing)}
  `

  return sendEmailInternal({
    to: data.email,
    subject: tr.subject,
    html: wrapTemplate(tr.title, content, locale)
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
  locale?: EmailLocale
}): Promise<EmailResult> {
  const locale = pickLocale(data.locale)
  const safeParent = escapeHtml(data.parentName)
  const safeOrder = escapeHtml(data.orderNumber)
  const safeReason = escapeHtml(data.reason)

  const T = {
    tr: {
      subject: `\u0130ptal Talebiniz Reddedildi - ${safeOrder}`,
      title: `\u0130ptal Talebi Reddedildi - ${safeOrder}`,
      dear: 'Say\u0131n',
      intro: `<strong>${safeOrder}</strong> numaral\u0131 sipari\u015finize ait iptal talebiniz de\u011ferlendirildi ve <strong>reddedilmi\u015ftir</strong>.`,
      badge: 'Talep Reddedildi',
      reasonLabel: 'Reddedilme Nedeni',
      note: 'Sipari\u015finiz i\u015flemine kald\u0131\u011f\u0131 yerden devam edecektir. E\u011fer bu konuda farkl\u0131 bir sorunuz varsa bizimle ileti\u015fime ge\u00e7ebilirsiniz.',
      cta: 'Sipari\u015fi G\u00f6r\u00fcnt\u00fcle',
    },
    en: {
      subject: `Your Cancellation Request Was Rejected - ${safeOrder}`,
      title: `Cancellation Request Rejected - ${safeOrder}`,
      dear: 'Dear',
      intro: `Your cancellation request for order <strong>${safeOrder}</strong> has been reviewed and <strong>rejected</strong>.`,
      badge: 'Request Rejected',
      reasonLabel: 'Reason for Rejection',
      note: 'Your order will continue to be processed from where it left off. If you have any further questions about this, you can contact us.',
      cta: 'View Order',
    },
    de: {
      subject: `Ihr Stornierungsantrag wurde abgelehnt - ${safeOrder}`,
      title: `Stornierungsantrag abgelehnt - ${safeOrder}`,
      dear: 'Sehr geehrte/r',
      intro: `Ihr Stornierungsantrag f\u00fcr die Bestellung <strong>${safeOrder}</strong> wurde gepr\u00fcft und <strong>abgelehnt</strong>.`,
      badge: 'Antrag abgelehnt',
      reasonLabel: 'Ablehnungsgrund',
      note: 'Ihre Bestellung wird wie vorgesehen weiter bearbeitet. Bei weiteren Fragen hierzu k\u00f6nnen Sie uns kontaktieren.',
      cta: 'Bestellung ansehen',
    },
    ar: {
      subject: `\u062a\u0645 \u0631\u0641\u0636 \u0637\u0644\u0628 \u0627\u0644\u0625\u0644\u063a\u0627\u0621 \u0627\u0644\u062e\u0627\u0635 \u0628\u0643 - ${safeOrder}`,
      title: `\u062a\u0645 \u0631\u0641\u0636 \u0637\u0644\u0628 \u0627\u0644\u0625\u0644\u063a\u0627\u0621 - ${safeOrder}`,
      dear: '\u0639\u0632\u064a\u0632\u064a/\u0639\u0632\u064a\u0632\u062a\u064a',
      intro: `\u062a\u0645\u062a \u0645\u0631\u0627\u062c\u0639\u0629 \u0637\u0644\u0628 \u0625\u0644\u063a\u0627\u0621 \u0637\u0644\u0628\u0643 \u0631\u0642\u0645 <strong>${safeOrder}</strong> \u0648\u062a\u0645 <strong>\u0631\u0641\u0636\u0647</strong>.`,
      badge: '\u062a\u0645 \u0631\u0641\u0636 \u0627\u0644\u0637\u0644\u0628',
      reasonLabel: '\u0633\u0628\u0628 \u0627\u0644\u0631\u0641\u0636',
      note: '\u0633\u064a\u0633\u062a\u0645\u0631 \u062a\u0646\u0641\u064a\u0630 \u0637\u0644\u0628\u0643 \u0645\u0646 \u062d\u064a\u062b \u062a\u0648\u0642\u0641. \u0625\u0630\u0627 \u0643\u0627\u0646 \u0644\u062f\u064a\u0643 \u0623\u064a \u0627\u0633\u062a\u0641\u0633\u0627\u0631 \u0622\u062e\u0631 \u0628\u0647\u0630\u0627 \u0627\u0644\u0634\u0623\u0646\u060c \u064a\u0645\u0643\u0646\u0643 \u0627\u0644\u062a\u0648\u0627\u0635\u0644 \u0645\u0639\u0646\u0627.',
      cta: '\u0639\u0631\u0636 \u0627\u0644\u0637\u0644\u0628',
    },
  }
  const tr = T[locale] ?? T.tr

  const content = `
    ${greetingL(safeParent, tr.dear)}
    ${paragraph(tr.intro)}

    <div style="text-align: center; margin: 24px 0;">
      ${statusBadge(tr.badge, COLORS.danger)}
    </div>

    <div style="background-color: #fef2f2; border-left: 4px solid ${COLORS.danger}; border-radius: 4px; padding: 14px 16px; margin: 16px 0;">
      <p style="color: ${COLORS.textMuted}; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 6px;">${tr.reasonLabel}</p>
      <p style="color: ${COLORS.textDark}; font-size: 14px; line-height: 1.5; margin: 0;">${safeReason}</p>
    </div>

    ${paragraph(tr.note)}

    ${ctaButton(tr.cta, `${EMAIL_BASE_URL}/siparis-takip?orderNumber=${encodeURIComponent(data.orderNumber)}`)}
  `

  return sendEmailInternal({
    to: data.email,
    subject: tr.subject,
    html: wrapTemplate(tr.title, content, locale)
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
  locale?: EmailLocale
}): Promise<EmailResult> {
  const locale = pickLocale(data.locale)
  const tag = LOCALE_TAG[locale]
  const safeParent = escapeHtml(data.parentName)
  const safeStudent = escapeHtml(data.studentName)
  const safeSchool = escapeHtml(data.schoolName)
  const safeClass = escapeHtml(data.className)
  const safePackage = escapeHtml(data.packageName)
  const safeOrder = escapeHtml(data.orderNumber)

  const amountFmt = data.totalAmount.toLocaleString(tag)

  const T = {
    tr: {
      subject: `Yeni Sipari\u015f - ${safeOrder} - ${amountFmt} TL`,
      title: `Yeni Sipari\u015f - ${safeOrder}`,
      intro: `<strong>${safeSchool}</strong> okulundan yeni bir sipari\u015f geldi.`,
      badge: 'Yeni Sipari\u015f',
      orderNo: 'Sipari\u015f No',
      parent: 'Veli',
      student: '\u00d6\u011frenci',
      school: 'Okul',
      className: 'S\u0131n\u0131f',
      pkg: 'Paket',
      amount: 'Tutar',
      cta: 'Y\u00f6netim Paneli',
      note: 'Sipari\u015f y\u00f6netim panelinde "Aktif" sekmesinde i\u015fleme al\u0131nmay\u0131 bekliyor.',
    },
    en: {
      subject: `New Order - ${safeOrder} - ${amountFmt} TL`,
      title: `New Order - ${safeOrder}`,
      intro: `A new order has arrived from <strong>${safeSchool}</strong>.`,
      badge: 'New Order',
      orderNo: 'Order No',
      parent: 'Parent',
      student: 'Student',
      school: 'School',
      className: 'Class',
      pkg: 'Package',
      amount: 'Amount',
      cta: 'Admin Panel',
      note: 'The order is waiting to be processed in the "Active" tab of the admin panel.',
    },
    de: {
      subject: `Neue Bestellung - ${safeOrder} - ${amountFmt} TL`,
      title: `Neue Bestellung - ${safeOrder}`,
      intro: `Eine neue Bestellung ist von <strong>${safeSchool}</strong> eingegangen.`,
      badge: 'Neue Bestellung',
      orderNo: 'Bestellnr.',
      parent: 'Elternteil',
      student: 'Sch\u00fcler/in',
      school: 'Schule',
      className: 'Klasse',
      pkg: 'Paket',
      amount: 'Betrag',
      cta: 'Verwaltungsbereich',
      note: 'Die Bestellung wartet im Reiter "Aktiv" des Verwaltungsbereichs auf Bearbeitung.',
    },
    ar: {
      subject: `\u0637\u0644\u0628 \u062c\u062f\u064a\u062f - ${safeOrder} - ${amountFmt} TL`,
      title: `\u0637\u0644\u0628 \u062c\u062f\u064a\u062f - ${safeOrder}`,
      intro: `\u0648\u0635\u0644 \u0637\u0644\u0628 \u062c\u062f\u064a\u062f \u0645\u0646 \u0645\u062f\u0631\u0633\u0629 <strong>${safeSchool}</strong>.`,
      badge: '\u0637\u0644\u0628 \u062c\u062f\u064a\u062f',
      orderNo: '\u0631\u0642\u0645 \u0627\u0644\u0637\u0644\u0628',
      parent: '\u0648\u0644\u064a \u0627\u0644\u0623\u0645\u0631',
      student: '\u0627\u0644\u0637\u0627\u0644\u0628',
      school: '\u0627\u0644\u0645\u062f\u0631\u0633\u0629',
      className: '\u0627\u0644\u0635\u0641',
      pkg: '\u0627\u0644\u0628\u0627\u0642\u0629',
      amount: '\u0627\u0644\u0645\u0628\u0644\u063a',
      cta: '\u0644\u0648\u062d\u0629 \u0627\u0644\u0625\u062f\u0627\u0631\u0629',
      note: '\u0627\u0644\u0637\u0644\u0628 \u0628\u0627\u0646\u062a\u0638\u0627\u0631 \u0627\u0644\u0645\u0639\u0627\u0644\u062c\u0629 \u0641\u064a \u0639\u0644\u0627\u0645\u0629 \u062a\u0628\u0648\u064a\u0628 "\u0646\u0634\u0637" \u0641\u064a \u0644\u0648\u062d\u0629 \u0627\u0644\u0625\u062f\u0627\u0631\u0629.',
    },
  }
  const tr = T[locale] ?? T.tr

  const content = `
    ${paragraph(tr.intro)}

    <div style="text-align: center; margin: 24px 0;">
      ${statusBadge(tr.badge, COLORS.success)}
    </div>

    ${infoTable(
      infoRow(tr.orderNo, safeOrder) +
      infoRow(tr.parent, safeParent) +
      infoRow(tr.student, safeStudent) +
      infoRow(tr.school, safeSchool) +
      infoRow(tr.className, safeClass) +
      infoRow(tr.pkg, safePackage) +
      infoRow(tr.amount, `<span style="color: ${COLORS.success}; font-size: 18px;">${amountFmt} TL</span>`)
    )}

    ${ctaButton(tr.cta, `${EMAIL_BASE_URL}/admin/siparisler`)}

    ${paragraph(tr.note)}
  `

  return sendEmailInternal({
    to: data.adminEmail,
    subject: tr.subject,
    html: wrapTemplate(tr.title, content, locale)
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
  locale?: EmailLocale
}): Promise<EmailResult> {
  const locale = pickLocale(data.locale)
  const tag = LOCALE_TAG[locale]
  const safeParent = escapeHtml(data.parentName)
  const safeSchool = escapeHtml(data.schoolName)
  const safeOrder = escapeHtml(data.orderNumber)
  const safeReason = escapeHtml(data.reason)

  const amountFmt = data.totalAmount.toLocaleString(tag)

  const T = {
    tr: {
      subject: `\u0130ptal Talebi - ${safeOrder}`,
      title: `\u0130ptal Talebi - ${safeOrder}`,
      intro: `<strong>${safeSchool}</strong> okulundan bir veli sipari\u015f iptali talep ediyor.`,
      badge: '\u0130ptal Talebi',
      orderNo: 'Sipari\u015f No',
      parent: 'Veli',
      school: 'Okul',
      amount: 'Tutar',
      reasonLabel: 'Velinin Belirtti\u011fi Neden',
      cta: '\u0130ptal Taleplerini \u0130ncele',
      note: 'L\u00fctfen iptal talebini de\u011ferlendirip onayla veya reddet.',
    },
    en: {
      subject: `Cancellation Request - ${safeOrder}`,
      title: `Cancellation Request - ${safeOrder}`,
      intro: `A parent from <strong>${safeSchool}</strong> is requesting an order cancellation.`,
      badge: 'Cancellation Request',
      orderNo: 'Order No',
      parent: 'Parent',
      school: 'School',
      amount: 'Amount',
      reasonLabel: 'Reason Stated by Parent',
      cta: 'Review Cancellation Requests',
      note: 'Please review the cancellation request and approve or reject it.',
    },
    de: {
      subject: `Stornierungsantrag - ${safeOrder}`,
      title: `Stornierungsantrag - ${safeOrder}`,
      intro: `Ein Elternteil von <strong>${safeSchool}</strong> beantragt eine Bestellstornierung.`,
      badge: 'Stornierungsantrag',
      orderNo: 'Bestellnr.',
      parent: 'Elternteil',
      school: 'Schule',
      amount: 'Betrag',
      reasonLabel: 'Vom Elternteil angegebener Grund',
      cta: 'Stornierungsantr\u00e4ge pr\u00fcfen',
      note: 'Bitte pr\u00fcfen Sie den Stornierungsantrag und genehmigen oder lehnen Sie ihn ab.',
    },
    ar: {
      subject: `\u0637\u0644\u0628 \u0625\u0644\u063a\u0627\u0621 - ${safeOrder}`,
      title: `\u0637\u0644\u0628 \u0625\u0644\u063a\u0627\u0621 - ${safeOrder}`,
      intro: `\u064a\u0637\u0644\u0628 \u0623\u062d\u062f \u0623\u0648\u0644\u064a\u0627\u0621 \u0627\u0644\u0623\u0645\u0648\u0631 \u0645\u0646 \u0645\u062f\u0631\u0633\u0629 <strong>${safeSchool}</strong> \u0625\u0644\u063a\u0627\u0621 \u0637\u0644\u0628.`,
      badge: '\u0637\u0644\u0628 \u0625\u0644\u063a\u0627\u0621',
      orderNo: '\u0631\u0642\u0645 \u0627\u0644\u0637\u0644\u0628',
      parent: '\u0648\u0644\u064a \u0627\u0644\u0623\u0645\u0631',
      school: '\u0627\u0644\u0645\u062f\u0631\u0633\u0629',
      amount: '\u0627\u0644\u0645\u0628\u0644\u063a',
      reasonLabel: '\u0627\u0644\u0633\u0628\u0628 \u0627\u0644\u0630\u064a \u0630\u0643\u0631\u0647 \u0648\u0644\u064a \u0627\u0644\u0623\u0645\u0631',
      cta: '\u0645\u0631\u0627\u062c\u0639\u0629 \u0637\u0644\u0628\u0627\u062a \u0627\u0644\u0625\u0644\u063a\u0627\u0621',
      note: '\u064a\u0631\u062c\u0649 \u0645\u0631\u0627\u062c\u0639\u0629 \u0637\u0644\u0628 \u0627\u0644\u0625\u0644\u063a\u0627\u0621 \u0648\u0627\u0644\u0645\u0648\u0627\u0641\u0642\u0629 \u0639\u0644\u064a\u0647 \u0623\u0648 \u0631\u0641\u0636\u0647.',
    },
  }
  const tr = T[locale] ?? T.tr

  const content = `
    ${paragraph(tr.intro)}

    <div style="text-align: center; margin: 24px 0;">
      ${statusBadge(tr.badge, COLORS.warning)}
    </div>

    ${infoTable(
      infoRow(tr.orderNo, safeOrder) +
      infoRow(tr.parent, safeParent) +
      infoRow(tr.school, safeSchool) +
      infoRow(tr.amount, `<span style="color: ${COLORS.warning}; font-size: 18px;">${amountFmt} TL</span>`)
    )}

    <div style="background-color: ${COLORS.bgLight}; border-left: 4px solid ${COLORS.warning}; border-radius: 4px; padding: 14px 16px; margin: 16px 0;">
      <p style="color: ${COLORS.textMuted}; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 6px;">${tr.reasonLabel}</p>
      <p style="color: ${COLORS.textDark}; font-size: 14px; line-height: 1.5; margin: 0;">${safeReason}</p>
    </div>

    ${ctaButton(tr.cta, `${EMAIL_BASE_URL}/admin/iptal-talepleri`, COLORS.warning)}

    ${paragraph(tr.note)}
  `

  return sendEmailInternal({
    to: data.adminEmail,
    subject: tr.subject,
    html: wrapTemplate(tr.title, content, locale)
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
  locale?: EmailLocale
}): Promise<EmailResult> {
  const locale = pickLocale(data.locale)
  const safeSchool = escapeHtml(data.schoolName)
  const safeEmail = escapeHtml(data.directorEmail)
  const safeLoginPwd = escapeHtml(data.loginPassword)
  const safeVeliPwd = escapeHtml(data.veliPassword)

  const T = {
    tr: {
      defaultName: 'Say\u0131n Yetkili',
      dear: 'Say\u0131n',
      subject: `M\u00fcd\u00fcr Paneli Hesab\u0131n\u0131z Haz\u0131r - ${safeSchool}`,
      title: `Ho\u015f Geldiniz - ${safeSchool}`,
      intro: `<strong>${safeSchool}</strong> i\u00e7in m\u00fcd\u00fcr paneli hesab\u0131n\u0131z haz\u0131rlanm\u0131\u015ft\u0131r.`,
      badge: 'Hesap Aktifle\u015ftirildi',
      loginHeading: 'M\u00fcd\u00fcr Paneli Giri\u015f Bilgileriniz',
      loginIntro: 'A\u015fa\u011f\u0131daki bilgilerle m\u00fcd\u00fcr paneline giri\u015f yapabilirsiniz:',
      emailLabel: 'Email',
      pwdLabel: '\u015eifre',
      loginCta: 'M\u00fcd\u00fcr Paneline Giri\u015f Yap',
      veliHeading: 'Velilerinize \u0130letmeniz Gereken \u015eifre',
      veliIntro: 'Velilerinizin sipari\u015f verirken kullanaca\u011f\u0131 okul \u015fifresi a\u015fa\u011f\u0131dad\u0131r. Bu \u015fifreyi okul ileti\u015fim kanallar\u0131nda velilere duyurman\u0131z gerekmektedir:',
      veliLabel: 'Veli Sipari\u015f \u015eifresi',
      orderCta: 'Sipari\u015f Sayfas\u0131',
      securityLabel: 'G\u00fcvenlik:',
      securityText: 'L\u00fctfen bu \u015fifreleri kimseyle payla\u015fmay\u0131n. M\u00fcd\u00fcr panel \u015fifrenizi yaln\u0131zca kendiniz kullan\u0131n. Veli \u015fifresini ise yaln\u0131zca okul velilerine duyurun.',
    },
    en: {
      defaultName: 'Dear Administrator',
      dear: 'Dear',
      subject: `Your Director Panel Account Is Ready - ${safeSchool}`,
      title: `Welcome - ${safeSchool}`,
      intro: `Your director panel account for <strong>${safeSchool}</strong> has been created.`,
      badge: 'Account Activated',
      loginHeading: 'Your Director Panel Login Details',
      loginIntro: 'You can log in to the director panel with the details below:',
      emailLabel: 'Email',
      pwdLabel: 'Password',
      loginCta: 'Log in to Director Panel',
      veliHeading: 'Password to Share with Your Parents',
      veliIntro: 'Below is the school password your parents will use when placing orders. You need to announce this password to parents via the school communication channels:',
      veliLabel: 'Parent Order Password',
      orderCta: 'Order Page',
      securityLabel: 'Security:',
      securityText: 'Please do not share these passwords with anyone. Use your director panel password only yourself. Announce the parent password only to your school parents.',
    },
    de: {
      defaultName: 'Sehr geehrte/r Verantwortliche/r',
      dear: 'Sehr geehrte/r',
      subject: `Ihr Direktoren-Panel-Konto ist bereit - ${safeSchool}`,
      title: `Willkommen - ${safeSchool}`,
      intro: `Ihr Direktoren-Panel-Konto f\u00fcr <strong>${safeSchool}</strong> wurde erstellt.`,
      badge: 'Konto aktiviert',
      loginHeading: 'Ihre Anmeldedaten f\u00fcr das Direktoren-Panel',
      loginIntro: 'Mit den folgenden Daten k\u00f6nnen Sie sich im Direktoren-Panel anmelden:',
      emailLabel: 'E-Mail',
      pwdLabel: 'Passwort',
      loginCta: 'Beim Direktoren-Panel anmelden',
      veliHeading: 'Passwort zur Weitergabe an die Eltern',
      veliIntro: 'Nachfolgend finden Sie das Schulpasswort, das Ihre Eltern bei der Bestellung verwenden. Sie m\u00fcssen dieses Passwort den Eltern \u00fcber die Kommunikationskan\u00e4le der Schule mitteilen:',
      veliLabel: 'Eltern-Bestellpasswort',
      orderCta: 'Bestellseite',
      securityLabel: 'Sicherheit:',
      securityText: 'Bitte teilen Sie diese Passw\u00f6rter mit niemandem. Verwenden Sie Ihr Direktoren-Panel-Passwort nur selbst. Geben Sie das Eltern-Passwort ausschlie\u00dflich an die Eltern Ihrer Schule weiter.',
    },
    ar: {
      defaultName: '\u0639\u0632\u064a\u0632\u064a \u0627\u0644\u0645\u0633\u0624\u0648\u0644',
      dear: '\u0639\u0632\u064a\u0632\u064a',
      subject: `\u062d\u0633\u0627\u0628 \u0644\u0648\u062d\u0629 \u0627\u0644\u0645\u062f\u064a\u0631 \u0627\u0644\u062e\u0627\u0635 \u0628\u0643 \u062c\u0627\u0647\u0632 - ${safeSchool}`,
      title: `\u0645\u0631\u062d\u0628\u064b\u0627 \u0628\u0643 - ${safeSchool}`,
      intro: `\u062a\u0645 \u0625\u0646\u0634\u0627\u0621 \u062d\u0633\u0627\u0628 \u0644\u0648\u062d\u0629 \u0627\u0644\u0645\u062f\u064a\u0631 \u0627\u0644\u062e\u0627\u0635 \u0628\u0645\u062f\u0631\u0633\u0629 <strong>${safeSchool}</strong>.`,
      badge: '\u062a\u0645 \u062a\u0641\u0639\u064a\u0644 \u0627\u0644\u062d\u0633\u0627\u0628',
      loginHeading: '\u0628\u064a\u0627\u0646\u0627\u062a \u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062f\u062e\u0648\u0644 \u0625\u0644\u0649 \u0644\u0648\u062d\u0629 \u0627\u0644\u0645\u062f\u064a\u0631',
      loginIntro: '\u064a\u0645\u0643\u0646\u0643 \u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062f\u062e\u0648\u0644 \u0625\u0644\u0649 \u0644\u0648\u062d\u0629 \u0627\u0644\u0645\u062f\u064a\u0631 \u0628\u0627\u0633\u062a\u062e\u062f\u0627\u0645 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a \u0623\u062f\u0646\u0627\u0647:',
      emailLabel: '\u0627\u0644\u0628\u0631\u064a\u062f \u0627\u0644\u0625\u0644\u0643\u062a\u0631\u0648\u0646\u064a',
      pwdLabel: '\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631',
      loginCta: '\u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062f\u062e\u0648\u0644 \u0625\u0644\u0649 \u0644\u0648\u062d\u0629 \u0627\u0644\u0645\u062f\u064a\u0631',
      veliHeading: '\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0627\u0644\u062a\u064a \u064a\u062c\u0628 \u0625\u0628\u0644\u0627\u063a\u0647\u0627 \u0644\u0623\u0648\u0644\u064a\u0627\u0621 \u0627\u0644\u0623\u0645\u0648\u0631',
      veliIntro: '\u0641\u064a\u0645\u0627 \u064a\u0644\u064a \u0643\u0644\u0645\u0629 \u0645\u0631\u0648\u0631 \u0627\u0644\u0645\u062f\u0631\u0633\u0629 \u0627\u0644\u062a\u064a \u0633\u064a\u0633\u062a\u062e\u062f\u0645\u0647\u0627 \u0623\u0648\u0644\u064a\u0627\u0621 \u0627\u0644\u0623\u0645\u0648\u0631 \u0639\u0646\u062f \u062a\u0642\u062f\u064a\u0645 \u0627\u0644\u0637\u0644\u0628\u0627\u062a. \u064a\u062c\u0628 \u0639\u0644\u064a\u0643 \u0625\u0628\u0644\u0627\u063a \u0623\u0648\u0644\u064a\u0627\u0621 \u0627\u0644\u0623\u0645\u0648\u0631 \u0628\u0647\u0630\u0647 \u0627\u0644\u0643\u0644\u0645\u0629 \u0639\u0628\u0631 \u0642\u0646\u0648\u0627\u062a \u062a\u0648\u0627\u0635\u0644 \u0627\u0644\u0645\u062f\u0631\u0633\u0629:',
      veliLabel: '\u0643\u0644\u0645\u0629 \u0645\u0631\u0648\u0631 \u0637\u0644\u0628 \u0648\u0644\u064a \u0627\u0644\u0623\u0645\u0631',
      orderCta: '\u0635\u0641\u062d\u0629 \u0627\u0644\u0637\u0644\u0628',
      securityLabel: '\u0627\u0644\u0623\u0645\u0627\u0646:',
      securityText: '\u064a\u0631\u062c\u0649 \u0639\u062f\u0645 \u0645\u0634\u0627\u0631\u0643\u0629 \u0643\u0644\u0645\u0627\u062a \u0627\u0644\u0645\u0631\u0648\u0631 \u0647\u0630\u0647 \u0645\u0639 \u0623\u064a \u0634\u062e\u0635. \u0627\u0633\u062a\u062e\u062f\u0645 \u0643\u0644\u0645\u0629 \u0645\u0631\u0648\u0631 \u0644\u0648\u062d\u0629 \u0627\u0644\u0645\u062f\u064a\u0631 \u0628\u0646\u0641\u0633\u0643 \u0641\u0642\u0637. \u0623\u0645\u0627 \u0643\u0644\u0645\u0629 \u0645\u0631\u0648\u0631 \u0648\u0644\u064a \u0627\u0644\u0623\u0645\u0631 \u0641\u0623\u0628\u0644\u063a \u0628\u0647\u0627 \u0623\u0648\u0644\u064a\u0627\u0621 \u0623\u0645\u0648\u0631 \u0627\u0644\u0645\u062f\u0631\u0633\u0629 \u0641\u0642\u0637.',
    },
  }
  const tr = T[locale] ?? T.tr

  const safeName = escapeHtml(data.directorName || tr.defaultName)

  const content = `
    ${greetingL(safeName, tr.dear)}
    ${paragraph(tr.intro)}

    <div style="text-align: center; margin: 24px 0;">
      ${statusBadge(tr.badge, COLORS.success)}
    </div>

    <h3 style="color: ${COLORS.textDark}; font-size: 16px; margin: 24px 0 8px;">${tr.loginHeading}</h3>
    ${paragraph(tr.loginIntro)}
    ${passwordBox(tr.emailLabel, safeEmail, COLORS.primary)}
    ${passwordBox(tr.pwdLabel, safeLoginPwd, COLORS.primary)}

    ${ctaButton(tr.loginCta, `${EMAIL_BASE_URL}/mudur/login`)}

    <h3 style="color: ${COLORS.textDark}; font-size: 16px; margin: 24px 0 8px;">${tr.veliHeading}</h3>
    ${paragraph(tr.veliIntro)}
    ${passwordBox(tr.veliLabel, safeVeliPwd, COLORS.success)}

    ${ctaButton(tr.orderCta, `${EMAIL_BASE_URL}/siparis`, COLORS.success)}

    <div style="background-color: #fffbeb; border-left: 4px solid ${COLORS.warning}; border-radius: 4px; padding: 14px 16px; margin: 24px 0;">
      <p style="color: ${COLORS.textDark}; font-size: 13px; line-height: 1.5; margin: 0;">
        <strong>${tr.securityLabel}</strong> ${tr.securityText}
      </p>
    </div>
  `

  return sendEmailInternal({
    to: data.directorEmail,
    subject: tr.subject,
    html: wrapTemplate(tr.title, content, locale)
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
  locale?: EmailLocale
}): Promise<EmailResult> {
  const locale = pickLocale(data.locale)
  const safeSchool = escapeHtml(data.schoolName)
  const safePwd = escapeHtml(data.newPassword)

  const T = {
    tr: {
      defaultName: 'Say\u0131n Yetkili',
      dear: 'Say\u0131n',
      subject: `M\u00fcd\u00fcr Panel \u015eifreniz Yenilendi - ${safeSchool}`,
      title: `\u015eifre Yenileme - ${safeSchool}`,
      intro: `<strong>${safeSchool}</strong> m\u00fcd\u00fcr panelinizin \u015fifresi yenilenmi\u015ftir.`,
      badge: '\u015eifre Yenilendi',
      pwdLabel: 'Yeni \u015eifreniz',
      cta: 'M\u00fcd\u00fcr Paneline Giri\u015f Yap',
      warning: `Bu i\u015flemi siz yapmad\u0131ysan\u0131z l\u00fctfen derhal <a href="mailto:destek@okultedarigim.com" style="color: ${COLORS.primaryLight};">destek@okultedarigim.com</a> adresine bildirin.`,
    },
    en: {
      defaultName: 'Dear Administrator',
      dear: 'Dear',
      subject: `Your Director Panel Password Has Been Reset - ${safeSchool}`,
      title: `Password Reset - ${safeSchool}`,
      intro: `The password for your <strong>${safeSchool}</strong> director panel has been reset.`,
      badge: 'Password Reset',
      pwdLabel: 'Your New Password',
      cta: 'Log in to Director Panel',
      warning: `If you did not perform this action, please report it immediately to <a href="mailto:destek@okultedarigim.com" style="color: ${COLORS.primaryLight};">destek@okultedarigim.com</a>.`,
    },
    de: {
      defaultName: 'Sehr geehrte/r Verantwortliche/r',
      dear: 'Sehr geehrte/r',
      subject: `Ihr Direktoren-Panel-Passwort wurde zur\u00fcckgesetzt - ${safeSchool}`,
      title: `Passwort zur\u00fccksetzen - ${safeSchool}`,
      intro: `Das Passwort f\u00fcr Ihr Direktoren-Panel von <strong>${safeSchool}</strong> wurde zur\u00fcckgesetzt.`,
      badge: 'Passwort zur\u00fcckgesetzt',
      pwdLabel: 'Ihr neues Passwort',
      cta: 'Beim Direktoren-Panel anmelden',
      warning: `Falls Sie diese Aktion nicht durchgef\u00fchrt haben, melden Sie dies bitte umgehend unter <a href="mailto:destek@okultedarigim.com" style="color: ${COLORS.primaryLight};">destek@okultedarigim.com</a>.`,
    },
    ar: {
      defaultName: '\u0639\u0632\u064a\u0632\u064a \u0627\u0644\u0645\u0633\u0624\u0648\u0644',
      dear: '\u0639\u0632\u064a\u0632\u064a',
      subject: `\u062a\u0645\u062a \u0625\u0639\u0627\u062f\u0629 \u062a\u0639\u064a\u064a\u0646 \u0643\u0644\u0645\u0629 \u0645\u0631\u0648\u0631 \u0644\u0648\u062d\u0629 \u0627\u0644\u0645\u062f\u064a\u0631 \u0627\u0644\u062e\u0627\u0635\u0629 \u0628\u0643 - ${safeSchool}`,
      title: `\u0625\u0639\u0627\u062f\u0629 \u062a\u0639\u064a\u064a\u0646 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 - ${safeSchool}`,
      intro: `\u062a\u0645\u062a \u0625\u0639\u0627\u062f\u0629 \u062a\u0639\u064a\u064a\u0646 \u0643\u0644\u0645\u0629 \u0645\u0631\u0648\u0631 \u0644\u0648\u062d\u0629 \u0627\u0644\u0645\u062f\u064a\u0631 \u0627\u0644\u062e\u0627\u0635\u0629 \u0628\u0645\u062f\u0631\u0633\u0629 <strong>${safeSchool}</strong>.`,
      badge: '\u062a\u0645\u062a \u0625\u0639\u0627\u062f\u0629 \u062a\u0639\u064a\u064a\u0646 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631',
      pwdLabel: '\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0627\u0644\u062c\u062f\u064a\u062f\u0629',
      cta: '\u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062f\u062e\u0648\u0644 \u0625\u0644\u0649 \u0644\u0648\u062d\u0629 \u0627\u0644\u0645\u062f\u064a\u0631',
      warning: `\u0625\u0630\u0627 \u0644\u0645 \u062a\u0642\u0645 \u0628\u0647\u0630\u0627 \u0627\u0644\u0625\u062c\u0631\u0627\u0621\u060c \u0641\u064a\u0631\u062c\u0649 \u0625\u0628\u0644\u0627\u063a\u0646\u0627 \u0641\u0648\u0631\u064b\u0627 \u0639\u0628\u0631 <a href="mailto:destek@okultedarigim.com" style="color: ${COLORS.primaryLight};">destek@okultedarigim.com</a>.`,
    },
  }
  const tr = T[locale] ?? T.tr

  const safeName = escapeHtml(data.directorName || tr.defaultName)

  const content = `
    ${greetingL(safeName, tr.dear)}
    ${paragraph(tr.intro)}

    <div style="text-align: center; margin: 24px 0;">
      ${statusBadge(tr.badge, COLORS.warning)}
    </div>

    ${passwordBox(tr.pwdLabel, safePwd, COLORS.primary)}

    ${ctaButton(tr.cta, `${EMAIL_BASE_URL}/mudur/login`)}

    <div style="background-color: #fffbeb; border-left: 4px solid ${COLORS.warning}; border-radius: 4px; padding: 14px 16px; margin: 24px 0;">
      <p style="color: ${COLORS.textDark}; font-size: 13px; line-height: 1.5; margin: 0;">
        ${tr.warning}
      </p>
    </div>
  `

  return sendEmailInternal({
    to: data.directorEmail,
    subject: tr.subject,
    html: wrapTemplate(tr.title, content, locale)
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
  locale?: EmailLocale
}): Promise<EmailResult> {
  const locale = pickLocale(data.locale)
  const safeSchool = escapeHtml(data.schoolName)
  const safePwd = escapeHtml(data.newPassword)

  const T = {
    tr: {
      defaultName: 'Say\u0131n Yetkili',
      dear: 'Say\u0131n',
      subject: `Veli \u015eifresi Yenilendi - ${safeSchool}`,
      title: `Veli \u015eifresi Yenileme - ${safeSchool}`,
      intro: `<strong>${safeSchool}</strong> okulunun veli sipari\u015f \u015fifresi yenilenmi\u015ftir.`,
      badge: 'Veli \u015eifresi Yenilendi',
      pwdLabel: 'Yeni Veli Sipari\u015f \u015eifresi',
      note: 'Bu yeni \u015fifreyi velilerinize duyurman\u0131z gerekmektedir. Eski \u015fifre art\u0131k ge\u00e7erli de\u011fildir.',
      cta: 'Sipari\u015f Sayfas\u0131',
    },
    en: {
      defaultName: 'Dear Administrator',
      dear: 'Dear',
      subject: `Parent Password Reset - ${safeSchool}`,
      title: `Parent Password Reset - ${safeSchool}`,
      intro: `The parent order password for <strong>${safeSchool}</strong> has been reset.`,
      badge: 'Parent Password Reset',
      pwdLabel: 'New Parent Order Password',
      note: 'You need to announce this new password to your parents. The old password is no longer valid.',
      cta: 'Order Page',
    },
    de: {
      defaultName: 'Sehr geehrte/r Verantwortliche/r',
      dear: 'Sehr geehrte/r',
      subject: `Eltern-Passwort zur\u00fcckgesetzt - ${safeSchool}`,
      title: `Eltern-Passwort zur\u00fccksetzen - ${safeSchool}`,
      intro: `Das Eltern-Bestellpasswort f\u00fcr <strong>${safeSchool}</strong> wurde zur\u00fcckgesetzt.`,
      badge: 'Eltern-Passwort zur\u00fcckgesetzt',
      pwdLabel: 'Neues Eltern-Bestellpasswort',
      note: 'Sie m\u00fcssen dieses neue Passwort Ihren Eltern mitteilen. Das alte Passwort ist nicht mehr g\u00fcltig.',
      cta: 'Bestellseite',
    },
    ar: {
      defaultName: '\u0639\u0632\u064a\u0632\u064a \u0627\u0644\u0645\u0633\u0624\u0648\u0644',
      dear: '\u0639\u0632\u064a\u0632\u064a',
      subject: `\u062a\u0645\u062a \u0625\u0639\u0627\u062f\u0629 \u062a\u0639\u064a\u064a\u0646 \u0643\u0644\u0645\u0629 \u0645\u0631\u0648\u0631 \u0648\u0644\u064a \u0627\u0644\u0623\u0645\u0631 - ${safeSchool}`,
      title: `\u0625\u0639\u0627\u062f\u0629 \u062a\u0639\u064a\u064a\u0646 \u0643\u0644\u0645\u0629 \u0645\u0631\u0648\u0631 \u0648\u0644\u064a \u0627\u0644\u0623\u0645\u0631 - ${safeSchool}`,
      intro: `\u062a\u0645\u062a \u0625\u0639\u0627\u062f\u0629 \u062a\u0639\u064a\u064a\u0646 \u0643\u0644\u0645\u0629 \u0645\u0631\u0648\u0631 \u0637\u0644\u0628 \u0648\u0644\u064a \u0627\u0644\u0623\u0645\u0631 \u0644\u0645\u062f\u0631\u0633\u0629 <strong>${safeSchool}</strong>.`,
      badge: '\u062a\u0645\u062a \u0625\u0639\u0627\u062f\u0629 \u062a\u0639\u064a\u064a\u0646 \u0643\u0644\u0645\u0629 \u0645\u0631\u0648\u0631 \u0648\u0644\u064a \u0627\u0644\u0623\u0645\u0631',
      pwdLabel: '\u0643\u0644\u0645\u0629 \u0645\u0631\u0648\u0631 \u0637\u0644\u0628 \u0648\u0644\u064a \u0627\u0644\u0623\u0645\u0631 \u0627\u0644\u062c\u062f\u064a\u062f\u0629',
      note: '\u064a\u062c\u0628 \u0639\u0644\u064a\u0643 \u0625\u0628\u0644\u0627\u063a \u0623\u0648\u0644\u064a\u0627\u0621 \u0627\u0644\u0623\u0645\u0648\u0631 \u0628\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0627\u0644\u062c\u062f\u064a\u062f\u0629. \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0627\u0644\u0642\u062f\u064a\u0645\u0629 \u0644\u0645 \u062a\u0639\u062f \u0635\u0627\u0644\u062d\u0629.',
      cta: '\u0635\u0641\u062d\u0629 \u0627\u0644\u0637\u0644\u0628',
    },
  }
  const tr = T[locale] ?? T.tr

  const safeName = escapeHtml(data.directorName || tr.defaultName)

  const content = `
    ${greetingL(safeName, tr.dear)}
    ${paragraph(tr.intro)}

    <div style="text-align: center; margin: 24px 0;">
      ${statusBadge(tr.badge, COLORS.warning)}
    </div>

    ${passwordBox(tr.pwdLabel, safePwd, COLORS.success)}

    ${paragraph(tr.note)}

    ${ctaButton(tr.cta, `${EMAIL_BASE_URL}/siparis`, COLORS.success)}
  `

  return sendEmailInternal({
    to: data.directorEmail,
    subject: tr.subject,
    html: wrapTemplate(tr.title, content, locale)
  })
}
