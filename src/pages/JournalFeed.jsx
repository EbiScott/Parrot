import { useEffect, useState } from 'react'
import EntryCard from '../components/EntryCard'
import { PAGE_SIZE } from '../constants'
import { getIncompleteEntries, listEntries } from '../utils/storage'
import { groupEntries } from '../utils/entryUtils'

export default function JournalFeed({ onRecord, onOpen }) {
  const [entries, setEntries] = useState([])
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [incomplete, setIncomplete] = useState([])

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const result = await listEntries({ limit: PAGE_SIZE })
      setEntries(result.entries)
      setHasMore(result.hasMore)
      setIncomplete(await getIncompleteEntries())
    } catch (err) {
      setError(err.message || 'Could not open the journal.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const loadMore = async () => {
    if (!entries.length) return
    const result = await listEntries({ beforeId: entries[entries.length - 1].id, limit: PAGE_SIZE })
    setEntries((current) => [...current, ...result.entries])
    setHasMore(result.hasMore)
  }

  const groups = groupEntries(entries)

  return (
    <section className="page feed-page">
      <header className="page-head page-head--row">
        <div>
          <p className="eyebrow">Journal</p>
          <h1>Your voice, kept.</h1>
        </div>
        <button type="button" className="btn btn--solid" onClick={onRecord}>
          New entry
        </button>
      </header>

      {incomplete.length ? (
        <div className="notice notice--warn">
          {incomplete.length} {incomplete.length === 1 ? 'entry needs' : 'entries need'} attention.
          Open it to retry transcription.
        </div>
      ) : null}

      {loading ? <p className="quiet">Opening the journal…</p> : null}
      {error ? <p className="notice notice--error">{error}</p> : null}

      {!loading && !error && !entries.length ? (
        <div className="empty">
          <p className="empty__mark">“</p>
          <h2>Nothing recorded yet.</h2>
          <p>Start with one thought. It does not have to be tidy.</p>
          <button type="button" className="btn btn--solid" onClick={onRecord}>
            Record the first entry
          </button>
        </div>
      ) : null}

      {groups.map((group) => (
        <div className="feed-group" key={group.label}>
          <h2 className="feed-date">{group.label}</h2>
          <div className="feed-list">
            {group.entries.map((entry) => (
              <EntryCard key={entry.id} entry={entry} onOpen={onOpen} />
            ))}
          </div>
        </div>
      ))}

      {hasMore ? (
        <button type="button" className="btn btn--line btn--wide" onClick={loadMore}>
          Load older entries
        </button>
      ) : null}
    </section>
  )
}
