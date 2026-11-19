const AUDIO_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/ogg',
  'audio/mp4',
]

const VIDEO_TYPES = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
  'video/mp4',
]

function supported(type) {
  try {
    return typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)
  } catch {
    return false
  }
}

/** First container/codec combination this browser can actually record. */
export function pickMimeType(kind = 'audio') {
  const candidates = kind === 'video' ? VIDEO_TYPES : AUDIO_TYPES
  return candidates.find(supported) || ''
}

export function extensionForMime(mime = '') {
  if (mime.includes('webm')) return 'webm'
  if (mime.includes('ogg')) return 'ogg'
  if (mime.includes('mp4')) return mime.startsWith('video/') ? 'mp4' : 'm4a'
  return 'bin'
}

/** Human label for a blob, used in the player and export names. */
export function labelForBlob(blob, fallback = 'recording') {
  return `${fallback}.${extensionForMime(blob?.type || '')}`
}

export function isRecordingSupported() {
  return (
    typeof MediaRecorder !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia
  )
}

/** Turn a DOMException into something a person can act on. */
export function describeMediaError(err, kind = 'microphone') {
  const name = err?.name || ''

  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return {
        title: `${
          kind === 'camera' ? 'Camera and microphone' : 'Microphone'
        } access is blocked`,
        detail:
          'Allow access for this site, then try again. In Safari this lives in Settings → Safari → Camera / Microphone. On Android: Chrome → the padlock in the address bar → Permissions.',
      }
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return {
        title: 'No recording device found',
        detail: `This device does not report a usable ${kind}.`,
      }
    case 'NotReadableError':
      return {
        title: `${kind === 'camera' ? 'Camera' : 'Microphone'} is busy`,
        detail: 'Another app is using it. Close that app and try again.',
      }
    case 'OverconstrainedError':
      return {
        title: 'That recording setup is unavailable',
        detail: 'Try again — the app will fall back to the default device.',
      }
    default:
      return {
        title: 'Could not start recording',
        detail: err?.message || 'Unknown device error.',
      }
  }
}
