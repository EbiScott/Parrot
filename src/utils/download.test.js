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

  test('offers SRT and VTT when timed captions exist', () => {
    const options = downloadOptions({
      id: 42,
      type: 'video',
      audioBlob: audio,
      videoBlob: video,
      captions: [{ start: 0, end: 1.5, text: 'Hello.' }],
    })

    expect(options.map((option) => option.kind)).toEqual(['audio', 'video', 'srt', 'vtt'])
    expect(options[2].filename).toBe('parrot-video-42.srt')
    expect(options[3].filename).toBe('parrot-video-42.vtt')
  })
})
