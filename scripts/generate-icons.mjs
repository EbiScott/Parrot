/**
 * Rasterises the Parrot mark to PNG without any image dependency.
 *
 * Everything is drawn with plain pixel math into an RGBA buffer, then encoded
 * as a PNG (zlib deflate + CRC32). Supersampling at 4x4 gives clean edges.
 *
 * Run: node scripts/generate-icons.mjs
 */
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const PUBLIC = resolve(HERE, '..', 'public')

// ---------------------------------------------------------------- png encoder

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body), 0)
  return Buffer.concat([len, body, crc])
}

function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  // One filter byte (0 = none) per scanline.
  const stride = width * 4
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride)
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// ------------------------------------------------------------------- geometry

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)
const lerp = (a, b, t) => a + (b - a) * t
const mix = (c1, c2, t) => [
  lerp(c1[0], c2[0], t),
  lerp(c1[1], c2[1], t),
  lerp(c1[2], c2[2], t),
]

function inRoundedRect(x, y, inset, radius) {
  const min = inset
  const max = 1 - inset
  if (x < min || x > max || y < min || y > max) return false
  const rx = Math.min(Math.max(x - min, max - x), radius)
  const ry = Math.min(Math.max(y - min, max - y), radius)
  if (rx >= radius || ry >= radius || (rx > 0 && ry > 0)) {
    // inside the straight edges, or in a corner region
    if (x - min < radius && y - min < radius) {
      return Math.hypot(radius - (x - min), radius - (y - min)) <= radius
    }
    if (max - x < radius && y - min < radius) {
      return Math.hypot(radius - (max - x), radius - (y - min)) <= radius
    }
    if (x - min < radius && max - y < radius) {
      return Math.hypot(radius - (x - min), radius - (max - y)) <= radius
    }
    if (max - x < radius && max - y < radius) {
      return Math.hypot(radius - (max - x), radius - (max - y)) <= radius
    }
  }
  return true
}

function inEllipse(x, y, cx, cy, rx, ry, angle = 0) {
  const dx = x - cx
  const dy = y - cy
  const ca = Math.cos(angle)
  const sa = Math.sin(angle)
  const ux = dx * ca + dy * sa
  const uy = -dx * sa + dy * ca
  return (ux * ux) / (rx * rx) + (uy * uy) / (ry * ry) <= 1
}

function inCircle(x, y, cx, cy, r) {
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r
}

// Barycentric point-in-triangle.
function inTriangle(x, y, ax, ay, bx, by, cx, cy) {
  const d1 = (bx - ax) * (y - ay) - (by - ay) * (x - ax)
  const d2 = (cx - bx) * (y - by) - (cy - by) * (x - bx)
  const d3 = (ax - cx) * (y - cy) - (ay - cy) * (x - cx)
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0
  return !(hasNeg && hasPos)
}

// ---------------------------------------------------------------------- paint

const INK = [0x0f, 0x10, 0x13]
const GREEN_LIGHT = [0x5e, 0xe6, 0x9c]
const GREEN_DEEP = [0x04, 0x8f, 0x6a]
const WING = [0x05, 0x6f, 0x55]
const TAIL = [0x0b, 0x63, 0x4f]
const ORANGE_HI = [0xff, 0xb3, 0x3d]
const ORANGE_LO = [0xf5, 0x7c, 0x1f]

/**
 * Colour of the artwork at art-space point (x, y) in [0,1].
 * Returns [r,g,b,a] with a in 0..1 (premultiplied later).
 */
