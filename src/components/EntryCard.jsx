import { useRef, useState } from 'react'
import { useObjectUrl } from '../hooks/useObjectUrl'
import { ENTRY_TYPES } from '../constants'
import { formatDuration, formatRelativeTime } from '../utils/formatters'
import { PauseIcon, PlayIcon } from './Icons'

function preview(text) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim()
  if (clean.length <= 160) return clean
  return `${clean.slice(0, 157).trimEnd()}…`
}

export default function EntryCard({ entry, onOpen }) {
  const audioRef = useRef(null)
  const src = useObjectUrl(entry.audioBlob)
  const [playing, setPlaying] = useState(false)
  const type = entry.type === 'video' ? 'video' : 'audio'
  const label = ENTRY_TYPES[type]?.label || 'Audio'

  const toggle = async (event) => {
    event.stopPropagation()
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) {
      try {
        await audio.play()
      } catch {
        setPlaying(false)
      }
    } else {
      audio.pause()
    }
  }

  const open = () => onOpen?.(entry.id)
  const onKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      open()
    }
  }

  return (
    <article
      className="entry-card"
      role="button"
      tabIndex={0}
      aria-label="Open entry"
      onClick={open}
      onKeyDown={onKeyDown}
    >
      {src ? (
        <audio
          ref={audioRef}
          src={src}
          preload="metadata"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
        />
      ) : null}

      <div className="entry-card__top">
        <span className={`entry-card__type entry-card__type--${type}`}>
          <span className="entry-card__dot" aria-hidden="true" />
          {label}
        </span>
        <span className="entry-card__meta">
          <span>{formatDuration(entry.duration)}</span>
          <span> · {formatRelativeTime(entry.createdAt)}</span>
        </span>
      </div>

      <div className="entry-card__body">
        <button
          type="button"
          className="entry-card__play"
          aria-label={playing ? 'Pause recording' : 'Play recording'}
          onClick={toggle}
          disabled={!src}
        >
          {playing ? <PauseIcon size={18} /> : <PlayIcon size={18} />}
        </button>
        <p className="entry-card__preview">
          {preview(entry.transcript) || 'No transcript yet.'}
        </p>
      </div>

      {entry.status === 'transcribing' ? (
        <p className="entry-card__status">Transcribing…</p>
      ) : null}
      {entry.status === 'error' ? (
        <p className="entry-card__status entry-card__status--error">Transcription failed.</p>
      ) : null}
    </article>
  )
}
