/**
 * Okul hakedisi (komisyon) hesabi — TEK KAYNAK.
 *
 * Kurallar (is karari, 2026-10-08):
 *  - Hakedis OGRENCI BASINA: sinif komisyonu x siparisteki ogrenci sayisi.
 *  - Hakedis siparis aninda Order.commissionAmount'a yazilir; sinif komisyonu sonradan
 *    degisse de gecmis siparislerin hakedisi degismez.
 *  - Hakedise yalnizca COMMISSION_STATUSES'taki siparisler girer (iptal/iade/odenmemis haric).
 *  - Kalan = toplam hakedis - PAID - PENDING (PENDING: eski akistan kalan, onay bekleyen kayitlar).
 *  - Odenen toplam hakedisi asarsa (orn. odeme sonrasi iade) fark "fazla odeme" olarak raporlanir.
 *
 * Admin hakedisler, hakedis Excel'i, raporlar ve mudur paneli bu fonksiyonlari kullanir;
 * ayni okul icin her ekranda ayni rakam cikmasi bu dosyaya baglidir.
 */
import type { OrderStatus, Prisma, PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { COMMISSION_STATUSES } from '@/lib/constants'

type Num = { toString(): string } | number | string | null | undefined

export const round2 = (n: number) => Math.round(n * 100) / 100

/** Para karsilastirmasi kurus bazinda (float hatasi olmadan). */
export const toKurus = (n: number) => Math.round(n * 100)

/** Siparis hakedisi: kayitli deger, yoksa (eski kayit) sinif komisyonu x ogrenci sayisi. */
export function orderCommission(
  order: { commissionAmount?: Num; _count?: { students: number } },
  classCommission: Num
): number {
  if (order.commissionAmount !== null && order.commissionAmount !== undefined) {
    return Number(order.commissionAmount)
  }
  const students = Math.max(order._count?.students ?? 1, 1)
  return round2(Number(classCommission ?? 0) * students)
}

/** Hakedis hesabinda siparisten gereken alanlar (include/select icin). */
export const commissionOrderSelect = {
  id: true,
  totalAmount: true,
  commissionAmount: true,
  status: true,
  createdAt: true,
  _count: { select: { students: true } },
} satisfies Prisma.OrderSelect

export interface PayoutSummary {
  id: string
  name: string
  isActive: boolean
  totalOrders: number
  totalStudents: number
  totalRevenue: number
  commission: number
  paid: number
  pendingPayments: number
  /** Yeni odeme kaydi icin acik tutar: toplam - PAID - PENDING (admin) */
  remaining: number
  /** Okulun henuz eline gecmeyen tutar: toplam - PAID (mudur) */
  notYetPaid: number
  overpaid: number
  commissionRate: number
}

type Db = PrismaClient | Prisma.TransactionClient

/**
 * Okul bazli hakedis ozeti. schoolId verilmezse TUM okullar (pasifler dahil — pasif okulun
 * odenmemis hakedisi kaybolmasin; filtrelemeyi cagiran taraf yapar).
 */
export async function getPayoutSummaries(opts: { schoolId?: string; db?: Db } = {}): Promise<PayoutSummary[]> {
  const db = opts.db ?? prisma
  const schools = await db.school.findMany({
    where: opts.schoolId ? { id: opts.schoolId } : {},
    select: {
      id: true,
      name: true,
      isActive: true,
      classes: {
        select: {
          commissionAmount: true,
          orders: {
            where: { status: { in: COMMISSION_STATUSES as OrderStatus[] } },
            select: commissionOrderSelect,
          },
        },
      },
      schoolPayments: { select: { amount: true, status: true } },
    },
    orderBy: { name: 'asc' },
  })

  return schools.map(school => {
    let commission = 0
    let totalOrders = 0
    let totalStudents = 0
    let totalRevenue = 0
    for (const cls of school.classes) {
      for (const o of cls.orders) {
        totalOrders += 1
        totalStudents += Math.max(o._count.students, 1)
        totalRevenue += Number(o.totalAmount)
        commission += orderCommission(o, cls.commissionAmount)
      }
    }
    commission = round2(commission)
    totalRevenue = round2(totalRevenue)

    const paid = round2(school.schoolPayments
      .filter(p => p.status === 'PAID')
      .reduce((acc, p) => acc + Number(p.amount), 0))
    const pendingPayments = round2(school.schoolPayments
      .filter(p => p.status === 'PENDING')
      .reduce((acc, p) => acc + Number(p.amount), 0))

    const diff = round2(commission - paid - pendingPayments)
    return {
      id: school.id,
      name: school.name,
      isActive: school.isActive,
      totalOrders,
      totalStudents,
      totalRevenue,
      commission,
      paid,
      pendingPayments,
      remaining: diff > 0 ? diff : 0,
      notYetPaid: Math.max(round2(commission - paid), 0),
      overpaid: diff < 0 ? -diff : 0,
      commissionRate: totalRevenue > 0 ? round2(commission / totalRevenue * 100) : 0,
    }
  })
}

export async function getSchoolPayoutSummary(schoolId: string, db?: Db): Promise<PayoutSummary | null> {
  const [summary] = await getPayoutSummaries({ schoolId, db })
  return summary ?? null
}
