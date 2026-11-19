import { useEffect, useRef, useState } from 'react'
import RecordButton from '../components/RecordButton'
import { useAudioRecorder } from '../hooks/useAudioRecorder'
import { useVideoRecorder } from '../hooks/useVideoRecorder'
import { createEntry } from '../utils/storage'
import { fileKind } from '../utils/entryUtils'
import { getDuration } from '../utils/decodeAudio'
import { formatClock } from '../utils/formatters'
import { transcribeEntry } from '../utils/journal'
import { UploadIcon, VideoIcon } from '../components/Icons'

export default function RecordScreen({ onDone }) {
  const [mode, setMode] = useState('audio')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef(null)
  const audio = useAudioRecorder()
  const video = useVideoRecorder()
  const active = mode === 'video' ? video : audio

  useEffect(() => {
    const onPaste = (event) => {
      const file = Array.from(event.clipboardData?.files || []).find((item) => fileKind(item))
      if (file) {
        event.preventDefault()
        importFile(file)
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  })

  const toggleMode = (next) => {
    if (active.isRecording || busy) return
    audio.reset()
    video.reset()
    setMessage('')
    setMode(next)
  }

  const stop = async () => {
    const result = await active.stop()
    if (!result) return
    const blob = mode === 'video' ? result.videoBlob : result.blob
    if (!blob?.size) {
      setMessage('The recording was empty. Try again.')
      return
    }

    setBusy(true)
    setMessage('Saving…')
    try {
      const entry = await createEntry({
        type: mode,
        audioBlob: mode === 'video' ? result.audioBlob || result.videoBlob : result.blob,
        videoBlob: mode === 'video' ? result.videoBlob : null,
        duration: result.duration,
        status: 'transcribing',
      })
      audio.reset()
      video.reset()
      transcribeEntry(entry).catch(() => {})
      onDone(entry.id)
    } catch (error) {
      setMessage(error.message || 'Could not save that recording.')
    } finally {
      setBusy(false)
    }
  }

  async function importFile(file) {
    const kind = fileKind(file)
    if (!kind) {
      setMessage('Choose an audio or video file.')
      return
    }

    setBusy(true)
    setMessage('Reading file…')
    try {
      const duration = await getDuration(file, kind).catch(() => 0)
      const entry = await createEntry({
        type: kind,
        audioBlob: file,
        videoBlob: kind === 'video' ? file : null,
        duration,
        status: 'transcribing',
      })
      transcribeEntry(entry).catch(() => {})
      onDone(entry.id)
    } catch (error) {
      setMessage(error.message || 'Could not read that file.')
    } finally {
      setBusy(false)
    }
  }

  const onDrop = (event) => {
    event.preventDefault()
    setDragging(false)
    const file = event.dataTransfer?.files?.[0]
    if (file) importFile(file)
  }

  return (
    <section className="page record-page">
      <header className="page-head">
        <p className="eyebrow">New entry</p>
        <h1>Say it out loud.</h1>
        <p className="page-sub">Audio or video. It stays on this device.</p>
      </header>

      <div className="mode-switch" role="group" aria-label="Recording type">
        <button
          type="button"
          className={mode === 'audio' ? 'is-on' : ''}
          onClick={() => toggleMode('audio')}
        >
          Audio
        </button>
        <button
          type="button"
          className={mode === 'video' ? 'is-on' : ''}
          onClick={() => toggleMode('video')}
        >
          <VideoIcon size={16} /> Video
        </button>
      </div>

      {mode === 'video' && video.stream ? (
        <video
          className="record-preview"
          autoPlay
          muted
          playsInline
          ref={(node) => {
            if (node && node.srcObject !== video.stream) node.srcObject = video.stream
          }}
        />
      ) : null}

      <div className="record-stage">
        <RecordButton
          recording={active.isRecording}
          onToggle={active.isRecording ? stop : active.start}
          disabled={busy || (active.status === 'requesting' && !active.isRecording)}
          mode={mode}
        />
        <p className="record-clock">{formatClock(active.elapsed)}</p>
        <div className="level" aria-label="Input level">
          <span style={{ width: `${Math.round((audio.level || 0) * 100)}%` }} />
        </div>
        <p className="record-hint">
          {active.isRecording
            ? 'Recording. Tap to stop.'
            : mode === 'video'
              ? 'Front camera and microphone.'
              : 'Tap the button and start talking.'}
        </p>
      </div>

      {active.error ? (
        <div className="notice notice--error">
          <strong>{active.error.title}</strong>
          <p>{active.error.detail}</p>
        </div>
      ) : null}
      {message ? <p className="notice">{message}</p> : null}

      <div
        className={`import-zone${dragging ? ' is-dragging' : ''}`}
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <UploadIcon size={22} />
        <div>
          <strong>Add a file</strong>
          <p>Drop it here, paste it, or choose from your device.</p>
        </div>
        <button type="button" className="btn btn--line" onClick={() => inputRef.current?.click()}>
          Browse
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="audio/*,video/*"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) importFile(file)
            event.target.value = ''
          }}
        />
      </div>

      <p className="fine-print">
        Transcription runs locally. The first run downloads the model once.
        {busy ? ' Working…' : ''}
      </p>
    </section>
  )
}
