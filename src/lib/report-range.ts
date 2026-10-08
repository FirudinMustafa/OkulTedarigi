/**
 * Rapor tarih araligi — ekran (api/admin/reports) ve Excel (api/admin/reports/export)
 * AYNI fonksiyonu kullanir; "Bu Ay" vb. donemler iki yerde farkli hesaplanmasin.
 *
 * Gun sinirlari sunucu yerel saatine gore (VPS saat dilimi Europe/Istanbul).
 */

export type ReportPeriod = 'all' | 'today' | 'yesterday' | 'week' | 'month'

export interface ReportRange {
  gte?: Date
  lte?: Date
  /** Excel basligi icin (TR) */
  label: string
}

export function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0)
}

export function endOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)
}

/** 'YYYY-MM-DD' -> yerel Date (UTC kaymasi olmadan) */
export function parseYmd(s: string | null | undefined): Date | null {
  if (!s) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

export function ymd(d: Date): string {
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const da = String(d.getDate()).padStart(2, '0')
  return `${y}-${mo}-${da}`
}

export function resolveReportRange(searchParams: URLSearchParams, now: Date = new Date()): ReportRange {
  const fromParam = searchParams.get('from')
  const toParam = searchParams.get('to')

  if (fromParam || toParam) {
    const from = parseYmd(fromParam)
    const to = parseYmd(toParam)
    return {
      gte: from ? startOfDay(from) : undefined,
      lte: to ? endOfDay(to) : undefined,
      label: `${fromParam || '...'} - ${toParam || '...'}`,
    }
  }

  switch ((searchParams.get('period') || 'all') as ReportPeriod) {
    case 'today':
      return { gte: startOfDay(now), label: 'Bugun' }
    case 'yesterday': {
      const y = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
      return { gte: startOfDay(y), lte: endOfDay(y), label: 'Dun' }
    }
    case 'week':
      // Son 7 gun (bugun dahil): 6 gun oncesinin basindan itibaren
      return { gte: startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)), label: 'Son 7 Gun' }
    case 'month':
      // Takvim ayi: ayin 1'inden bugune
      return { gte: new Date(now.getFullYear(), now.getMonth(), 1), label: 'Bu Ay' }
    default:
      return { label: 'Tum Zamanlar' }
  }
}

export function rangeWhere(range: ReportRange): { createdAt?: { gte?: Date; lte?: Date } } {
  if (!range.gte && !range.lte) return {}
  const createdAt: { gte?: Date; lte?: Date } = {}
  if (range.gte) createdAt.gte = range.gte
  if (range.lte) createdAt.lte = range.lte
  return { createdAt }
}
