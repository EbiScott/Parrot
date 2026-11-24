import { updateEntry } from './storage'
import { transcribe } from './transcriberClient'
import { normalizeTranscript } from './entryUtils'

export async function transcribeEntry(entry) {
  if (!entry?.audioBlob?.size) {
    const message = 'That entry has no audio to transcribe.'
    await updateEntry(entry.id, { status: 'error', error: message })
    throw new Error(message)
  }

  await updateEntry(entry.id, { status: 'transcribing', error: null })

  try {
    const result = await transcribe(entry.audioBlob)
    const raw = typeof result === 'string' ? result : result?.text || ''
    const captions = Array.isArray(result?.captions) ? result.captions : []
    const transcript = normalizeTranscript(raw)
    const message = transcript ? null : 'No speech was detected in that audio.'
    await updateEntry(entry.id, {
      transcript,
      captions: transcript ? captions : [],
      status: transcript ? 'done' : 'error',
      error: message,
    })
    if (!transcript) throw new Error(message)
    return transcript
  } catch (error) {
    const message =
      error instanceof Error && error.message ? error.message : 'Transcription failed.'
    await updateEntry(entry.id, { status: 'error', error: message })
    throw error
  }
}
