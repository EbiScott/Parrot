import { useEffect, useState } from 'react'
import AudioPlayer from '../components/AudioPlayer'
import TranscriptView from '../components/TranscriptView'
import VideoPlayer from '../components/VideoPlayer'
import { ChevronLeftIcon, CopyIcon, ShareIcon, TrashIcon } from '../components/Icons'
import { useTranscriber } from '../hooks/useTranscriber'
import { deleteEntry, getEntry, updateEntry } from '../utils/storage'
import { labelForBlob } from '../utils/media'
import { formatDuration } from '../utils/formatters'
import { transcribeEntry } from '../utils/journal'

export default function EntryDetail({ id, onBack }) {
  const [entry, setEntry] = useState(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const transcriber = useTranscriber()

  const load = async () => {
    try {
      const found = await getEntry(id)
      if (!found) setError('That entry no longer exists.')
      else {
        setEntry(found)
        if (!editing) setDraft(found.transcript || '')
      }
    } catch (err) {
      setError(err.message || 'Could not open that entry.')
    }
  }

  useEffect(() => {
    load()
  }, [id])

  useEffect(() => {
    if (entry?.status !== 'transcribing') return undefined
    const timer = setInterval(load, 2000)
    return () => clearInterval(timer)
  }, [entry?.status, id, editing])

  const save = async () => {
    const updated = await updateEntry(id, { transcript: draft, status: 'done' })
    if (updated) setEntry(updated)
    setEditing(false)
    setNotice('Transcript saved.')
  }

  const copy = async () => {
    const text = editing ? draft : entry?.transcript || ''
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      setNotice('Transcript copied.')
    } catch {
      setNotice('Copy failed. Select the text instead.')
    }
  }

  const share = async () => {
    const text = entry?.transcript || entry?.title || 'Parrot entry'
    try {
      if (navigator.share) await navigator.share({ title: entry?.title || 'Parrot', text })
      else await copy()
    } catch {
      /* Cancelled share is not an error worth shouting about. */
    }
  }

  const retry = async () => {
    if (!entry) return
    setNotice('Transcribing again…')
    try {
      await transcribeEntry(entry)
      await load()
      setNotice('Transcript ready.')
    } catch (err) {
      setNotice(err.message || 'Transcription failed again.')
    }
  }

  const remove = async () => {
    if (!entry) return
    if (!window.confirm('Delete this entry? This cannot be undone.')) return
    await deleteEntry(entry.id)
    onBack()
  }

  const download = () => {
    if (!entry?.audioBlob) return
    const url = URL.createObjectURL(entry.audioBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = labelForBlob(entry.audioBlob, `parrot-${entry.id}`)
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  if (error) {
    return (
      <section className="page detail-page">
        <button type="button" className="back" onClick={onBack}>
          <ChevronLeftIcon size={18} /> Journal
        </button>
        <p className="notice notice--error">{error}</p>
      </section>
    )
  }

  if (!entry) return <section className="page detail-page"><p className="quiet">Opening entry…</p></section>

  const isTranscribing = entry.status === 'transcribing' || transcriber.isTranscribing
  const progress = Math.max(
    0,
    Math.min(100, Math.round(transcriber.modelProgress < 1 ? transcriber.modelProgress * 100 : transcriber.progress * 100)),
  )

  return (
    <section className="page detail-page">
      <button type="button" className="back" onClick={onBack}>
        <ChevronLeftIcon size={18} /> Journal
      </button>

      <header className="detail-head">
        <div>
          <p className="eyebrow">{entry.type === 'video' ? 'Video entry' : 'Audio entry'}</p>
          <h1>{entry.title}</h1>
          <p className="page-sub">
            {formatDuration(entry.duration)} · {new Date(entry.createdAt).toLocaleDateString()}
          </p>
        </div>
        <span className={`status status--${entry.status}`}>{entry.status}</span>
      </header>

      {entry.type === 'video' ? <VideoPlayer blob={entry.videoBlob} /> : null}
      <AudioPlayer blob={entry.audioBlob} duration={entry.duration} />

      {isTranscribing ? (
        <div className="progress-card">
          <div className="progress-card__top">
            <span>{transcriber.phase === 'model' ? 'Loading the local model' : 'Transcribing'}</span>
            <span>{progress}%</span>
          </div>
          <div className="progress-bar"><span style={{ width: `${progress}%` }} /></div>
          <p>You can leave this screen. The work continues in the background.</p>
        </div>
      ) : null}

      <div className="transcript-card">
        <div className="transcript-card__head">
          <h2>Transcript</h2>
          <div className="transcript-card__actions">
            {entry.status === 'error' ? (
              <button type="button" className="btn btn--line" onClick={retry}>Retry</button>
            ) : null}
            {editing ? (
              <>
                <button type="button" className="btn btn--line" onClick={() => { setEditing(false); setDraft(entry.transcript || '') }}>Cancel</button>
                <button type="button" className="btn btn--solid" onClick={save}>Save</button>
              </>
            ) : (
              <button type="button" className="btn btn--line" onClick={() => setEditing(true)}>Edit</button>
            )}
          </div>
        </div>

        <TranscriptView
          text={entry.transcript}
          editing={editing}
          draft={draft}
          onChange={setDraft}
        />
      </div>

      {notice ? <p className="notice">{notice}</p> : null}

      <div className="detail-actions">
        <button type="button" className="btn btn--line" onClick={copy} disabled={!entry.transcript}>
          <CopyIcon size={16} /> Copy
        </button>
        <button type="button" className="btn btn--line" onClick={share} disabled={!entry.transcript}>
          <ShareIcon size={16} /> Share
        </button>
        <button type="button" className="btn btn--line" onClick={download}>
          Download audio
        </button>
        <button type="button" className="btn btn--danger" onClick={remove}>
          <TrashIcon size={16} /> Delete
        </button>
      </div>
    </section>
  )
}
