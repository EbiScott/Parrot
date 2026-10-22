import { useCallback, useEffect, useRef, useState } from 'react'
import { describeMediaError, pickMimeType } from '../utils/media'

/**
 * Records the front camera and, in parallel, an audio-only copy of the same
 * microphone. The video blob is for playback; the audio blob is what gets
 * transcribed — Whisper only ever sees 16 kHz mono audio, never a video file.
 *
 * Returns { videoBlob, audioBlob, duration } on stop.
 */
export function useVideoRecorder() {
  const [status, setStatus] = useState('idle') // idle | requesting | recording | stopped | error
  const [elapsed, setElapsed] = useState(0)
  const [stream, setStream] = useState(null)
  const [error, setError] = useState(null)

  const videoRecorderRef = useRef(null)
  const audioRecorderRef = useRef(null)
  const streamRef = useRef(null)
  const audioStreamRef = useRef(null)
  const videoChunksRef = useRef([])
  const audioChunksRef = useRef([])
  const tickRef = useRef(null)
  const startedAtRef = useRef(0)
  const stopPromiseRef = useRef(null)

  const releaseDevices = useCallback(() => {
    if (tickRef.current) clearInterval(tickRef.current)
    tickRef.current = null

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    audioStreamRef.current = null
    setStream(null)
  }, [])

  const start = useCallback(async () => {
    if (status === 'recording' || status === 'requesting') return
    setError(null)
    setElapsed(0)
    setStatus('requesting')

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new DOMException('Recording is not supported here.', 'NotSupportedError')
      }

      let mediaStream
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        })
      } catch (err) {
        // Some devices refuse the ideal constraints; retry with anything they have.
        if (err?.name === 'OverconstrainedError' || err?.name === 'ConstraintNotSatisfiedError') {
          mediaStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: { facingMode: 'user' },
          })
        } else {
          throw err
        }
      }

      streamRef.current = mediaStream
      setStream(mediaStream)

      // 1. Video + audio
      const videoMime = pickMimeType('video')
      const videoRecorder = videoMime
        ? new MediaRecorder(mediaStream, { mimeType: videoMime })
        : new MediaRecorder(mediaStream)
      videoChunksRef.current = []
      videoRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size) videoChunksRef.current.push(event.data)
      }
      videoRecorderRef.current = videoRecorder

      // 2. Audio only, from the same microphone track
      const audioTracks = mediaStream.getAudioTracks()
      let audioRecorder = null
      if (audioTracks.length) {
        const audioStream = new MediaStream(audioTracks)
        audioStreamRef.current = audioStream
        const audioMime = pickMimeType('audio')
        try {
          audioRecorder = audioMime
            ? new MediaRecorder(audioStream, { mimeType: audioMime })
            : new MediaRecorder(audioStream)
          audioChunksRef.current = []
          audioRecorder.ondataavailable = (event) => {
            if (event.data && event.data.size) audioChunksRef.current.push(event.data)
          }
        } catch {
          audioRecorder = null
        }
      }
      audioRecorderRef.current = audioRecorder

      videoRecorder.start(1000)
      audioRecorder?.start(1000)

      startedAtRef.current = performance.now()
      setStatus('recording')
      setElapsed(0)

      tickRef.current = setInterval(() => {
        setElapsed((performance.now() - startedAtRef.current) / 1000)
      }, 200)
    } catch (err) {
      setError(describeMediaError(err, 'camera'))
      setStatus('error')
      releaseDevices()
    }
  }, [status, releaseDevices])

  const stop = useCallback(() => {
    const videoRecorder = videoRecorderRef.current
    if (!videoRecorder) return Promise.resolve(null)
    if (stopPromiseRef.current) return stopPromiseRef.current

    stopPromiseRef.current = new Promise((resolve) => {
      const audioRecorder = audioRecorderRef.current
      const pending = audioRecorder ? 2 : 1
      let settled = 0

      const finish = () => {
        settled += 1
        if (settled < pending) return

        const duration = (performance.now() - startedAtRef.current) / 1000
        const videoType = videoRecorder.mimeType || 'video/webm'
        const videoBlob = new Blob(videoChunksRef.current, { type: videoType })

        let audioBlob = null
        if (audioRecorder) {
          const audioType = audioRecorder.mimeType || 'audio/webm'
          audioBlob = new Blob(audioChunksRef.current, { type: audioType })
          if (!audioBlob.size) audioBlob = null
        }

        videoChunksRef.current = []
        audioChunksRef.current = []
        videoRecorderRef.current = null
        audioRecorderRef.current = null
        stopPromiseRef.current = null

        releaseDevices()
        setStatus('stopped')
        resolve({ videoBlob, audioBlob, duration })
      }

      videoRecorder.onstop = finish
      if (audioRecorder) audioRecorder.onstop = finish

      try {
        videoRecorder.stop()
        audioRecorder?.stop()
      } catch {
        finish()
        if (audioRecorder) finish()
      }
    })

    return stopPromiseRef.current
  }, [releaseDevices])

  const reset = useCallback(() => {
    releaseDevices()
    videoRecorderRef.current = null
    audioRecorderRef.current = null
    videoChunksRef.current = []
    audioChunksRef.current = []
    setStatus('idle')
    setElapsed(0)
    setError(null)
  }, [releaseDevices])

  useEffect(() => releaseDevices, [releaseDevices])

  return {
    status,
    elapsed,
    stream,
    error,
    isRecording: status === 'recording',
    start,
    stop,
    reset,
  }
}
