import { describe, expect, test } from 'vitest'
import { extensionForMime, labelForBlob } from './media'

describe('media labels', () => {
  test('uses an mp4 extension for video mp4 recordings', () => {
    expect(extensionForMime('video/mp4')).toBe('mp4')
    expect(labelForBlob({ type: 'video/mp4' }, 'parrot-1')).toBe('parrot-1.mp4')
  })

  test('keeps an audio extension for audio mp4 recordings', () => {
    expect(extensionForMime('audio/mp4')).toBe('m4a')
  })

  test('falls back to bin for unknown types', () => {
    expect(extensionForMime('application/octet-stream')).toBe('bin')
  })
})
