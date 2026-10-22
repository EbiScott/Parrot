import { describe, expect, it } from 'vitest'
import {
  formatClock,
  formatDuration,
  formatEntryTitle,
  formatFeedDate,
  formatFileSize,
  formatPlaybackTime,
  formatRelativeTime,
  formatTime,
} from './formatters'

describe('formatDuration', () => {
  it('shows seconds under a minute', () => {
    expect(formatDuration(0)).toBe('0s')
    expect(formatDuration(34)).toBe('34s')
    expect(formatDuration(59.4)).toBe('59s')
  })

  it('shows minutes and seconds', () => {
    expect(formatDuration(60)).toBe('1m')
    expect(formatDuration(154)).toBe('2m 34s')
    expect(formatDuration(3599)).toBe('59m 59s')
  })

  it('shows hours', () => {
    expect(formatDuration(3600)).toBe('1h')
    expect(formatDuration(3900)).toBe('1h 5m')
  })

  it('never goes negative', () => {
    expect(formatDuration(-10)).toBe('0s')
    expect(formatDuration(undefined)).toBe('0s')
  })
})

describe('formatClock', () => {
  it('always pads to hh:mm:ss', () => {
    expect(formatClock(0)).toBe('00:00:00')
    expect(formatClock(9)).toBe('00:00:09')
    expect(formatClock(61)).toBe('00:01:01')
    expect(formatClock(3661)).toBe('01:01:01')
  })
})

describe('formatPlaybackTime', () => {
  it('drops the hour until it is needed', () => {
    expect(formatPlaybackTime(5)).toBe('0:05')
    expect(formatPlaybackTime(154)).toBe('2:34')
    expect(formatPlaybackTime(3725)).toBe('1:02:05')
  })
})

describe('formatTime / formatEntryTitle', () => {
  it('renders 12 hour time', () => {
    const date = new Date(2026, 9, 17, 15, 42)
    expect(formatTime(date)).toBe('3:42 PM')
    expect(formatEntryTitle(date)).toBe('Oct 17 2026 - 3:42 PM')
  })

  it('handles midnight and noon', () => {
    expect(formatTime(new Date(2026, 0, 1, 0, 5))).toBe('12:05 AM')
    expect(formatTime(new Date(2026, 0, 1, 12, 5))).toBe('12:05 PM')
  })

  it('accepts timestamps as well as dates', () => {
    const date = new Date(2026, 9, 17, 15, 42)
    expect(formatEntryTitle(date.getTime())).toBe('Oct 17 2026 - 3:42 PM')
  })
})

describe('formatFeedDate', () => {
  const now = new Date(2026, 9, 22, 12, 0)

  it('labels today and yesterday', () => {
    expect(formatFeedDate(new Date(2026, 9, 22, 8, 0), now)).toBe('Today')
    expect(formatFeedDate(new Date(2026, 9, 21, 23, 0), now)).toBe('Yesterday')
  })

  it('uses the weekday inside the last week', () => {
    expect(formatFeedDate(new Date(2026, 9, 19, 9, 0), now)).toBe('Monday')
  })

  it('falls back to a date', () => {
    expect(formatFeedDate(new Date(2026, 8, 2, 9, 0), now)).toBe('Sep 2')
    expect(formatFeedDate(new Date(2025, 8, 2, 9, 0), now)).toBe('Sep 2 2025')
  })
})

describe('formatFileSize', () => {
  it('scales units', () => {
    expect(formatFileSize(0)).toBe('0 B')
    expect(formatFileSize(512)).toBe('512 B')
    expect(formatFileSize(1024)).toBe('1.0 KB')
    expect(formatFileSize(1024 * 1024 * 2.5)).toBe('2.5 MB')
    expect(formatFileSize(1024 * 1024 * 1024)).toBe('1.0 GB')
  })
})

describe('formatRelativeTime', () => {
  it('describes recent times', () => {
    const now = Date.now()
    expect(formatRelativeTime(now - 1000, now)).toBe('just now')
    expect(formatRelativeTime(now - 12 * 60000, now)).toBe('12m ago')
    expect(formatRelativeTime(now - 3 * 3600000, now)).toBe('3h ago')
    expect(formatRelativeTime(now - 2 * 86400000, now)).toBe('2d ago')
  })
})
