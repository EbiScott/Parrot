import { useCallback, useEffect, useRef, useState } from 'react'
import { describeMediaError, pickMimeType } from '../utils/media'

/**
 * Tap to start, tap to stop. Resolves with { blob, duration } when stopped.
 *
 * Notes on the recording itself:
 * - `start(1000)` makes MediaRecorder emit a chunk every second, so a long
 *   recording never sits as one giant in-memory buffer until the end.
 * - Tracks are stopped only *after* the final chunk arrives; stopping them
 *   first truncates the tail of the file.
 */
export function useAudioRecorder() {
  const [status, setStatus] = useState('idle') // idle | requesting | recording | stopped | error
  const [elapsed, setElapsed] = useState(0)
  const [level, setLevel] = useState(0)
  const [error, setError] = useState(null)

  const recorderRef = useRef(null)
  const streamRef = useRef(null)
  const chunksRef = useRef([])
  const tickRef = useRef(null)
  const startedAtRef = useRef(0)
  const stopPromiseRef = useRef(null)
  const audioCtxRef = useRef(null)
  const rafRef = useRef(null)
  const lastLevelRef = useRef(0)

  const releaseDevices = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {})
      audioCtxRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    if (tickRef.current) clearInterval(tickRef.current)
    tickRef.current = null
  }, [])

  const startMeter = useCallback((stream) => {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    try {
      const ctx = new Ctx()
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 512
      source.connect(analyser)
      audioCtxRef.current = ctx

      const data = new Uint8Array(analyser.fftSize)
      const loop = (now) => {
        analyser.getByteTimeDomainData(data)
        let sum = 0
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128
          sum += v * v
        }
        const rms = Math.sqrt(sum / data.length)
        if (now - lastLevelRef.current > 70) {
          lastLevelRef.current = now
          setLevel(Math.min(1, rms * 5))
        }
        rafRef.current = requestAnimationFrame(loop)
      }
      rafRef.current = requestAnimationFrame(loop)
    } catch {
      // A meter is a nice-to-have; recording works without it.
    }
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

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      })
      streamRef.current = stream

      const mimeType = pickMimeType('audio')
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream)

      chunksRef.current = []
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size) chunksRef.current.push(event.data)
      }
      recorderRef.current = recorder

      recorder.start(1000)
      startedAtRef.current = performance.now()
      setStatus('recording')
      setElapsed(0)

      tickRef.current = setInterval(() => {
        setElapsed((performance.now() - startedAtRef.current) / 1000)
      }, 200)

      startMeter(stream)
    } catch (err) {
      setError(describeMediaError(err, 'microphone'))
      setStatus('error')
      releaseDevices()
    }
  }, [status, startMeter, releaseDevices])

  const stop = useCallback(() => {
    const recorder = recorderRef.current
    if (!recorder) return Promise.resolve(null)
    if (stopPromiseRef.current) return stopPromiseRef.current

    stopPromiseRef.current = new Promise((resolve) => {
      const finish = () => {
        const duration = (performance.now() - startedAtRef.current) / 1000
        const type = recorder.mimeType || pickMimeType('audio') || 'audio/webm'
        const blob = new Blob(chunksRef.current, { type })
        chunksRef.current = []

        recorderRef.current = null
        stopPromiseRef.current = null
        releaseDevices()

        setStatus('stopped')
        setLevel(0)
        resolve({ blob, duration })
      }

      recorder.onstop = finish
      try {
        recorder.stop()
      } catch {
        finish()
      }
    })

    return stopPromiseRef.current
  }, [releaseDevices])

  const reset = useCallback(() => {
    releaseDevices()
    recorderRef.current = null
    chunksRef.current = []
    setStatus('idle')
    setElapsed(0)
    setLevel(0)
    setError(null)
  }, [releaseDevices])

  useEffect(() => releaseDevices, [releaseDevices])

  return {
    status,
    elapsed,
    level,
    error,
    isRecording: status === 'recording',
    start,
    stop,
    reset,
  }
}
