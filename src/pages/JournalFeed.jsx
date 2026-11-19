import { useEffect, useState } from 'react'
import EntryCard from '../components/EntryCard'
import InstallCard from '../components/InstallCard'
import { CloseIcon, SearchIcon } from '../components/Icons'
import { PAGE_SIZE } from '../constants'
import { getLastBackupAt, shouldPromptBackup } from '../utils/backupStatus'
import {
  countEntries,
  findEntries,
  getIncompleteEntries,
  listEntries,
} from '../utils/storage'
import { groupEntries } from '../utils/entryUtils'
import { matchesSearch } from '../utils/search'

export default function JournalFeed({ onRecord, onOpen, onSettings }) {
  const [entries, setEntries] = useState([])
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [incomplete, setIncomplete] = useState([])
  const [backupDue, setBackupDue] = useState(false)
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState(null)
  const [searchHasMore, setSearchHasMore] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState('')
  const searchTerm = query.trim()

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const result = await listEntries({ limit: PAGE_SIZE })
      setEntries(result.entries)
      setHasMore(result.hasMore)
      setIncomplete(await getIncompleteEntries())
      setBackupDue(
        shouldPromptBackup({
          entryCount: await countEntries(),
          lastBackupAt: getLastBackupAt(),
        }),
      )
    } catch (err) {
      setError(err.message || 'Could not open the journal.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    if (!searchTerm) {
      setSearchResults(null)
      setSearchHasMore(false)
      setSearchError('')
      setSearchLoading(false)
      return undefined
    }

    let cancelled = false
    setSearchLoading(true)
    setSearchError('')
    const timer = setTimeout(async () => {
      try {
        const result = await findEntries((entry) => matchesSearch(entry, searchTerm))
        if (!cancelled) {
          setSearchResults(result.entries)
          setSearchHasMore(result.hasMore)
        }
      } catch (err) {
        if (!cancelled) {
          setSearchResults([])
          setSearchHasMore(false)
          setSearchError(err.message || 'Could not search the journal.')
        }
      } finally {
        if (!cancelled) setSearchLoading(false)
      }
    }, 150)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [searchTerm])

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

      <div className="search-bar">
        <SearchIcon size={18} />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search transcripts"
          aria-label="Search journal"
        />
        {query ? (
          <button
            type="button"
            className="search-bar__clear"
            onClick={() => setQuery('')}
            aria-label="Clear search"
          >
            <CloseIcon size={16} />
          </button>
        ) : null}
      </div>

      {searchTerm ? (
        <>
          <div className="search-summary" aria-live="polite">
            {searchLoading
              ? 'Searching…'
              : `${searchResults?.length || 0}${
                  searchHasMore ? '+' : ''
                } ${searchResults?.length === 1 ? 'entry' : 'entries'} found`}
          </div>

          {searchError ? <p className="notice notice--error">{searchError}</p> : null}

          {!searchLoading && searchResults?.length ? (
            <div className="feed-list search-results">
              {searchResults.map((entry) => (
                <EntryCard key={entry.id} entry={entry} onOpen={onOpen} />
              ))}
              {searchHasMore ? (
                <p className="quiet search-limit">Showing the newest 50 matches.</p>
              ) : null}
            </div>
          ) : null}

          {!searchLoading && !searchError && searchResults?.length === 0 ? (
            <div className="empty">
              <p className="empty__mark">⌕</p>
              <h2>No entries found.</h2>
              <p>Try a different word or phrase.</p>
            </div>
          ) : null}
        </>
      ) : (
        <>
          <InstallCard compact />

          {backupDue ? (
            <div className="notice notice--warn backup-reminder">
              <p>
                <strong>No recent backup.</strong> Export an encrypted copy so this journal can
                move to another device.
              </p>
              <button type="button" className="btn btn--line" onClick={onSettings}>
                Back up
              </button>
            </div>
          ) : null}

          {incomplete.length ? (
            <div className="notice notice--warn">
              {incomplete.length}{' '}
              {incomplete.length === 1 ? 'entry needs' : 'entries need'} attention. Open it to
              retry transcription.
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
        </>
      )}
    </section>
  )
}
