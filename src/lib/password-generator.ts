import { randomBytes } from 'crypto'

/**
 * Veli (okul) sifresi:
 *   Format: SFR-XXXX-YYYY-ZZZZ  (12 karakter random + 3 ayirici tire)
 *   Alfabe: 32 karakter (karistirilabilir karakterler haric: 0/O, 1/I, vs)
 *   Entropy: 32^12 = 1.15 * 10^18 (~60 bit) -> brute force ve enumeration imkansiz
 *
 * Rate limit (50 deneme / saat / IP) ile birlikte:
 *   1 milyon IP'den 1 milyar deneme bile %0.0000001'den dusuk basari sansi.
 *
 * NOT: Eski SFR-XXXX (4 hane numerik, 9000 kombinasyon) formatindan migrasyon
 *       icin admin paneli toplu yenileme endpoint'i kullanilmalidir.
 */
const SCHOOL_PWD_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
const SCHOOL_PWD_BLOCK_LENGTH = 4
const SCHOOL_PWD_BLOCK_COUNT = 3 // 4*3 = 12 karakter

function generateRandomBlock(length: number): string {
  const bytes = randomBytes(length)
  let result = ''
  for (let i = 0; i < length; i++) {
    result += SCHOOL_PWD_ALPHABET[bytes[i] % SCHOOL_PWD_ALPHABET.length]
  }
  return result
}

export function generateSchoolPassword(): string {
  const blocks: string[] = ['SFR']
  for (let i = 0; i < SCHOOL_PWD_BLOCK_COUNT; i++) {
    blocks.push(generateRandomBlock(SCHOOL_PWD_BLOCK_LENGTH))
  }
  // SFR-XXXX-YYYY-ZZZZ
  return blocks.join('-')
}

/**
 * Mudur sifresi (admin'in mudure yardimci olmasi icin guzel okunabilir)
 * 12 karakter, harf+rakam+ozel karakter karisik
 */
export function generateMudurPassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const lower = 'abcdefghjkmnpqrstuvwxyz'
  const digit = '23456789'
  const special = '!@#$%&*'

  const all = upper + lower + digit + special
  const bytes = randomBytes(12)
  let password = ''

  // En az birer kategori garanti
  password += upper[bytes[0] % upper.length]
  password += lower[bytes[1] % lower.length]
  password += digit[bytes[2] % digit.length]
  password += special[bytes[3] % special.length]

  for (let i = 4; i < 12; i++) {
    password += all[bytes[i] % all.length]
  }

  // Karistir (Fisher-Yates with crypto random)
  const arr = password.split('')
  const shuffleBytes = randomBytes(arr.length)
  for (let i = arr.length - 1; i > 0; i--) {
    const j = shuffleBytes[i] % (i + 1)
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr.join('')
}

/**
 * Eski format (SFR-1234) tespit etmek icin yardimci.
 * Migrasyon admin endpoint'inde kullanilir.
 */
export function isLegacySchoolPassword(password: string): boolean {
  return /^SFR-\d{4}$/.test(password)
}
