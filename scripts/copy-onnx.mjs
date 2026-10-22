/**
 * Copies the ONNX Runtime wasm binaries into public/ort/ so they are served
 * from our own origin. That is what lets the service worker cache them and the
 * app run with no network at all after the first visit.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const SOURCE = join(ROOT, 'node_modules', '@xenova', 'transformers', 'dist')
const TARGET = join(ROOT, 'public', 'ort')

if (!existsSync(SOURCE)) {
  console.error('  ! @xenova/transformers is not installed — run npm install first.')
  process.exit(1)
}

mkdirSync(TARGET, { recursive: true })

let total = 0
for (const name of readdirSync(SOURCE)) {
  if (!name.endsWith('.wasm')) continue
  copyFileSync(join(SOURCE, name), join(TARGET, name))
  total += statSync(join(TARGET, name)).size
  console.log(`  ort/${name}`)
}

console.log(`OR Runtime wasm ready (${(total / 1024 / 1024).toFixed(1)} MB)`)
