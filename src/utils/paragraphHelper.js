/**
 * Turns a raw transcript into readable paragraphs.
 *
 * The speech model hands back one long run of text. Splitting on sentence boundaries and
 * grouping 3–4 sentences per paragraph is enough to make it scannable — no model
 * needed. The text itself is never altered: no spell-check, no grammar pass.
 */

const ABBREVIATIONS = new Set([
  'mr', 'mrs', 'ms', 'dr', 'prof', 'sr', 'jr', 'st', 'vs', 'etc',
  'no', 'nos', 'mt', 'ft', 'inc', 'ltd', 'co', 'dept', 'est',
  'jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'aug', 'sep', 'sept', 'oct', 'nov', 'dec',
  'a.m', 'p.m', 'am', 'pm',
])

/** "U.S.", "e.g.", "i.e." — dotted abbreviations that end with a period. */
const DOTTED = /^([A-Za-z]\.)+[A-Za-z]?$/

function isSentenceEnd(token) {
  if (!/[.!?]+["'”’)\]]?$/.test(token)) return false

  // Strip the trailing punctuation and any closing quote/bracket.
  const bare = token.replace(/[.!?]+["'”’)\]]?$/, '')
  if (!bare) return false

  // Decimals and version numbers ("3.5", "2.0") are not sentence ends.
  if (/^\d+\.\d+$/.test(bare)) return false

  if (ABBREVIATIONS.has(bare.toLowerCase())) return false
  if (DOTTED.test(bare)) return false

  // A single capital letter is an initial ("J. Smith"), not an ending.
  if (/^[A-Z]$/.test(bare)) return false

  return true
}

/** Split text into sentences, preserving the original wording exactly. */
export function splitSentences(text) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim()
  if (!clean) return []

  const sentences = []
  let buffer = ''

  for (const token of clean.split(' ')) {
    buffer = buffer ? `${buffer} ${token}` : token
    if (isSentenceEnd(token)) {
      sentences.push(buffer)
      buffer = ''
    }
  }

  if (buffer) sentences.push(buffer)
  return sentences
}

/**
 * Group sentences into paragraphs of 3–4.
 *
 * A paragraph also closes early if it grows past `maxChars`, which keeps very
 * long run-on sentences from producing a wall of text.
 */
export function paragraphize(text, { sentencesPerParagraph = 4, maxChars = 420 } = {}) {
  const sentences = splitSentences(text)
  if (!sentences.length) return ''

  const paragraphs = []
  let current = []

  for (const sentence of sentences) {
    const candidate = [...current, sentence].join(' ')
    const wouldOverflowCount = current.length + 1 > sentencesPerParagraph
    const wouldOverflowLength = current.length >= 3 && candidate.length > maxChars

    if (wouldOverflowCount || wouldOverflowLength) {
      paragraphs.push(current.join(' '))
      current = [sentence]
    } else {
      current.push(sentence)
    }
  }

  if (current.length) paragraphs.push(current.join(' '))
  return paragraphs.join('\n\n')
}

/** Cheap word count for the UI. */
export function countWords(text) {
  const clean = String(text || '').trim()
  return clean ? clean.split(/\s+/).length : 0
}
