import { describe, expect, test, vi } from 'vitest'
import { BackupError, backupFileName, createBackupBlob, readBackupFile } from './backup'

const PASS = 'correct horse battery staple'
const FAST = { iterations: 1000, chunkSize: 64 * 1024 }

function blobOf(text, type) {
  return new Blob([text], { type })
}

function entry(overrides = {}) {
  return {
    id: 1760690000000,
    uuid: 'entry-one',
    type: 'audio',
    title: 'Oct 17 2026 - 3:42 PM',
    transcript: 'A quiet thought.',
    duration: 154,
    createdAt: 1760690000000,
    updatedAt: 1760690001000,
    status: 'done',
    audioBlob: blobOf('audio bytes', 'audio/webm'),
    videoBlob: null,
    ...overrides,
  }
}

async function backupOf(entries) {
  return createBackupBlob(entries, PASS, FAST)
}

describe('backupFileName', () => {
  test('uses a dated, recognizable file name', () => {
    expect(backupFileName(new Date(2026, 10, 19))).toBe('parrot-backup-2026-11-19.parrot')
  })
})

describe('encrypted backups', () => {
  test('round-trips metadata, audio and video', async () => {
    const video = entry({
      uuid: 'entry-two',
      type: 'video',
      title: 'Oct 18 2026 - 9:10 AM',
      transcript: 'A video thought.',
      createdAt: 1760780000000,
      audioBlob: blobOf('video audio bytes', 'audio/webm'),
      videoBlob: blobOf('video picture bytes', 'video/webm'),
    })
    const blob = await backupOf([entry(), video])
    const restored = await readBackupFile(blob, PASS)

    expect(restored.entries).toHaveLength(2)
    expect(restored.entries[0]).toMatchObject({
      uuid: 'entry-one',
      type: 'audio',
      transcript: 'A quiet thought.',
      duration: 154,
      status: 'done',
    })
    expect(await restored.entries[0].audioBlob.text()).toBe('audio bytes')
    expect(restored.entries[1].videoBlob.type).toBe('video/webm')
    expect(await restored.entries[1].videoBlob.text()).toBe('video picture bytes')
  })

  test('splits large recordings into encrypted chunks', async () => {
    const large = 'x'.repeat(64 * 1024 * 2 + 517)
    const blob = await backupOf([
      entry({ audioBlob: blobOf(large, 'audio/webm') }),
    ])
    const progress = vi.fn()
    const restored = await readBackupFile(blob, PASS, { onProgress: progress })

    expect(await restored.entries[0].audioBlob.text()).toBe(large)
    expect(progress).toHaveBeenLastCalledWith({ done: 3, total: 3 })
  })

  test('rejects the wrong passphrase', async () => {
    const blob = await backupOf([entry()])
    await expect(readBackupFile(blob, 'not the passphrase')).rejects.toThrow(BackupError)
  })

  test('rejects a damaged file', async () => {
    const blob = await backupOf([entry()])
    const bytes = new Uint8Array(await blob.arrayBuffer())
    bytes[bytes.length - 5] ^= 0xff

    await expect(readBackupFile(new Blob([bytes]), PASS)).rejects.toThrow(BackupError)
  })

  test('refuses an empty backup and unsafe passphrases', async () => {
    await expect(backupOf([])).rejects.toThrow(/nothing to back up/i)
    await expect(createBackupBlob([entry()], '', FAST)).rejects.toThrow(/passphrase/i)
  })

  test('does not expose journal text in the raw file', async () => {
    const blob = await backupOf([entry()])
    const bytes = new Uint8Array(await blob.arrayBuffer())
    const raw = new TextDecoder().decode(bytes)
    expect(raw).not.toContain('A quiet thought.')
  })
})
