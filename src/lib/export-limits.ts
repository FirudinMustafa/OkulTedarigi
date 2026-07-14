export const MAX_EXPORT_ROWS = 20000

export function buildTruncationNotice(totalCount: number, locale: 'tr' | 'en' | 'de' | 'ar' = 'tr'): string {
  const messages: Record<string, string> = {
    tr: `Ilk ${MAX_EXPORT_ROWS.toLocaleString('tr-TR')} kayit gosteriliyor (toplam ${totalCount.toLocaleString('tr-TR')}). Daha az kayit icin tarih/durum/okul filtresi kullanin.`,
    en: `Showing the first ${MAX_EXPORT_ROWS.toLocaleString('en-US')} rows (of ${totalCount.toLocaleString('en-US')} total). Use date/status/school filters to narrow the results.`,
    de: `Die ersten ${MAX_EXPORT_ROWS.toLocaleString('de-DE')} Datensaetze werden angezeigt (von insgesamt ${totalCount.toLocaleString('de-DE')}). Verwenden Sie Datums-/Status-/Schulfilter, um die Ergebnisse einzugrenzen.`,
    ar: `يتم عرض أول ${MAX_EXPORT_ROWS.toLocaleString('ar')} سجل (من إجمالي ${totalCount.toLocaleString('ar')}). استخدم عوامل تصفية التاريخ/الحالة/المدرسة لتضييق النتائج.`
  }
  return messages[locale] || messages.tr
}