function artColor(x, y) {
  // Body gradient runs top-left → bottom-right.
  const t = clamp01((x * 0.55 + y * 0.9) / 1.45)
  const body = mix(GREEN_LIGHT, GREEN_DEEP, t)

  // Tail (behind the body).
  if (inTriangle(x, y, 0.36, 0.58, 0.52, 0.60, 0.30, 0.90)) return [...TAIL, 1]
  if (inTriangle(x, y, 0.36, 0.58, 0.52, 0.60, 0.46, 0.92)) return [...TAIL, 1]

  // Body.
  if (inEllipse(x, y, 0.485, 0.615, 0.175, 0.225, -0.12)) return [...body, 1]

  // Wing overlay, slightly darker for depth.
  if (inEllipse(x, y, 0.455, 0.655, 0.095, 0.145, -0.18)) return [...WING, 1]

  // Eye (must be tested before the head, which would otherwise swallow it).
  if (inCircle(x, y, 0.625, 0.365, 0.030)) return [0x07, 0x0a, 0x0b, 1]
  if (inCircle(x, y, 0.632, 0.356, 0.011)) return [0xe9fff9, 1]

  // Head.
  if (inCircle(x, y, 0.575, 0.395, 0.145)) return [...body, 1]

  // Beak — a hooked wedge pointing right.
  if (inTriangle(x, y, 0.665, 0.345, 0.855, 0.455, 0.645, 0.505)) {
    const bt = clamp01((x - 0.64) / 0.22)
    return [...mix(ORANGE_HI, ORANGE_LO, bt), 1]
  }
  // Hook tip curls down.
  if (inTriangle(x, y, 0.785, 0.43, 0.855, 0.455, 0.775, 0.53)) {
    return [...ORANGE_LO, 1]
  }

  return null
}

/**
 * Full frame colour for a screen-space point.
 * `artScale` shrinks the artwork for the maskable safe zone.
 */
function frameColor(x, y, { artScale, rounded }) {
  if (rounded && !inRoundedRect(x, y, 0, 0.205)) return [0, 0, 0, 0]

  // Base + a soft teal glow behind the bird.
  const glow = Math.hypot(x - 0.5, y - 0.38)
  const glowAmt = clamp01(1 - glow / 0.62) ** 2 * 0.30
  let rgb = mix(INK, [0x12, 0x3a, 0x34], glowAmt)

  const ax = 0.5 + (x - 0.5) / artScale
  const ay = 0.5 + (y - 0.5) / artScale
  const art = ax >= 0 && ax <= 1 && ay >= 0 && ay <= 1 ? artColor(ax, ay) : null

  if (art) {
    const a = art[3]
    rgb = [lerp(rgb[0], art[0], a), lerp(rgb[1], art[1], a), lerp(rgb[2], art[2], a)]
  }
  return [rgb[0], rgb[1], rgb[2], 1]
}

function renderIcon(size, { rounded = false, artScale = 0.88 } = {}) {
  const SS = 4 // 4x4 samples per pixel
  const out = Buffer.alloc(size * size * 4)

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = (px + (sx + 0.5) / SS) / size
          const y = (py + (sy + 0.5) / SS) / size
          const c = frameColor(x, y, { artScale, rounded })
          // Composite over transparent (premultiply by alpha).
          r += c[0] * c[3]
          g += c[1] * c[3]
          b += c[2] * c[3]
          a += c[3]
        }
      }
      const n = SS * SS
      const alpha = a / n
      const i = (py * size + px) * 4
      if (alpha <= 0) {
        out[i] = out[i + 1] = out[i + 2] = out[i + 3] = 0
      } else {
        // Un-premultiply back to straight alpha. Channels are 0..255 here.
        out[i] = Math.min(255, Math.round(r / a))
        out[i + 1] = Math.min(255, Math.round(g / a))
        out[i + 2] = Math.min(255, Math.round(b / a))
        out[i + 3] = Math.round(clamp01(alpha) * 255)
      }
    }
  }
  return encodePng(size, size, out)
}

// ---------------------------------------------------------------------- build

mkdirSync(PUBLIC, { recursive: true })

const jobs = [
  ['pwa-192.png', 192, { rounded: true, artScale: 0.88 }],
  ['pwa-512.png', 512, { rounded: true, artScale: 0.88 }],
  // Maskable icons are cropped by the launcher, so keep art inside the 80% safe zone.
  ['pwa-maskable-512.png', 512, { rounded: false, artScale: 0.72 }],
  ['apple-touch-icon.png', 180, { rounded: false, artScale: 0.82 }],
  ['favicon-32.png', 32, { rounded: true, artScale: 0.9 }],
]

for (const [name, size, opts] of jobs) {
  const buf = renderIcon(size, opts)
  writeFileSync(resolve(PUBLIC, name), buf)
  console.log(`  ${name.padEnd(24)} ${size}x${size}  ${(buf.length / 1024).toFixed(1)} KB`)
}

console.log('Icons written to public/')
