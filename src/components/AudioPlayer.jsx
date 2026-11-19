import { useEffect, useRef, useState } from 'react'
import { useObjectUrl } from '../hooks/useObjectUrl'
import { formatPlaybackTime } from '../utils/formatters'
import { PauseIcon, PlayIcon } from './Icons'

export default function AudioPlayer({ blob, duration = 0 }) {
  const src = useObjectUrl(blob)
  const audioRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [current, setCurrent] = useState(0)
  const total = Math.max(0, Number(duration) || 0)

  useEffect(() => {
    setPlaying(false)
    setCurrent(0)
  }, [blob])

  const toggle = async () => {
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

  const seek = (event) => {
    const value = Number(event.target.value)
    setCurrent(value)
    if (audioRef.current) audioRef.current.currentTime = value
  }

  return (
    <div className="audio-player">
      {src ? (
        <audio
          ref={audioRef}
          src={src}
          preload="metadata"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => {
            setPlaying(false)
            setCurrent(0)
          }}
          onTimeUpdate={(event) => setCurrent(event.currentTarget.currentTime)}
        />
      ) : null}

      <button
        type="button"
        className="audio-player__toggle"
        onClick={toggle}
        aria-label={playing ? 'Pause recording' : 'Play recording'}
        disabled={!src}
      >
        {playing ? <PauseIcon size={22} /> : <PlayIcon size={22} />}
      </button>

      <div className="audio-player__track">
        <input
          type="range"
          className="audio-player__seek"
          aria-label="Seek"
          min="0"
          max={total || 0}
          step="1"
          value={Math.min(current, total || 0)}
          onChange={seek}
          disabled={!src || !total}
        />
        <div className="audio-player__time">
          <span>{formatPlaybackTime(current)}</span>
          <span>{formatPlaybackTime(total)}</span>
        </div>
      </div>
    </div>
  )
}
