function normalize(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

export function searchEntries(entries, query) {
  return (entries || []).filter((entry) => matchesSearch(entry, query))
}

export function matchesSearch(entry, query) {
  const terms = normalize(query).trim().split(/\s+/).filter(Boolean)
  if (!terms.length) return false

  const haystack = normalize(`${entry?.title || ''} ${entry?.transcript || ''}`)
  return terms.every((term) => haystack.includes(term))
}
