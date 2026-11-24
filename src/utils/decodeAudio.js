import { SAMPLE_RATE } from '../constants'

function createStandaloneOfflineContext() {
  const Ctor = window.OfflineAudioContext || window.webkitOfflineAudioContext
  if (!Ctor) throw new Error('This browser cannot decode audio.')
  return new Ctor(1, 1, 44100)
}

function createLiveContext() {
  const Ctor = window.AudioContext || window.webkitAudioContext
  if (!Ctor) throw new Error('This browser cannot decode audio.')
  return new Ctor()
}

function closeContext(context) {
  try {
    const closing = context?.close?.()
    if (closing?.catch) closing.catch(() => {})
  } catch {
    // A context that refuses to close is already gone or unusable.
  }
}

/**
 * Decode at a standard rate first, then resample ourselves. Decoding straight
 * into a 16 kHz context fails on some Safari/WebView builds and on a few
 * uploaded AAC containers even when normal playback works.
 */
async function decodeArrayBuffer(arrayBuffer) {
  const attempts = [createStandaloneOfflineContext, createLiveContext]
  let lastError = null

  for (const createContext of attempts) {
    let context = null
    try {
      context = createContext()
      return await decodeCompat(context, arrayBuffer.slice(0))
    } catch (err) {
      lastError = err
    } finally {
      closeContext(context)
    }
  }

  throw lastError || new Error('This browser cannot decode audio.')
}

/** Safari versions differ on whether decodeAudioData returns a promise. */
function decodeCompat(context, arrayBuffer) {
  return new Promise((resolve, reject) => {
    let settled = false
    const ok = (buffer) => {
      if (!settled) {
        settled = true
        resolve(buffer)
      }
    }
    const fail = (err) => {
      if (!settled) {
        settled = true
        reject(err instanceof Error ? err : new Error(String(err?.message || err)))
      }
    }

    try {
      const maybePromise = context.decodeAudioData(arrayBuffer, ok, fail)
      if (maybePromise && typeof maybePromise.then === 'function') {
        maybePromise.then(ok, fail)
      }
    } catch (err) {
      fail(err)
    }
  })
}

/** Straight-line resample. Only used if the browser hands back a different rate. */
function resampleLinear(input, fromRate, toRate) {
  if (fromRate === toRate) return input
  const ratio = fromRate / toRate
  const length = Math.max(1, Math.floor(input.length / ratio))
  const output = new Float32Array(length)

  for (let i = 0; i < length; i++) {
    const position = i * ratio
    const lower = Math.floor(position)
    const upper = Math.min(lower + 1, input.length - 1)
    const weight = position - lower
    output[i] = input[lower] * (1 - weight) + input[upper] * weight
  }

  return output
}

/**
 * Decode any recorded/uploaded blob into mono Float32 at 16 kHz — the only
 * thing the speech model accepts.
 *
 * Decoding happens at a standard browser rate, then the samples are downmixed
 * and resampled by hand. That avoids device-specific failures when a context is
 * created directly at 16 kHz.
 */
export async function decodeToMono16k(blob) {
  if (!blob || !blob.size) throw new Error('That file is empty.')

  const arrayBuffer = await blob.arrayBuffer()

  let buffer
  try {
    buffer = await decodeArrayBuffer(arrayBuffer)
  } catch {
    throw new Error(
      'This audio could not be decoded. Try WAV, MP3 or M4A, or play it once in a media player and upload again.',
    )
  }

  const channels = buffer.numberOfChannels
  let mono

  if (channels === 1) {
    mono = buffer.getChannelData(0)
  } else {
    const length = buffer.length
    mono = new Float32Array(length)
    for (let c = 0; c < channels; c++) {
      const data = buffer.getChannelData(c)
      for (let i = 0; i < length; i++) mono[i] += data[i]
    }
    for (let i = 0; i < length; i++) mono[i] /= channels
  }

  if (buffer.sampleRate !== SAMPLE_RATE) {
    mono = resampleLinear(mono, buffer.sampleRate, SAMPLE_RATE)
  }

  return { samples: mono, duration: buffer.duration }
}

/**
 * Read duration without decoding the whole file (used for uploads, where we
 * only need the number until transcription finishes).
 */
export function probeDuration(blob, kind = 'audio') {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob)
    const el = document.createElement(kind === 'video' ? 'video' : 'audio')
    let settled = false
    let timer = null

    el.preload = 'metadata'

    const done = (value) => {
      if (settled) return
      settled = true
      if (timer) clearTimeout(timer)
      URL.revokeObjectURL(url)
      el.removeAttribute('src')
      resolve(Number.isFinite(value) && value > 0 ? value : 0)
    }

    // Some mobile browsers never fire metadata events for a detached element.
    // Duration is optional, so do not let a probe block the import.
    timer = setTimeout(() => done(0), 5000)
    el.onloadedmetadata = () => done(el.duration)
    el.onerror = () => done(0)
    el.src = url
  })
}

/** Cheap duration for a media blob, preferring the browser's metadata. */
export async function getDuration(blob, kind = 'audio') {
  const fromMetadata = await probeDuration(blob, kind)
  if (fromMetadata > 0 && Number.isFinite(fromMetadata)) return fromMetadata

  try {
    const { duration } = await decodeToMono16k(blob)
    return Number.isFinite(duration) ? duration : 0
  } catch {
    return 0
  }
}
