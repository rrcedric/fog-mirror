// Copie les fichiers WASM de MediaPipe dans public/ pour les servir depuis notre propre origine
// (pas de dépendance à un CDN tiers). Lancé automatiquement après `npm install`.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = join(root, 'node_modules/@mediapipe/tasks-vision/wasm')
const dest = join(root, 'public/mediapipe/wasm')
const files = [
  'vision_wasm_internal.js',
  'vision_wasm_internal.wasm',
  'vision_wasm_nosimd_internal.js',
  'vision_wasm_nosimd_internal.wasm',
]

if (!existsSync(src)) {
  console.warn('copy-mediapipe-wasm: @mediapipe/tasks-vision absent, rien à copier')
  process.exit(0)
}
mkdirSync(dest, { recursive: true })
for (const file of files) copyFileSync(join(src, file), join(dest, file))
console.log(`copy-mediapipe-wasm: ${files.length} fichiers copiés dans public/mediapipe/wasm`)
