import { prisma } from './prisma'
import type { DocLocale, TeslimPackageColumn } from './teslim-excel'

type PkgRow = { id: string; name: string; name_en: string | null; name_de: string | null; name_ar: string | null }

const pkgSelect = { id: true, name: true, name_en: true, name_de: true, name_ar: true } as const

function localizedName(p: PkgRow, locale: DocLocale): string {
  if (locale === 'en' && p.name_en) return p.name_en
  if (locale === 'de' && p.name_de) return p.name_de
  if (locale === 'ar' && p.name_ar) return p.name_ar
  return p.name
}

/**
 * Teslim Excel'inin paket sutunlari.
 * schoolId verilirse: okulun siniflarina tanimli paketler (siparis olmasa da sutun cikar)
 * + siparislerde gecip artik okula tanimli olmayan paketler (sinifin paketi sonradan
 * degistiyse eski siparis satirindaki "1" kaybolmasin). schoolId yoksa sadece siparislerdekiler.
 */
export async function getTeslimPackageColumns(
  schoolId: string | null,
  orders: { packageId: string }[],
  locale: DocLocale,
): Promise<TeslimPackageColumn[]> {
  const defined: PkgRow[] = schoolId
    ? await prisma.package.findMany({ where: { classes: { some: { schoolId } } }, select: pkgSelect })
    : []

  const definedIds = new Set(defined.map(p => p.id))
  const missingIds = [...new Set(orders.map(o => o.packageId))].filter(id => !definedIds.has(id))
  const extra: PkgRow[] = missingIds.length > 0
    ? await prisma.package.findMany({ where: { id: { in: missingIds } }, select: pkgSelect })
    : []

  return [...defined, ...extra]
    .map(p => ({ id: p.id, name: localizedName(p, locale) }))
    .sort((a, b) => a.name.localeCompare(b.name, locale, { numeric: true }))
}
