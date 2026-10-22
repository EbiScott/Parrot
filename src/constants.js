export const APP_NAME = 'Parrot'

/** Whisper checkpoint. English-only tiny is the sweet spot for a phone: ~40 MB. */
export const MODEL_ID = 'Xenova/whisper-tiny.en'
export const MODEL_LABEL = 'Whisper Tiny (English)'
export const MODEL_APPROX_BYTES = 42 * 1024 * 1024

/** Whisper is trained on 16 kHz mono audio. Everything is resampled to this. */
export const SAMPLE_RATE = 16000

/** Longest slice handed to the model in one go. */
export const CHUNK_SECONDS = 30

/** Feed pagination. */
export const PAGE_SIZE = 10

export const ENTRY_TYPES = {
  audio: { label: 'Audio', emoji: '🎤' },
  video: { label: 'Video', emoji: '🎥' },
}
