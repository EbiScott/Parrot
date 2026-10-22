import { describe, expect, it } from 'vitest'
import { countWords, paragraphize, splitSentences } from './paragraphHelper'

describe('splitSentences', () => {
  it('splits on terminal punctuation', () => {
    expect(splitSentences('One. Two! Three?')).toEqual(['One.', 'Two!', 'Three?'])
  })

  it('keeps the final fragment without punctuation', () => {
    expect(splitSentences('First one. And then a trailing bit')).toEqual([
      'First one.',
      'And then a trailing bit',
    ])
  })

  it('does not split on abbreviations', () => {
    const text = 'I spoke to Dr. Bello about it. He agreed.'
    expect(splitSentences(text)).toEqual(['I spoke to Dr. Bello about it.', 'He agreed.'])
  })

  it('does not split on initials or dotted abbreviations', () => {
    expect(splitSentences('My name is J. Smith. Nice to meet you.')).toHaveLength(2)
    expect(splitSentences('I moved to the U.S. in 2019. It was cold.')).toHaveLength(2)
  })

  it('keeps decimals intact', () => {
    expect(splitSentences('It cost 3.5 million.')).toEqual(['It cost 3.5 million.'])
  })

  it('collapses whitespace and handles empty input', () => {
    expect(splitSentences('  a   b  ')).toEqual(['a b'])
    expect(splitSentences('')).toEqual([])
    expect(splitSentences(null)).toEqual([])
  })

  it('never rewrites the words themselves', () => {
    const text = 'i dey go market. e go cost me.'
    expect(splitSentences(text).join(' ')).toBe(text)
  })
})

describe('paragraphize', () => {
  it('groups four sentences per paragraph', () => {
    const text = 'One. Two. Three. Four. Five. Six. Seven. Eight.'
    expect(paragraphize(text)).toBe('One. Two. Three. Four.\n\nFive. Six. Seven. Eight.')
  })

  it('leaves short transcripts alone', () => {
    expect(paragraphize('Just one sentence.')).toBe('Just one sentence.')
  })

  it('breaks early on a long run', () => {
    const long = `${'word '.repeat(80).trim()}.`
    const text = `${long} ${long} ${long} ${long}`
    const paragraphs = paragraphize(text).split('\n\n')
    expect(paragraphs.length).toBeGreaterThan(1)
  })

  it('returns empty for empty input', () => {
    expect(paragraphize('')).toBe('')
    expect(paragraphize(null)).toBe('')
  })

  it('preserves every word', () => {
    const text = 'a. b. c. d. e. f. g. h.'
    const flattened = paragraphize(text).split('\n\n').join(' ')
    expect(flattened).toBe(text)
  })
})

describe('countWords', () => {
  it('counts words', () => {
    expect(countWords('one two three')).toBe(3)
    expect(countWords('   ')).toBe(0)
    expect(countWords('')).toBe(0)
  })
})
