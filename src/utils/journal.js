import { updateEntry } from './storage'
import { transcribe } from './transcriberClient'
import { normalizeTranscript } from './entryUtils'

export async function transcribeEntry(entry) {
  if (!entry?.audioBlob?.size) {
    await updateEntry(entry.id, { status: 'error' })
    throw new Error('That entry has no audio to transcribe.')
  }

  try {
    const raw = await transcribe(entry.audioBlob)
    const transcript = normalizeTranscript(raw)
    await updateEntry(entry.id, {
      transcript,
      status: transcript ? 'done' : 'error',
    })
    return transcript
  } catch (error) {
    await updateEntry(entry.id, { status: 'error' })
    throw error
  }
}
