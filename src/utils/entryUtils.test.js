import { describe, expect, it } from 'vitest'
import { fileKind, groupEntries, isIncomplete, normalizeTranscript } from './entryUtils'

describe('fileKind', () => {
  it('reads audio and video from the mime type', () => {
    expect(fileKind({ type: 'audio/webm' })).toBe('audio')
    expect(fileKind({ type: 'video/mp4' })).toBe('video')
  })

  it('falls back to the extension', () => {
    expect(fileKind({ type: '', name: 'note.mp3' })).toBe('audio')
    expect(fileKind({ type: '', name: 'clip.webm' })).toBe('video')
  })

  it('rejects unrelated files', () => {
    expect(fileKind({ type: 'text/plain', name: 'note.txt' })).toBe(null)
  })
})

describe('normalizeTranscript', () => {
  it('turns one run of text into paragraphs', () => {
    const text = 'One. Two. Three. Four. Five.'
    expect(normalizeTranscript(text)).toBe('One. Two. Three. Four.\n\nFive.')
  })

  it('returns an empty string for empty input', () => {
    expect(normalizeTranscript('')).toBe('')
  })
})

describe('groupEntries', () => {
  it('keeps entries in newest-first order and groups by day', () => {
    const now = new Date(2026, 9, 17, 12)
    const entries = [
      { id: 3, createdAt: new Date(2026, 9, 17, 9).getTime() },
      { id: 2, createdAt: new Date(2026, 9, 16, 9).getTime() },
      { id: 1, createdAt: new Date(2026, 9, 10, 9).getTime() },
    ]
    const groups = groupEntries(entries, now)
    expect(groups.map((g) => g.label)).toEqual(['Today', 'Yesterday', 'Oct 10'])
    expect(groups[0].entries[0].id).toBe(3)
  })
})

describe('isIncomplete', () => {
  it('flags unfinished statuses', () => {
    expect(isIncomplete({ status: 'error' })).toBe(true)
    expect(isIncomplete({ status: 'transcribing' })).toBe(true)
    expect(isIncomplete({ status: 'done' })).toBe(false)
  })
})
