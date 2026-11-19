import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearEntries,
  countEntries,
  createEntry,
  deleteEntry,
  findEntries,
  getEntry,
  getStorageUsage,
  importEntries,
  listEntries,
  updateEntry,
} from './storage'

const blobOf = (bytes = 100, type = 'audio/webm') =>
  new Blob([new Uint8Array(bytes)], { type })

beforeEach(async () => {
  await clearEntries()
})

describe('createEntry', () => {
  it('stores an entry with a title, timestamp id and default status', async () => {
    const entry = await createEntry({ type: 'audio', audioBlob: blobOf(), duration: 12 })

    expect(entry.id).toBeGreaterThan(0)
    expect(entry.uuid).toMatch(/^[0-9a-f-]{36}$/)
    expect(entry.createdAt).toBe(entry.id)
    expect(entry.title).toMatch(/\w{3} \d{1,2} \d{4} - \d{1,2}:\d{2} (AM|PM)/)
    expect(entry.status).toBe('transcribing')
    expect(entry.transcript).toBe('')
    expect(entry.videoBlob).toBeNull()

    const stored = await getEntry(entry.id)
    expect(stored.audioBlob.size).toBe(100)
    expect(stored.duration).toBe(12)
  })

  it('gives every entry a unique id even in the same millisecond', async () => {
    const a = await createEntry({ type: 'audio', audioBlob: blobOf() })
    const b = await createEntry({ type: 'audio', audioBlob: blobOf() })
    const c = await createEntry({ type: 'audio', audioBlob: blobOf() })

    expect(new Set([a.id, b.id, c.id]).size).toBe(3)
    expect(b.id).toBeGreaterThan(a.id)
    expect(c.id).toBeGreaterThan(b.id)
  })
})

describe('listEntries', () => {
  async function seed(count) {
    const created = []
    for (let i = 0; i < count; i++) {
      created.push(await createEntry({ type: 'audio', audioBlob: blobOf(), duration: i }))
    }
    return created
  }

  it('returns newest first', async () => {
    const created = await seed(3)
    const { entries } = await listEntries()
    expect(entries.map((e) => e.id)).toEqual([
      created[2].id,
      created[1].id,
      created[0].id,
    ])
  })

  it('paginates without repeating or skipping', async () => {
    const created = await seed(25)

    const page1 = await listEntries({ limit: 10 })
    expect(page1.entries).toHaveLength(10)
    expect(page1.hasMore).toBe(true)

    const page2 = await listEntries({ beforeId: page1.entries.at(-1).id, limit: 10 })
    expect(page2.entries).toHaveLength(10)
    expect(page2.hasMore).toBe(true)

    const page3 = await listEntries({ beforeId: page2.entries.at(-1).id, limit: 10 })
    expect(page3.entries).toHaveLength(5)
    expect(page3.hasMore).toBe(false)

    const ids = [...page1.entries, ...page2.entries, ...page3.entries].map((e) => e.id)
    expect(new Set(ids).size).toBe(25)
    expect(ids).toEqual(created.map((e) => e.id).reverse())
  })

  it('handles an empty store', async () => {
    const result = await listEntries()
    expect(result.entries).toEqual([])
    expect(result.hasMore).toBe(false)
  })
})

describe('updateEntry', () => {
  it('merges a patch and keeps identity fields', async () => {
    const entry = await createEntry({ type: 'audio', audioBlob: blobOf() })
    const updated = await updateEntry(entry.id, {
      transcript: 'Hello there.',
      status: 'done',
      id: 999999,
    })

    expect(updated.transcript).toBe('Hello there.')
    expect(updated.status).toBe('done')
    expect(updated.id).toBe(entry.id)
    expect(updated.audioBlob.size).toBe(100)

    const stored = await getEntry(entry.id)
    expect(stored.status).toBe('done')
  })

  it('returns null for a missing entry', async () => {
    expect(await updateEntry(123, { status: 'done' })).toBeNull()
  })
})

describe('deleteEntry / clearEntries', () => {
  it('removes a single entry', async () => {
    const a = await createEntry({ type: 'audio', audioBlob: blobOf() })
    const b = await createEntry({ type: 'audio', audioBlob: blobOf() })

    await deleteEntry(a.id)

    expect(await getEntry(a.id)).toBeUndefined()
    expect(await getEntry(b.id)).toBeDefined()
    expect(await countEntries()).toBe(1)
  })

  it('removes everything', async () => {
    await createEntry({ type: 'audio', audioBlob: blobOf() })
    await createEntry({ type: 'video', audioBlob: blobOf(), videoBlob: blobOf(500) })

    await clearEntries()

    expect(await countEntries()).toBe(0)
  })
})

describe('importEntries', () => {
  const backupEntry = (uuid, createdAt, extra = {}) => ({
    uuid,
    type: 'audio',
    title: `Entry ${uuid}`,
    transcript: `Transcript ${uuid}`,
    duration: 12,
    createdAt,
    updatedAt: createdAt,
    status: 'done',
    audioBlob: new Blob([uuid], { type: 'audio/webm' }),
    videoBlob: null,
    ...extra,
  })

  it('restores a backup with new local ids', async () => {
    const result = await importEntries(
      [backupEntry('one', 1000), backupEntry('two', 2000)],
      { replace: true },
    )

    expect(result).toEqual({ added: 2, skipped: 0 })
    const { entries } = await listEntries()
    expect(entries.map((entry) => entry.uuid)).toEqual(['two', 'one'])
    expect(entries[0].audioBlob).toBeDefined()
    expect(entries[0].transcript).toBe('Transcript two')
  })

  it('merges new entries and skips matching uuids', async () => {
    await importEntries(
      [backupEntry('one', 1000), backupEntry('two', 2000)],
      { replace: true },
    )

    const result = await importEntries([
      backupEntry('two', 2000),
      backupEntry('three', 3000),
    ])

    expect(result).toEqual({ added: 1, skipped: 1 })
    expect(await countEntries()).toBe(3)
  })

  it('moves colliding timestamps forward without overwriting', async () => {
    await importEntries([backupEntry('one', 5000)], { replace: true })
    await importEntries([backupEntry('two', 5000)])

    const { entries } = await listEntries()
    expect(entries).toHaveLength(2)
    expect(new Set(entries.map((entry) => entry.id)).size).toBe(2)
  })
})

describe('findEntries', () => {
  it('returns matching entries newest first and caps the result', async () => {
    await createEntry({ type: 'audio', audioBlob: blobOf() })
    await createEntry({ type: 'audio', audioBlob: blobOf(), transcript: 'river walk' })
    await createEntry({ type: 'audio', audioBlob: blobOf() })

    const result = await findEntries((entry) => entry.transcript === 'river walk')
    expect(result.entries).toHaveLength(1)
    expect(result.entries[0].transcript).toBe('river walk')
    expect(result.hasMore).toBe(false)

    const limited = await findEntries(() => true, { limit: 2 })
    expect(limited.entries).toHaveLength(2)
    expect(limited.hasMore).toBe(true)
  })
})

describe('getStorageUsage', () => {
  it('sums audio and video blob sizes', async () => {
    await createEntry({ type: 'audio', audioBlob: blobOf(300) })
    await createEntry({ type: 'video', audioBlob: blobOf(200), videoBlob: blobOf(1000) })

    const usage = await getStorageUsage()
    expect(usage.entries).toBe(2)
    expect(usage.bytes).toBe(1500)
  })
})
