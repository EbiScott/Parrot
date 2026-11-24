import { subtitleFileName, toSrt, toVtt } from './subtitles'

export function downloadOptions(entry) {
  if (!entry) return []

  const options = []
  if (entry.audioBlob?.size) {
    options.push({ kind: 'audio', label: 'Download audio', blob: entry.audioBlob })
  }
  if (entry.type === 'video' && entry.videoBlob?.size) {
    options.push({ kind: 'video', label: 'Download video', blob: entry.videoBlob })
  }

  const captions = Array.isArray(entry.captions) ? entry.captions : []
  if (captions.length) {
    const srt = toSrt(captions)
    const vtt = toVtt(captions)
    if (srt) {
      options.push({
        kind: 'srt',
        label: 'Download subtitles (.srt)',
        blob: new Blob([srt], { type: 'application/x-subrip' }),
        filename: subtitleFileName(entry, 'srt'),
      })
    }
    if (vtt) {
      options.push({
        kind: 'vtt',
        label: 'Download subtitles (.vtt)',
        blob: new Blob([vtt], { type: 'text/vtt' }),
        filename: subtitleFileName(entry, 'vtt'),
      })
    }
  }

  return options
}
