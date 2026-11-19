import { describe, expect, test } from 'vitest'
import {
  getLastBackupAt,
  recordBackup,
  shouldPromptBackup,
} from './backupStatus'

function memoryStorage(initial = {}) {
  const values = { ...initial }
  return {
    getItem: (key) => values[key] ?? null,
    setItem: (key, value) => {
      values[key] = String(value)
    },
  }
}

describe('backup status', () => {
  test('reads and writes the last backup timestamp', () => {
    const storage = memoryStorage()
    expect(getLastBackupAt(storage)).toBeNull()
    expect(recordBackup(1760690000000, storage)).toBe(1760690000000)
    expect(getLastBackupAt(storage)).toBe(1760690000000)
  })

  test('ignores missing or broken values', () => {
    expect(getLastBackupAt(memoryStorage({ 'parrot:last-backup-at': 'nope' }))).toBeNull()
    expect(getLastBackupAt(memoryStorage({ 'parrot:last-backup-at': '0' }))).toBeNull()
  })

  test('does not prompt for a tiny journal', () => {
    expect(
      shouldPromptBackup({ entryCount: 2, lastBackupAt: null, now: 1760690000000 }),
    ).toBe(false)
  })

  test('prompts when a journal has never been backed up', () => {
    expect(
      shouldPromptBackup({ entryCount: 3, lastBackupAt: null, now: 1760690000000 }),
    ).toBe(true)
  })

  test('prompts after thirty days', () => {
    const now = 1760690000000
    const thirtyOneDays = 31 * 86400000
    expect(
      shouldPromptBackup({ entryCount: 10, lastBackupAt: now - thirtyOneDays, now }),
    ).toBe(true)
    expect(
      shouldPromptBackup({ entryCount: 10, lastBackupAt: now - 2 * 86400000, now }),
    ).toBe(false)
  })
})
