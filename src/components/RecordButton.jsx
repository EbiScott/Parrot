import { MicIcon, StopIcon, VideoIcon } from './Icons'

/**
 * The one button that matters. Idle: a red mic. Recording: a stop square with a
 * pulsing halo so it is obvious from across the room that the app is listening.
 */
export default function RecordButton({ recording, onToggle, disabled = false, mode = 'audio' }) {
  const Icon = mode === 'video' ? VideoIcon : MicIcon

  return (
    <button
      type="button"
      className={`record-button${recording ? ' is-recording' : ''}`}
      onClick={onToggle}
      disabled={disabled}
      data-mode={mode}
      aria-label={recording ? 'Stop recording' : 'Start recording'}
    >
      <span className="record-button__halo" aria-hidden="true" />
      <span className="record-button__core" aria-hidden="true">
        {recording ? <StopIcon size={34} /> : <Icon size={40} />}
      </span>
    </button>
  )
}
