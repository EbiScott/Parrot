/**
 * Speech transcription, off the main thread.
 *
 * The main thread only has to decode a blob to 16 kHz mono Float32 and hand the
 * buffer over (transferred, not copied). Model download, chunking and inference
 * all happen here, so scrolling and recording never stutter.
 */
import { env, pipeline } from '@xenova/transformers'
import { CHUNK_SECONDS, MODEL_ID, SAMPLE_RATE } from '../constants'
import { splitIntoChunks } from '../utils/audioChunks'
import { cuesFromModelOutput } from '../utils/subtitles'

// Only fetch model files from the Hub; there are no local model files to try.
env.allowLocalModels = false
env.useBrowserCache = true

// ONNX Runtime's threaded build needs SharedArrayBuffer, which needs COOP/COEP
// headers. A phone on a plain static host will not have them — so: one thread.
env.backends.onnx.wasm.numThreads = 1
env.backends.onnx.wasm.proxy = false

// Serve the runtime wasm from our own origin (public/ort/) so the service
// worker can cache it. Otherwise it comes from a CDN on every cold start.
try {
  const base = import.meta.env.BASE_URL || '/'
  env.backends.onnx.wasm.wasmPaths = new URL(`${base}ort/`, self.location.origin).href
} catch {
  // Leave the default; it still works, it just is not precacheable.
}

const CACHE_NAME = 'transformers-cache'

let transcriberPromise = null
const modelFiles = new Map()
let lastReported = -1

function post(message, transfer) {
  self.postMessage(message, transfer || [])
}

/**
 * transformers.js reports progress per file. Sum loaded/total across every file
 * seen so far to get one honest 0..1 number for the whole model.
 */
function reportProgress(info) {
  if (info.status === 'progress' && info.file) {
    modelFiles.set(info.file, { loaded: info.loaded || 0, total: info.total || 0 })
  } else if (info.status === 'done' && info.file) {
    const previous = modelFiles.get(info.file) || { total: info.total || 0 }
    modelFiles.set(info.file, { loaded: previous.total, total: previous.total })
  } else {
    return
  }

  let loaded = 0
  let total = 0
  for (const file of modelFiles.values()) {
    if (!file.total) continue
    loaded += Math.min(file.loaded, file.total)
    total += file.total
  }

  if (!total) return
  const progress = Math.min(1, loaded / total)
  // Only post when it visibly moves, to keep the message channel quiet.
  if (progress - lastReported >= 0.01 || (progress === 1 && lastReported !== 1)) {
    lastReported = progress
    post({ type: 'status', phase: 'model', progress, file: info.file })
  }
}

async function getTranscriber() {
  if (!transcriberPromise) {
    lastReported = -1
    transcriberPromise = pipeline('automatic-speech-recognition', MODEL_ID, {
      quantized: true,
      progress_callback: reportProgress,
    }).catch((err) => {
      // Never cache a rejected promise — the next attempt should retry the download.
      transcriberPromise = null
      modelFiles.clear()
      throw err
    })
  }

  const transcriber = await transcriberPromise
  post({ type: 'status', phase: 'model', progress: 1 })
  return transcriber
}

async function transcribe({ samples }) {
  const transcriber = await getTranscriber()

  // First inference has to build the ONNX session; say so instead of appearing stuck.
  post({ type: 'status', phase: 'warming' })

  const chunks = splitIntoChunks(samples, {
    chunkSeconds: CHUNK_SECONDS,
    sampleRate: SAMPLE_RATE,
  })

  if (!chunks.length) {
    post({ type: 'done', text: '', captions: [] })
    return
  }

  let text = ''
  let offset = 0
  const captions = []

  for (let i = 0; i < chunks.length; i++) {
    post({
      type: 'status',
      phase: 'transcribing',
      progress: i / chunks.length,
      chunk: i + 1,
      chunks: chunks.length,
    })

    const chunk = chunks[i]
    const chunkSeconds = chunk.length / SAMPLE_RATE
    const output = await transcriber(chunk, {
      sampling_rate: SAMPLE_RATE,
      return_timestamps: true,
    })
    const piece = (output?.text || '').trim()

    if (piece) {
      text = text ? `${text} ${piece}` : piece
      post({ type: 'partial', text })
    }

    captions.push(...cuesFromModelOutput(output, offset, chunkSeconds))
    offset += chunkSeconds

    post({
      type: 'status',
      phase: 'transcribing',
      progress: (i + 1) / chunks.length,
      chunk: i + 1,
      chunks: chunks.length,
    })
  }

  post({ type: 'done', text: text.trim(), captions })
}

async function resetModel() {
  transcriberPromise = null
  modelFiles.clear()
  lastReported = -1
  try {
    await caches.delete(CACHE_NAME)
  } catch {
    // Cache API unavailable — the in-memory instance is gone either way.
  }
  post({ type: 'reset-done' })
}

self.onmessage = async (event) => {
  const { type } = event.data || {}

  try {
    if (type === 'transcribe') {
      await transcribe(event.data)
    } else if (type === 'warm') {
      await getTranscriber()
    } else if (type === 'reset') {
      await resetModel()
    } else if (type === 'ping') {
      post({ type: 'pong' })
    }
  } catch (err) {
    post({
      type: 'error',
      message: err?.message || 'Transcription failed.',
      detail: String(err?.stack || ''),
    })
  }
}
