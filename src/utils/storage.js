/**
 * Everything lives in IndexedDB — recordings are Blobs, which IndexedDB stores
 * natively. No server, no sync, no size limit beyond the device.
 *
 * An entry looks like:
 *   {
 *     id:         number,   // epoch ms, also the primary key and the sort order
 *     type:       'audio' | 'video',
 *     title:      string,   // "Oct 17 2026 - 3:42 PM"
 *     audioBlob:  Blob,     // always present, even for video entries
 *     videoBlob:  Blob | null,
 *     transcript: string,
 *     duration:   number,   // seconds
 *     createdAt:  number,   // epoch ms (same as id)
 *     status:     'recording' | 'transcribing' | 'done' | 'error'
 *   }
 */
import { openDB } from 'idb'
import { formatEntryTitle } from './formatters'

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
    type,
    title: formatEntryTitle(id),
    audioBlob,
    videoBlob,
    transcript,
    duration,
    createdAt: id,
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
  const updated = { ...existing, ...patch, id: existing.id, createdAt: existing.createdAt }
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

/** Entries that never finished transcribing — shown with a retry action. */
export async function getIncompleteEntries() {
  const all = await getAllEntries()
  return all.filter((e) => e.status === 'transcribing' || e.status === 'recording' || e.status === 'error')
}

export async function clearEntries() {
  const db = await getDB()
  await db.clear(STORE)
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
