const MIN_CUE_SECONDS = 0.6
const WORDS_PER_SECOND = 2.5

function asFinite(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function pad(value, size) {
  return String(value).padStart(size, '0')
}

function clockParts(seconds) {
  const totalMs = Number.isFinite(seconds) ? Math.max(0, Math.round(seconds * 1000)) : 0
  return {
    hours: Math.floor(totalMs / 3600000),
    minutes: Math.floor((totalMs % 3600000) / 60000),
    seconds: Math.floor((totalMs % 60000) / 1000),
    millis: totalMs % 1000,
  }
}

export function formatSrtTimestamp(value) {
  const { hours, minutes, seconds, millis } = clockParts(value)
  return `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(seconds, 2)},${pad(millis, 3)}`
}

export function formatVttTimestamp(value) {
  const { hours, minutes, seconds, millis } = clockParts(value)
  return `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(seconds, 2)}.${pad(millis, 3)}`
}

export function normalizeCues(cues) {
  if (!Array.isArray(cues)) return []

  return cues
    .map((cue) => {
      const start = asFinite(cue?.start)
      const end = asFinite(cue?.end)
      const text = cleanText(cue?.text)
      if (start === null || !text) return null
      return {
        start: Math.max(0, start),
        end: Math.max(0, end ?? start + MIN_CUE_SECONDS),
        text,
      }
    })
    .filter(Boolean)
    .map((cue) => ({
      ...cue,
      end: Math.max(cue.start + MIN_CUE_SECONDS, cue.end),
    }))
    .sort((a, b) => a.start - b.start || a.end - b.end)
}

export function cuesFromModelOutput(output, offsetSeconds = 0, chunkSeconds = 0) {
  const offset = Math.max(0, asFinite(offsetSeconds) ?? 0)
  const span = Math.max(0, asFinite(chunkSeconds) ?? 0)
  const limit = span > 0 ? offset + span : Infinity
  const pieces = Array.isArray(output?.chunks) ? output.chunks : []
  const cues = []

  for (const piece of pieces) {
    const text = cleanText(piece?.text)
    if (!text) continue

    const timestamp = Array.isArray(piece?.timestamp) ? piece.timestamp : []
    const relativeStart = asFinite(timestamp[0])
    if (relativeStart === null) continue

    const relativeEnd = asFinite(timestamp[1])
    const start = Math.max(0, offset + relativeStart)
    const estimated = Math.max(
      MIN_CUE_SECONDS,
      0.4 + text.split(/\s+/).filter(Boolean).length / WORDS_PER_SECOND,
    )
    let end = relativeEnd === null ? Math.min(limit, start + estimated) : offset + relativeEnd
    if (!Number.isFinite(end)) end = start + estimated
    end = Math.max(start + MIN_CUE_SECONDS, end)
    if (Number.isFinite(limit)) {
      end = Math.min(end, Math.max(start + MIN_CUE_SECONDS, limit))
    }

    cues.push({ start, end, text })
  }

  if (!cues.length) {
    const text = cleanText(output?.text)
    if (text) {
      cues.push({
        start: offset,
        end: offset + Math.max(MIN_CUE_SECONDS, span || MIN_CUE_SECONDS),
        text,
      })
    }
  }

  return normalizeCues(cues)
}

export function toSrt(cues) {
  const normalized = normalizeCues(cues)
  if (!normalized.length) return ''

  return normalized
    .map(
      (cue, index) =>
        `${index + 1}\n${formatSrtTimestamp(cue.start)} --> ${formatSrtTimestamp(cue.end)}\n${cue.text}\n`,
    )
    .join('\n')
}

export function toVtt(cues) {
  const normalized = normalizeCues(cues)
  if (!normalized.length) return ''

  return `WEBVTT\n\n${normalized
    .map(
      (cue) =>
        `${formatVttTimestamp(cue.start)} --> ${formatVttTimestamp(cue.end)}\n${cue.text}\n`,
    )
    .join('\n')}`
}

export function subtitleFileName(entry, extension) {
  const identity = entry?.id ?? entry?.uuid ?? 'entry'
  const type = entry?.type === 'video' ? 'video' : 'journal'
  return `parrot-${type}-${identity}.${extension}`
}
