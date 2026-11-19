export function downloadOptions(entry) {
  if (!entry) return []

  const options = []
  if (entry.audioBlob?.size) {
    options.push({ kind: 'audio', label: 'Download audio', blob: entry.audioBlob })
  }
  if (entry.type === 'video' && entry.videoBlob?.size) {
    options.push({ kind: 'video', label: 'Download video', blob: entry.videoBlob })
  }
  return options
}
