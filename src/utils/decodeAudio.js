import { SAMPLE_RATE } from '../constants'

function getOfflineContext(length, sampleRate) {
  const Ctor = window.OfflineAudioContext || window.webkitOfflineAudioContext
  if (!Ctor) throw new Error('This browser cannot decode audio.')
  return new Ctor(1, length, sampleRate)
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
 * thing Whisper accepts.
 *
 * The decoding context is created at 16 kHz on purpose: the browser resamples
 * while decoding, which is faster and higher quality than doing it by hand.
 */
export async function decodeToMono16k(blob) {
  if (!blob || !blob.size) throw new Error('That file is empty.')

  const arrayBuffer = await blob.arrayBuffer()
  const context = getOfflineContext(1, SAMPLE_RATE)

  let buffer
  try {
    buffer = await decodeCompat(context, arrayBuffer)
  } catch {
    throw new Error(
      'This audio could not be decoded. The format may not be supported on this device.',
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
    el.preload = 'metadata'

    const done = (value) => {
      URL.revokeObjectURL(url)
      el.removeAttribute('src')
      resolve(Number.isFinite(value) && value > 0 ? value : 0)
    }

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
