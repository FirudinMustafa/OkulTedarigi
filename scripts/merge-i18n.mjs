// i18n part dosyalarini (scripts/i18n-parts/*.json) mesaj kataloglarina deep-merge eder.
// Her part: { tr:{...}, en:{...}, de:{...}, ar:{...} }. Calistir: node scripts/merge-i18n.mjs
import fs from 'fs'
import path from 'path'

const root = process.cwd()
const partsDir = path.join(root, 'scripts', 'i18n-parts')
const msgDir = path.join(root, 'messages')
const locales = ['tr', 'en', 'de', 'ar']

function deepMerge(target, src) {
  for (const k of Object.keys(src)) {
    const v = src[k]
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      target[k] = target[k] && typeof target[k] === 'object' && !Array.isArray(target[k]) ? target[k] : {}
      deepMerge(target[k], v)
    } else {
      target[k] = v
    }
  }
  return target
}

function keys(obj, prefix = '') {
  let out = []
  for (const k of Object.keys(obj)) {
    const p = prefix ? prefix + '.' + k : k
    const v = obj[k]
    if (v && typeof v === 'object' && !Array.isArray(v)) out = out.concat(keys(v, p))
    else out.push(p)
  }
  return out
}

const catalogs = {}
for (const loc of locales) {
  catalogs[loc] = JSON.parse(fs.readFileSync(path.join(msgDir, `${loc}.json`), 'utf8'))
}

const parts = fs.existsSync(partsDir)
  ? fs.readdirSync(partsDir).filter((f) => f.endsWith('.json')).sort()
  : []

for (const f of parts) {
  const data = JSON.parse(fs.readFileSync(path.join(partsDir, f), 'utf8'))
  for (const loc of locales) {
    if (data[loc]) deepMerge(catalogs[loc], data[loc])
  }
  console.log('merged', f)
}

for (const loc of locales) {
  fs.writeFileSync(path.join(msgDir, `${loc}.json`), JSON.stringify(catalogs[loc], null, 2) + '\n', 'utf8')
}

// Dil anahtar paritesi denetimi (TR referans)
const trKeys = new Set(keys(catalogs.tr))
let problems = 0
for (const loc of ['en', 'de', 'ar']) {
  const lk = new Set(keys(catalogs[loc]))
  const missing = [...trKeys].filter((k) => !lk.has(k))
  const extra = [...lk].filter((k) => !trKeys.has(k))
  if (missing.length) { console.log(`[${loc}] MISSING ${missing.length}:`, missing.slice(0, 30)); problems += missing.length }
  if (extra.length) { console.log(`[${loc}] EXTRA ${extra.length}:`, extra.slice(0, 30)); problems += extra.length }
}
console.log(problems ? `PARITY PROBLEMS: ${problems}` : 'PARITY OK')
console.log('done. total tr keys:', trKeys.size)
