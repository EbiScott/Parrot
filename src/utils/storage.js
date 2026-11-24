/**
 * Everything lives in IndexedDB — recordings are Blobs, which IndexedDB stores
 * natively. No server, no sync, no size limit beyond the device.
 *
 * An entry looks like:
 *   {
 *     id:         number,   // epoch ms, also the primary key and the sort order
 *     uuid:       string,   // stable identity for backups and imports
 *     type:       'audio' | 'video',
 *     title:      string,   // "Oct 17 2026 - 3:42 PM"
 *     audioBlob:  Blob,     // always present, even for video entries
 *     videoBlob:  Blob | null,
 *     transcript: string,
 *     captions:   Array,    // [{ start, end, text }] in seconds
 *     duration:   number,   // seconds
 *     createdAt:  number,   // epoch ms (same as id)
 *     updatedAt:  number,
 *     status:     'recording' | 'transcribing' | 'done' | 'error'
 *   }
 */
import { openDB } from 'idb'
import { formatEntryTitle } from './formatters'
import { newUuid } from './ids'

const DB_NAME = 'parrot'
const DB_VERSION = 1
const STORE = 'entries'

let dbPromise = null

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'id' })
        }
      },
      blocking() {
        // Another tab wants to upgrade the schema: close so it can proceed.
        dbPromise?.then((db) => db.close())
        dbPromise = null
      },
    })
  }
  return dbPromise
}

/**
 * Ids are timestamps. Two entries created in the same millisecond would collide,
 * so step past the newest key if needed. This keeps id order == time order,
 * which lets us paginate with a plain key range and no secondary index.
 */
async function nextId(db) {
  const cursor = await db.transaction(STORE).store.openCursor(null, 'prev')
  const newest = cursor ? Number(cursor.key) : 0
  return Math.max(Date.now(), newest + 1)
}

export async function createEntry({
  type,
  audioBlob,
  videoBlob = null,
  duration = 0,
  transcript = '',
  status = 'transcribing',
}) {
  const db = await getDB()
  const id = await nextId(db)
  const entry = {
    id,
    uuid: newUuid(),
    type,
    title: formatEntryTitle(id),
    audioBlob,
    videoBlob,
    transcript,
    captions: [],
    duration,
    createdAt: id,
    updatedAt: id,
    status,
  }
  await db.put(STORE, entry)
  return entry
}

export async function getEntry(id) {
  const db = await getDB()
  return db.get(STORE, Number(id))
}

export async function updateEntry(id, patch) {
  const db = await getDB()
  const tx = db.transaction(STORE, 'readwrite')
  const existing = await tx.store.get(Number(id))
  if (!existing) {
    await tx.done
    return null
  }
  const updated = {
    ...existing,
    ...patch,
    id: existing.id,
    uuid: existing.uuid || newUuid(),
    createdAt: existing.createdAt,
    updatedAt: Date.now(),
  }
  await tx.store.put(updated)
  await tx.done
  return updated
}

export async function deleteEntry(id) {
  const db = await getDB()
  await db.delete(STORE, Number(id))
}

/**
 * Newest first. `beforeId` is the id of the last entry already shown, so the
 * next page starts strictly below it. Returns { entries, hasMore }.
 */
export async function listEntries({ beforeId = null, limit = 10 } = {}) {
  const db = await getDB()
  const tx = db.transaction(STORE)
  const range =
    beforeId === null || beforeId === undefined
      ? undefined
      : IDBKeyRange.upperBound(Number(beforeId), true)

  const entries = []
  let cursor = await tx.store.openCursor(range, 'prev')
  while (cursor && entries.length < limit + 1) {
    entries.push(cursor.value)
    cursor = await cursor.continue()
  }
  await tx.done

  const hasMore = entries.length > limit
  return { entries: hasMore ? entries.slice(0, limit) : entries, hasMore }
}

export async function getAllEntries() {
  const db = await getDB()
  const all = await db.getAll(STORE)
  return all.sort((a, b) => b.id - a.id)
}

