import { useObjectUrl } from '../hooks/useObjectUrl'

export default function VideoPlayer({ blob }) {
  const src = useObjectUrl(blob)
  if (!blob || !src) return null

  return (
    <video className="video-player" src={src} controls playsInline preload="metadata" />
  )
}
