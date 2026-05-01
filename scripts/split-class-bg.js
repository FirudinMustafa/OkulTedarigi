/* eslint-disable */
// Splits SinifLogolari.png (3x3 grid) into 9 separate images for class cards.
// Run: node scripts/split-class-bg.js
const sharp = require('sharp')
const path = require('path')
const fs = require('fs')

const SRC = path.join(__dirname, '..', 'SinifLogolari.png')
const OUT_DIR = path.join(__dirname, '..', 'public', 'images', 'class-bg')

const COLORS = [
  'blue',    // 0,0
  'green',   // 0,1
  'purple',  // 0,2
  'pink',    // 1,0
  'orange',  // 1,1
  'yellow',  // 1,2
  'teal',    // 2,0
  'lime',    // 2,1
  'red'      // 2,2
]

;(async () => {
  if (!fs.existsSync(SRC)) {
    console.error('Source image not found:', SRC)
    process.exit(1)
  }
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true })

  const meta = await sharp(SRC).metadata()
  const w = Math.floor(meta.width / 3)
  const h = Math.floor(meta.height / 3)
  console.log(`Source ${meta.width}x${meta.height} -> tiles ${w}x${h}`)

  let idx = 0
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const left = col * w
      const top = row * h
      const name = `${COLORS[idx]}.png`
      await sharp(SRC)
        .extract({ left, top, width: w, height: h })
        .png({ quality: 90 })
        .toFile(path.join(OUT_DIR, name))
      console.log(`  -> ${name} (${left},${top})`)
      idx++
    }
  }

  console.log(`Done. ${idx} files written to ${OUT_DIR}`)
})().catch(err => { console.error(err); process.exit(1) })
