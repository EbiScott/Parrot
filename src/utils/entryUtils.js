import { paragraphize } from './paragraphHelper'
import { formatFeedDate } from './formatters'

const AUDIO_EXT = /\.(mp3|wav|m4a|aac|ogg|oga|opus|flac)$/i
const VIDEO_EXT = /\.(mp4|mov|m4v|webm|ogv)$/i

export function fileKind(file) {
  const type = String(file?.type || '')
  if (type.startsWith('audio/')) return 'audio'
  if (type.startsWith('video/')) return 'video'

  const name = String(file?.name || '')
  if (AUDIO_EXT.test(name)) return 'audio'
  if (VIDEO_EXT.test(name)) return 'video'
  return null
}

export function normalizeTranscript(text) {
  return paragraphize(text)
}

export function groupEntries(entries, now = new Date()) {
  const groups = []
  for (const entry of entries) {
    const label = formatFeedDate(entry.createdAt, now)
    const last = groups[groups.length - 1]
    if (last && last.label === label) last.entries.push(entry)
    else groups.push({ label, entries: [entry] })
  }
  return groups
}

export function isIncomplete(entry) {
  return entry?.status === 'error' || entry?.status === 'transcribing' || entry?.status === 'recording'
}
