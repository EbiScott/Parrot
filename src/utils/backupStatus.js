const KEY = 'parrot:last-backup-at'
const DAY = 86400000

function storageOrNull(storage) {
  if (storage) return storage
  try {
    return globalThis.localStorage || null
  } catch {
    return null
  }
}

export function getLastBackupAt(storage = null) {
  try {
    const raw = storageOrNull(storage)?.getItem(KEY)
    const value = Number(raw)
    return Number.isFinite(value) && value > 0 ? value : null
  } catch {
    return null
  }
}

export function recordBackup(at = Date.now(), storage = null) {
  try {
    storageOrNull(storage)?.setItem(KEY, String(at))
  } catch {
    return at
  }
  return at
}

export function shouldPromptBackup({
  entryCount,
  lastBackupAt,
  now = Date.now(),
  minEntries = 3,
  maxAgeDays = 30,
}) {
  if (Number(entryCount) < minEntries) return false
  if (!lastBackupAt) return true
  return now - Number(lastBackupAt) >= maxAgeDays * DAY
}