export async function findEntries(predicate, { limit = 50 } = {}) {
  const db = await getDB()
  const tx = db.transaction(STORE)
  const entries = []
  let cursor = await tx.store.openCursor(null, 'prev')

  while (cursor && entries.length < limit + 1) {
    if (predicate(cursor.value)) entries.push(cursor.value)
    cursor = await cursor.continue()
  }
  await tx.done

  const hasMore = entries.length > limit
  return { entries: hasMore ? entries.slice(0, limit) : entries, hasMore }
}

/** Entries that never finished transcribing — shown with a retry action. */
export async function getIncompleteEntries() {
  const all = await getAllEntries()
  return all.filter((e) => e.status === 'transcribing' || e.status === 'recording' || e.status === 'error')
}

export async function clearEntries() {
  const db = await getDB()
  await db.clear(STORE)
}

export async function ensureUuids() {
  const db = await getDB()
  const tx = db.transaction(STORE, 'readwrite')
  let cursor = await tx.store.openCursor()

  while (cursor) {
    const entry = cursor.value
    if (!entry.uuid) {
      await cursor.update({
        ...entry,
        uuid: newUuid(),
        updatedAt: entry.updatedAt || entry.createdAt || Date.now(),
      })
    }
    cursor = await cursor.continue()
  }

  await tx.done
}

function nextAvailableId(preferred, used) {
  let id = Number(preferred) || Date.now()
  while (used.has(id)) id++
  used.add(id)
  return id
}

export async function importEntries(entries, { replace = false, onProgress } = {}) {
  if (!Array.isArray(entries) || !entries.length) return { added: 0, skipped: 0 }

  const db = await getDB()
  const tx = db.transaction(STORE, 'readwrite')
  const existing = await tx.store.getAll()

  if (replace) await tx.store.clear()

  const known = new Set()
  const usedIds = new Set()

  if (!replace) {
    for (const entry of existing) {
      const uuid = entry.uuid || newUuid()
      if (!entry.uuid) await tx.store.put({ ...entry, uuid })
      known.add(uuid)
      usedIds.add(entry.id)
    }
  }

  let added = 0
  let skipped = 0

  for (const source of entries) {
    const uuid = typeof source.uuid === 'string' && source.uuid ? source.uuid : newUuid()
    if (known.has(uuid)) {
      skipped++
      continue
    }

    const createdAt = Number(source.createdAt) || Date.now()
    const id = nextAvailableId(createdAt, usedIds)
    const entry = {
      ...source,
      id,
      uuid,
      createdAt,
      updatedAt: Number(source.updatedAt) || createdAt,
      title: source.title || formatEntryTitle(createdAt),
      audioBlob: source.audioBlob || null,
      videoBlob: source.videoBlob || null,
    }

    await tx.store.put(entry)
    known.add(uuid)
    added++
    onProgress?.({ done: added, total: entries.length })
  }

  await tx.done
  return { added, skipped }
}

export async function countEntries() {
  const db = await getDB()
  return db.count(STORE)
}

/** Sum of every stored blob, plus the entry count. */
export async function getStorageUsage() {
  const db = await getDB()
  let bytes = 0
  let entries = 0
  let cursor = await db.transaction(STORE).store.openCursor()

  while (cursor) {
    const entry = cursor.value
    entries++
    if (entry.audioBlob?.size) bytes += entry.audioBlob.size
    if (entry.videoBlob?.size) bytes += entry.videoBlob.size
    cursor = await cursor.continue()
  }

  return { bytes, entries }
}

/** Best-effort quota numbers from the browser (may be absent). */
export async function getQuotaEstimate() {
  if (!navigator.storage?.estimate) return null
  try {
    const { usage, quota } = await navigator.storage.estimate()
    return { usage: usage || 0, quota: quota || 0 }
  } catch {
    return null
  }
}

/** Test hook: drop the cached connection (used by unit tests). */
export function _resetConnection() {
  dbPromise = null
}
