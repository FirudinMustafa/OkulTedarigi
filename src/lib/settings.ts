import { prisma } from './prisma'

// Genel key/value ayar deposu. Tablo bos/eksik olsa bile default ile guvenli calisir.

export const SETTING_KEYS = {
  PAYMENT_COMMISSION_RATE: 'PAYMENT_COMMISSION_RATE',
} as const

/** Bir ayari oku; yoksa (veya hata olursa) default doner. */
export async function getSetting(key: string, defaultValue: string): Promise<string> {
  try {
    const row = await prisma.setting.findUnique({ where: { key } })
    return row?.value ?? defaultValue
  } catch {
    // settings tablosu henuz yoksa (DDL uygulanmadan) default ile devam et
    return defaultValue
  }
}

/** Bir ayari yaz (upsert). */
export async function setSetting(key: string, value: string): Promise<void> {
  await prisma.setting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  })
}

/** Odeme entegrasyonu komisyon orani (% olarak). Varsayilan 2.39. */
export async function getPaymentCommissionRate(): Promise<number> {
  const raw = await getSetting(SETTING_KEYS.PAYMENT_COMMISSION_RATE, '2.39')
  const n = Number(raw)
  return Number.isFinite(n) && n >= 0 ? n : 2.39
}
