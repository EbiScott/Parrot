import { describe, expect, test } from 'vitest'
import {
  cuesFromModelOutput,
  formatSrtTimestamp,
  formatVttTimestamp,
  subtitleFileName,
  toSrt,
  toVtt,
} from './subtitles'

describe('subtitle timestamps', () => {
  test('formats SRT and VTT clocks with milliseconds', () => {
    expect(formatSrtTimestamp(3661.234)).toBe('01:01:01,234')
    expect(formatVttTimestamp(3661.234)).toBe('01:01:01.234')
    expect(formatSrtTimestamp(-2)).toBe('00:00:00,000')
  })
})

describe('cuesFromModelOutput', () => {
  test('offsets model timestamps into the full recording', () => {
    const output = {
      text: ' Hello there. General Kenobi.',
      chunks: [
        { timestamp: [0.2, 1.4], text: ' Hello there.' },
        { timestamp: [1.5, 3.1], text: ' General Kenobi.' },
      ],
    }

    expect(cuesFromModelOutput(output, 30, 30)).toEqual([
      { start: 30.2, end: 31.4, text: 'Hello there.' },
      { start: 31.5, end: 33.1, text: 'General Kenobi.' },
    ])
  })

  test('falls back to one cue for the chunk when timestamps are missing', () => {
    expect(cuesFromModelOutput({ text: 'A whole chunk.' }, 60, 30)).toEqual([
      { start: 60, end: 90, text: 'A whole chunk.' },
    ])
  })

  test('handles an open-ended final timestamp', () => {
    const [cue] = cuesFromModelOutput(
      { chunks: [{ timestamp: [2, null], text: 'Keep talking' }] },
      0,
      30,
    )

    expect(cue.start).toBe(2)
    expect(cue.end).toBeGreaterThan(cue.start)
    expect(cue.end).toBeLessThanOrEqual(30)
  })
})

describe('subtitle files', () => {
  const cues = [
    { start: 0, end: 1.5, text: 'Hello\nworld' },
    { start: 2, end: 3.25, text: 'Second line' },
  ]

  test('writes a numbered SRT file', () => {
    expect(toSrt(cues)).toBe(
      '1\n00:00:00,000 --> 00:00:01,500\nHello world\n\n' +
        '2\n00:00:02,000 --> 00:00:03,250\nSecond line\n',
    )
  })

  test('writes a VTT file with a header', () => {
    expect(toVtt(cues)).toBe(
      'WEBVTT\n\n' +
        '00:00:00.000 --> 00:00:01.500\nHello world\n\n' +
        '00:00:02.000 --> 00:00:03.250\nSecond line\n',
    )
  })

  test('returns an empty string when there are no cues', () => {
    expect(toSrt([])).toBe('')
    expect(toVtt(null)).toBe('')
  })

  test('builds a recognizable file name', () => {
    expect(subtitleFileName({ id: 42, type: 'video' }, 'srt')).toBe('parrot-video-42.srt')
    expect(subtitleFileName({ uuid: 'entry-one', type: 'audio' }, 'vtt')).toBe(
      'parrot-journal-entry-one.vtt',
    )
  })
})
