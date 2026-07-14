/**
 * Rate Limiting - Brute Force Korumasi
 */

import { prisma } from './prisma'

const DEFAULT_MAX_ATTEMPTS = 5
const DEFAULT_BLOCK_DURATION = 5 // dakika

// Probabilistic cleanup: her ~100 cagrida bir expired kayitlari temizle.
// Bu sayede ayri bir cron job'a gerek kalmaz; tablo sismez.
let _lastCleanupAt = 0
const CLEANUP_MIN_INTERVAL_MS = 5 * 60 * 1000 // En sik 5 dakikada bir
function maybeTriggerCleanup(): void {
  // %1 olasilik + minimum 5 dakika araliği
  if (Math.random() > 0.01) return
  if (Date.now() - _lastCleanupAt < CLEANUP_MIN_INTERVAL_MS) return
  _lastCleanupAt = Date.now()
  cleanupExpiredRateLimits().catch(err => {
    console.error('[RATE_LIMIT] Cleanup error:', err)
  })
}

export async function checkRateLimit(
  identifier: string,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  blockDurationMinutes = DEFAULT_BLOCK_DURATION
): Promise<{ allowed: boolean; remainingAttempts: number; blockedUntil?: Date }> {
  const now = new Date()
  maybeTriggerCleanup()

  const rateLimitLog = await prisma.rateLimitLog.findUnique({
    where: { identifier }
  })

  // Engellenme suresi gecmisse kaydi sifirla — optimistic: sadece okunan blockedUntil hala
  // gecerliyse sil (arada baska bir istek yeniden engellemis olabilir, o zaman silme).
  if (rateLimitLog?.blockedUntil && rateLimitLog.blockedUntil < now) {
    await prisma.rateLimitLog.deleteMany({
      where: { identifier, blockedUntil: rateLimitLog.blockedUntil }
    })
    return { allowed: true, remainingAttempts: maxAttempts }
  }

  // Hala engellenme suresi varsa
  if (rateLimitLog?.blockedUntil && rateLimitLog.blockedUntil > now) {
    return {
      allowed: false,
      remainingAttempts: 0,
      blockedUntil: rateLimitLog.blockedUntil
    }
  }

  // Kayit yoksa, izin ver
  if (!rateLimitLog) {
    return {
      allowed: true,
      remainingAttempts: maxAttempts
    }
  }

  // Deneme sayisi limitin altindaysa izin ver
  if (rateLimitLog.attempts < maxAttempts) {
    return {
      allowed: true,
      remainingAttempts: maxAttempts - rateLimitLog.attempts
    }
  }

  // Limit asildiysa atomik olarak engelle — sadece okunan attempts/blockedUntil hala gecerliyse
  // (WHERE kosulu kazanan tarafi belirler; kaybeden taraf tekrar okur, sonsuz donguye girmez).
  const blockedUntil = new Date(now.getTime() + blockDurationMinutes * 60 * 1000)
  const claim = await prisma.rateLimitLog.updateMany({
    where: { identifier, attempts: rateLimitLog.attempts, blockedUntil: null },
    data: { blockedUntil }
  })

  if (claim.count === 0) {
    const fresh = await prisma.rateLimitLog.findUnique({ where: { identifier } })
    if (fresh?.blockedUntil && fresh.blockedUntil > now) {
      return { allowed: false, remainingAttempts: 0, blockedUntil: fresh.blockedUntil }
    }
    return { allowed: true, remainingAttempts: Math.max(0, maxAttempts - (fresh?.attempts ?? 0)) }
  }

  return {
    allowed: false,
    remainingAttempts: 0,
    blockedUntil
  }
}

export async function recordFailedAttempt(identifier: string): Promise<void> {
  // Atomik upsert (MySQL: INSERT ... ON DUPLICATE KEY UPDATE) — identifier artik unique,
  // findFirst+update/create'deki TOCTOU yarisini ortadan kaldirir.
  await prisma.rateLimitLog.upsert({
    where: { identifier },
    create: { identifier, attempts: 1 },
    update: { attempts: { increment: 1 } }
  })
}

export async function resetRateLimit(identifier: string): Promise<void> {
  await prisma.rateLimitLog.deleteMany({
    where: { identifier }
  })
}

export async function cleanupExpiredRateLimits(): Promise<number> {
  const result = await prisma.rateLimitLog.deleteMany({
    where: {
      OR: [
        { blockedUntil: { lt: new Date() } },
        {
          blockedUntil: null,
          updatedAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } // 24 saat onceki
        }
      ]
    }
  })
  return result.count
}
