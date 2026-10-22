/**
 * Pure helpers for slicing audio for the model. Kept free of browser APIs so
 * both the worker and the tests can import it.
 */

function rms(samples, start, length) {
  const end = Math.min(start + length, samples.length)
  const count = end - start
  if (count <= 0) return 0

  let sum = 0
  for (let i = start; i < end; i++) {
    const v = samples[i]
    sum += v * v
  }
  return Math.sqrt(sum / count)
}

/**
 * Find the quietest moment within `radius` samples of `center`.
 *
 * Cutting a 30 s window mid-word is the classic way to lose a syllable, so we
 * slide the cut to the lowest-energy point nearby instead. No overlap window
 * means no duplicated words to clean up afterwards.
 */
export function findQuietPoint(samples, center, radius, sampleRate = 16000) {
  const windowSize = Math.max(1, Math.floor(sampleRate * 0.05))
  const step = Math.max(1, Math.floor(windowSize / 2))
  const from = Math.max(1, center - radius)
  const to = Math.min(samples.length - windowSize - 1, center + radius)

  let bestStart = center
  let best = Infinity

  for (let start = from; start <= to; start += step) {
    const energy = rms(samples, start, windowSize)
    if (energy < best) {
      best = energy
      bestStart = start
    }
  }

  // Cut in the middle of the quietest window.
  return bestStart + Math.floor(windowSize / 2)
}

/**
 * Split into <= chunkSeconds pieces. Each boundary is nudged to the quietest
 * nearby point. Short recordings come back as a single chunk.
 */
export function splitIntoChunks(
  samples,
  { chunkSeconds = 30, sampleRate = 16000, searchSeconds = 0.8, minSeconds = 1 } = {},
) {
  if (!samples || samples.length === 0) return []

  const target = Math.floor(chunkSeconds * sampleRate)
  const minChunk = Math.floor(minSeconds * sampleRate)
  if (samples.length <= target * 1.25) return [samples]

  const chunks = []
  let start = 0

  while (start < samples.length) {
    if (start + target >= samples.length) {
      chunks.push(samples.subarray(start))
      break
    }

    let end = findQuietPoint(samples, start + target, Math.floor(searchSeconds * sampleRate), sampleRate)
    if (end - start < minChunk) end = start + minChunk
    if (end >= samples.length) end = samples.length

    chunks.push(samples.subarray(start, end))
    start = end
  }

  return chunks
}

/**
 * Bucket the waveform into `buckets` peak values (0..1) for the player bars.
 */
export function computePeaks(samples, buckets = 64) {
  const peaks = new Array(buckets).fill(0)
  if (!samples || !samples.length) return peaks

  const perBucket = Math.max(1, Math.floor(samples.length / buckets))
  let max = 0.0001

  for (let b = 0; b < buckets; b++) {
    const start = b * perBucket
    const end = Math.min(start + perBucket, samples.length)
    let peak = 0
    for (let i = start; i < end; i++) {
      const v = Math.abs(samples[i])
      if (v > peak) peak = v
    }
    peaks[b] = peak
    if (peak > max) max = peak
  }

  // Normalise so quiet recordings still show a visible shape.
  return peaks.map((p) => Math.min(1, p / max))
}
