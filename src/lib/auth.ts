import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import bcrypt from 'bcryptjs'
import { prisma } from './prisma'

const KNOWN_WEAK_SECRETS = [
  'dev-secret-do-not-use-in-production-change-me',
  'okul-tedarik-super-secret-key-2024-change-in-production',
]

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET

  if (process.env.NODE_ENV === 'production' && process.env.NEXT_PHASE !== 'phase-production-build') {
    if (!secret) {
      throw new Error('JWT_SECRET environment variable is required in production')
    }
    if (KNOWN_WEAK_SECRETS.includes(secret)) {
      throw new Error('JWT_SECRET must be changed from the default value in production. Use: openssl rand -base64 32')
    }
  } else if (!secret && process.env.NODE_ENV !== 'production') {
    console.warn('[AUTH] JWT_SECRET is not set. Using default development secret.')
  }

  return new TextEncoder().encode(secret || 'dev-secret-do-not-use-in-production-change-me')
}

let _jwtSecret: Uint8Array | null = null
function getSecret(): Uint8Array {
  if (!_jwtSecret) _jwtSecret = getJwtSecret()
  return _jwtSecret
}

export interface JWTPayload {
  id: string
  email: string
  type: 'admin' | 'mudur'
  name: string
  schoolId?: string // Mudur icin
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword)
}

export async function createToken(payload: JWTPayload): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(process.env.JWT_EXPIRES_IN || '7d')
    .sign(getSecret())
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret())
    return payload as unknown as JWTPayload
  } catch {
    return null
  }
}

export async function getSession(): Promise<JWTPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value
  if (!token) return null
  return verifyToken(token)
}

// Session validity cache: 60 saniye boyunca isActive kontrolu cache'lenir.
// Bu sayede her istekte DB sorgusu yapilmaz ama silinmis/pasifleştirilmiş hesaplar
// en fazla 60 sn içinde geçersiz kabul edilir.
const SESSION_CHECK_TTL_MS = 60 * 1000
const _sessionCache = new Map<string, { valid: boolean; checkedAt: number }>()

function getCachedValidity(key: string): boolean | null {
  const entry = _sessionCache.get(key)
  if (!entry) return null
  if (Date.now() - entry.checkedAt > SESSION_CHECK_TTL_MS) {
    _sessionCache.delete(key)
    return null
  }
  return entry.valid
}

function setCachedValidity(key: string, valid: boolean): void {
  _sessionCache.set(key, { valid, checkedAt: Date.now() })
  // Bellek koruma: cache cok buyukse en eski 100 entry'yi sil
  if (_sessionCache.size > 1000) {
    const keys = Array.from(_sessionCache.keys()).slice(0, 100)
    keys.forEach(k => _sessionCache.delete(k))
  }
}

export async function getAdminSession(): Promise<JWTPayload | null> {
  const session = await getSession()
  if (!session || session.type !== 'admin') return null

  // Token icindeki admin DB'de hala aktif mi? (silinmis/pasif admin engellenir)
  const cacheKey = `admin:${session.id}`
  const cached = getCachedValidity(cacheKey)
  if (cached === false) return null
  if (cached === null) {
    const admin = await prisma.admin.findUnique({
      where: { id: session.id },
      select: { isActive: true }
    })
    const valid = !!admin?.isActive
    setCachedValidity(cacheKey, valid)
    if (!valid) return null
  }

  return session
}

export async function getMudurSession(): Promise<JWTPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('mudur_token')?.value
  if (!token) return null
  const session = await verifyToken(token)
  if (!session || session.type !== 'mudur' || !session.schoolId) return null

  // Token icindeki okul DB'de hala aktif mi? (silinmis/pasif okul engellenir)
  const cacheKey = `mudur:${session.schoolId}:${session.email}`
  const cached = getCachedValidity(cacheKey)
  if (cached === false) return null
  if (cached === null) {
    const school = await prisma.school.findUnique({
      where: { id: session.schoolId },
      select: { isActive: true, directorEmail: true }
    })
    // Okul pasif veya email degistirilmisse session gecersiz
    const valid = !!school?.isActive && school.directorEmail === session.email
    setCachedValidity(cacheKey, valid)
    if (!valid) return null
  }

  return session
}

/** Session cache'i temizle (logout, sifre degisikligi vb. icin) */
export function invalidateSessionCache(key?: string): void {
  if (key) {
    _sessionCache.delete(key)
  } else {
    _sessionCache.clear()
  }
}
