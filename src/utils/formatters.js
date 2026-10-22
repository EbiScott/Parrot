const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function toDate(value) {
  return value instanceof Date ? value : new Date(value)
}

/** "3:42 PM" */
export function formatTime(value) {
  const d = toDate(value)
  let hours = d.getHours()
  const minutes = String(d.getMinutes()).padStart(2, '0')
  const suffix = hours >= 12 ? 'PM' : 'AM'
  hours = hours % 12 || 12
  return `${hours}:${minutes} ${suffix}`
}

/** "Oct 17 2026 - 3:42 PM" — the entry title. */
export function formatEntryTitle(value) {
  const d = toDate(value)
  return `${MONTHS[d.getMonth()]} ${d.getDate()} ${d.getFullYear()} - ${formatTime(d)}`
}

/** Compact duration for badges: "34s", "2m 34s", "1h 5m". */
export function formatDuration(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0))
  if (total < 60) return `${total}s`

  const minutes = Math.floor(total / 60)
  const restSeconds = total % 60
  if (minutes < 60) return restSeconds ? `${minutes}m ${restSeconds}s` : `${minutes}m`

  const hours = Math.floor(minutes / 60)
  const restMinutes = minutes % 60
  return restMinutes ? `${hours}h ${restMinutes}m` : `${hours}h`
}

/** Running timer: always "00:00:00". */
export function formatClock(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':')
}

/** Playback position: "2:34" (or "1:02:34" once past an hour). */
export function formatPlaybackTime(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = String(total % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`
}

export function formatFileSize(bytes) {
  const n = Number(bytes) || 0
  if (n < 1024) return `${n} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = n / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`
}

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

/**
 * Feed grouping label: "Today", "Yesterday", "Tuesday", or a date.
 */
export function formatFeedDate(value, now = new Date()) {
  const d = toDate(value)
  const dayDiff = Math.round((startOfDay(now) - startOfDay(d)) / 86400000)

  if (dayDiff === 0) return 'Today'
  if (dayDiff === 1) return 'Yesterday'
  if (dayDiff > 1 && dayDiff < 7) return WEEKDAYS[d.getDay()]
  if (d.getFullYear() === now.getFullYear()) return `${MONTHS[d.getMonth()]} ${d.getDate()}`
  return `${MONTHS[d.getMonth()]} ${d.getDate()} ${d.getFullYear()}`
}

/** "just now", "12m ago", "3h ago" — used while an entry is processing. */
export function formatRelativeTime(value, now = Date.now()) {
  const diff = Math.max(0, now - toDate(value).getTime())
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}
