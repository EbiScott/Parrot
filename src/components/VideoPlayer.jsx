import { useEffect, useMemo, useRef, useState } from 'react'
import { useObjectUrl } from '../hooks/useObjectUrl'
import { normalizeCues, toVtt } from '../utils/subtitles'

export default function VideoPlayer({ blob, captions = [] }) {
  const src = useObjectUrl(blob)
  const videoRef = useRef(null)
  const cues = useMemo(() => normalizeCues(captions), [captions])
  const trackBlob = useMemo(
    () => (cues.length ? new Blob([toVtt(cues)], { type: 'text/vtt' }) : null),
    [cues],
  )
  const trackSrc = useObjectUrl(trackBlob)
  const [captionsOn, setCaptionsOn] = useState(true)

  useEffect(() => {
    setCaptionsOn(true)
  }, [trackSrc])

  useEffect(() => {
    const track = videoRef.current?.textTracks?.[0]
    if (!track) return
    track.mode = captionsOn ? 'showing' : 'hidden'
  }, [captionsOn, trackSrc])

  if (!blob || !src) return null

  const syncTrack = () => {
    const track = videoRef.current?.textTracks?.[0]
    if (track) track.mode = captionsOn ? 'showing' : 'hidden'
  }

  return (
    <div className="video-player-wrap">
      <video
        ref={videoRef}
        className="video-player"
        src={src}
        controls
        playsInline
        preload="metadata"
        onLoadedMetadata={syncTrack}
      >
        {trackSrc ? (
          <track
            kind="captions"
            src={trackSrc}
            srcLang="en"
            label="English"
            default
          />
        ) : null}
      </video>

      {trackSrc ? (
        <div className="video-player__bar">
          <button
            type="button"
            className="video-player__cc"
            aria-pressed={captionsOn}
            aria-label={captionsOn ? 'Turn off captions' : 'Turn on captions'}
            onClick={() => setCaptionsOn((value) => !value)}
          >
            {captionsOn ? 'Subtitles on' : 'Subtitles off'}
          </button>
        </div>
      ) : null}
    </div>
  )
}
