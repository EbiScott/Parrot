import { describe, expect, test } from 'vitest'
import { searchEntries } from './search'

const entries = [
  { id: 3, title: 'Oct 19 2026', transcript: 'A walk by the river.' },
  { id: 2, title: 'Oct 18 2026', transcript: 'Café notes and a long list.' },
  { id: 1, title: 'Oct 17 2026', transcript: 'A difficult conversation.' },
]

describe('searchEntries', () => {
  test('returns nothing for an empty query', () => {
    expect(searchEntries(entries, '')).toEqual([])
    expect(searchEntries(entries, '   ')).toEqual([])
  })

  test('matches transcript text regardless of case', () => {
    expect(searchEntries(entries, 'RIVER').map((entry) => entry.id)).toEqual([3])
  })

  test('ignores accents', () => {
    expect(searchEntries(entries, 'cafe').map((entry) => entry.id)).toEqual([2])
  })

  test('matches the entry title', () => {
    expect(searchEntries(entries, 'oct 17').map((entry) => entry.id)).toEqual([1])
  })

  test('requires every term to match', () => {
    expect(searchEntries(entries, 'walk river').map((entry) => entry.id)).toEqual([3])
    expect(searchEntries(entries, 'walk conversation')).toEqual([])
  })
})
