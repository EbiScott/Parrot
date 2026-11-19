import { describe, expect, test } from 'vitest'
import { downloadOptions } from './download'

const audio = { size: 10, type: 'audio/webm' }
const video = { size: 20, type: 'video/webm' }

describe('downloadOptions', () => {
  test('offers audio for an audio entry', () => {
    expect(downloadOptions({ type: 'audio', audioBlob: audio, videoBlob: null })).toEqual([
      { kind: 'audio', label: 'Download audio', blob: audio },
    ])
  })

  test('offers audio and video for a video entry', () => {
    expect(downloadOptions({ type: 'video', audioBlob: audio, videoBlob: video })).toEqual([
      { kind: 'audio', label: 'Download audio', blob: audio },
      { kind: 'video', label: 'Download video', blob: video },
    ])
  })

  test('never offers a video download without a video blob', () => {
    expect(downloadOptions({ type: 'video', audioBlob: audio, videoBlob: null })).toEqual([
      { kind: 'audio', label: 'Download audio', blob: audio },
    ])
  })

  test('returns nothing when no recording exists', () => {
    expect(downloadOptions({ type: 'text', audioBlob: null, videoBlob: null })).toEqual([])
    expect(downloadOptions(null)).toEqual([])
  })
})
