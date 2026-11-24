import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { clearEntries, createEntry, getEntry } from './storage'
import { transcribe } from './transcriberClient'
import { transcribeEntry } from './journal'

vi.mock('./transcriberClient', () => ({
  transcribe: vi.fn(),
}))

function audioEntry(overrides = {}) {
  return createEntry({
    type: 'audio',
    audioBlob: new Blob(['audio bytes'], { type: 'audio/webm' }),
    ...overrides,
  })
}

beforeEach(async () => {
  await clearEntries()
  vi.mocked(transcribe).mockReset()
})

describe('transcribeEntry', () => {
  test('stores the transcript and timed captions', async () => {
    const captions = [{ start: 0.2, end: 1.1, text: 'Hello there.' }]
    vi.mocked(transcribe).mockResolvedValue({ text: 'Hello there.', captions })
    const entry = await audioEntry()

    await expect(transcribeEntry(entry)).resolves.toBe('Hello there.')

    const stored = await getEntry(entry.id)
    expect(stored.status).toBe('done')
    expect(stored.transcript).toBe('Hello there.')
    expect(stored.captions).toEqual(captions)
    expect(stored.error).toBeNull()
  })

  test('records why an empty transcription failed', async () => {
    vi.mocked(transcribe).mockResolvedValue({ text: '', captions: [] })
    const entry = await audioEntry()

    await expect(transcribeEntry(entry)).rejects.toThrow(/no speech/i)

    const stored = await getEntry(entry.id)
    expect(stored.status).toBe('error')
    expect(stored.error).toMatch(/no speech/i)
    expect(stored.captions).toEqual([])
  })

  test('keeps the underlying error on the entry', async () => {
    vi.mocked(transcribe).mockRejectedValue(new Error('This audio could not be decoded.'))
    const entry = await audioEntry()

    await expect(transcribeEntry(entry)).rejects.toThrow(/could not be decoded/i)

    const stored = await getEntry(entry.id)
    expect(stored.status).toBe('error')
    expect(stored.error).toBe('This audio could not be decoded.')
  })

  test('does not call the model when there is no audio', async () => {
    const entry = await audioEntry()

    await expect(transcribeEntry({ ...entry, audioBlob: null })).rejects.toThrow(/no audio/i)
    expect(transcribe).not.toHaveBeenCalled()
  })
})
