/**
 * The transcription worker is a module-level singleton on purpose.
 *
 * If it belonged to a screen, leaving that screen mid-transcription would kill
 * the work. This way a recording keeps transcribing while you browse the feed,
 * and the promise still resolves so the entry gets its transcript.
 */
import { decodeToMono16k } from './decodeAudio'

const initialState = {
  phase: 'idle', // idle | decoding | model | warming | transcribing | done | error
  modelProgress: 0,
  modelReady: false,
  progress: 0,
  chunk: 0,
  chunks: 0,
  partial: '',
  captions: [],
  error: null,
}

let state = initialState
let worker = null
let pending = null
let resetJob = null
let activeJob = null
const queue = []
const listeners = new Set()

function setState(patch) {
  state = { ...state, ...patch }
  for (const listener of listeners) listener(state)
}

export function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getState() {
  return state
}

export function resetState() {
  state = initialState
  for (const listener of listeners) listener(state)
}

function ensureWorker() {
  if (worker) return worker

  worker = new Worker(new URL('../workers/transcriber.worker.js', import.meta.url), {
    type: 'module',
  })

  worker.onmessage = (event) => {
    const data = event.data || {}
    switch (data.type) {
      case 'status':
        if (data.phase === 'model') {
          const progress = data.progress ?? 1
          setState({
            phase: progress >= 1 && !pending && state.phase === 'model' ? 'idle' : state.phase,
            modelProgress: progress,
            modelReady: progress >= 1,
          })
        } else if (data.phase === 'warming') {
          setState({ phase: 'warming' })
        } else if (data.phase === 'transcribing') {
          setState({
            phase: 'transcribing',
            progress: data.progress ?? 0,
            chunk: data.chunk ?? 0,
            chunks: data.chunks ?? 0,
          })
        }
        break

      case 'partial':
        setState({ partial: data.text || '' })
        break

      case 'done': {
        const text = (data.text || '').trim()
        const captions = Array.isArray(data.captions) ? data.captions : []
        setState({ phase: 'done', progress: 1, partial: text, captions })
        pending?.resolve({ text, captions })
        pending = null
        break
      }

      case 'error':
        fail(data.message || 'Transcription failed.')
        break

      case 'reset-done':
        setState({ ...initialState })
        resetJob?.resolve()
        resetJob = null
        break

      default:
        break
    }
  }

  worker.onerror = (event) => {
    fail(event.message || 'The transcription engine stopped unexpectedly.')
  }

  return worker
}

function fail(message) {
  setState({ phase: 'error', error: message })
  pending?.reject(new Error(message))
  pending = null
  resetJob?.reject?.(new Error(message))
  resetJob = null
}

async function runTranscription(blob) {
  setState({
    phase: 'decoding',
    error: null,
    partial: '',
    captions: [],
    progress: 0,
    chunk: 0,
    chunks: 0,
  })

  try {
    const { samples } = await decodeToMono16k(blob)
    if (!samples.length) throw new Error('The recording was empty.')

    const workerInstance = ensureWorker()
    setState({ phase: state.modelReady ? 'warming' : 'model' })

    // Transfer the buffer instead of copying it — a 10 minute recording is ~38 MB.
    const owned =
      samples.byteOffset === 0 && samples.byteLength === samples.buffer.byteLength
        ? samples
        : samples.slice()

    return await new Promise((resolve, reject) => {
      pending = { resolve, reject }
      workerInstance.postMessage({ type: 'transcribe', samples: owned }, [owned.buffer])
    })
  } catch (error) {
    if (state.phase !== 'error') {
      fail(error?.message || 'That audio could not be read.')
    }
    throw error
  }
}

function drainQueue() {
  if (activeJob || !queue.length) return

  activeJob = queue.shift()
  runTranscription(activeJob.blob)
    .then(activeJob.resolve, activeJob.reject)
    .finally(() => {
      activeJob = null
      drainQueue()
    })
}

/**
 * Transcribe an audio (or video-with-audio) blob. Returns the raw text and
 * timed caption cues. Jobs are queued so importing or recording a second file
 * cannot cancel the first transcription with an "already running" error.
 */
export function transcribe(blob) {
  return new Promise((resolve, reject) => {
    queue.push({ blob, resolve, reject })
    drainQueue()
  })
}

/** Start downloading/loading the model without transcribing anything. */
export function preloadModel() {
  const workerInstance = ensureWorker()
  setState({ phase: 'model', error: null, modelProgress: state.modelProgress })
  workerInstance.postMessage({ type: 'warm' })
}

/** Forget the model and delete its cached files, so the next run re-downloads. */
export function resetModel() {
  const workerInstance = ensureWorker()
  return new Promise((resolve, reject) => {
    resetJob = { resolve, reject }
    workerInstance.postMessage({ type: 'reset' })
  })
}

export function clearError() {
  if (state.phase === 'error') setState({ phase: 'idle', error: null })
}
