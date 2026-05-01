import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Health check endpoint
 *
 * Vercel uptime monitoring + harici monitoring araclari (UptimeRobot, BetterStack vb.)
 * icin standart endpoint. Public — auth gerektirmez.
 *
 * 200 OK + { status: 'ok', db: 'ok', uptime, timestamp }
 * 503 Service Unavailable — DB erisilemiyorsa
 *
 * Cevap her zaman <100ms olmali (basit SELECT 1).
 */

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  const startedAt = Date.now()
  const result: {
    status: 'ok' | 'degraded'
    db: 'ok' | 'error'
    timestamp: string
    responseMs: number
    error?: string
  } = {
    status: 'ok',
    db: 'ok',
    timestamp: new Date().toISOString(),
    responseMs: 0,
  }

  try {
    // Basit DB ping — connection pool ve query latency'sini test eder
    await prisma.$queryRaw`SELECT 1`
  } catch (err) {
    result.status = 'degraded'
    result.db = 'error'
    result.error = err instanceof Error ? err.message.slice(0, 200) : 'unknown'
  }

  result.responseMs = Date.now() - startedAt

  return NextResponse.json(result, {
    status: result.status === 'ok' ? 200 : 503,
    headers: {
      // Health check her zaman taze cevap dönmeli
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  })
}
