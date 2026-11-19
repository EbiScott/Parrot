export const APP_NAME = 'Parrot'

/** English-only speech checkpoint. Small enough for a phone: about 40 MB. */
export const MODEL_ID = 'Xenova/whisper-tiny.en'
export const MODEL_LABEL = 'English, on-device'
export const MODEL_APPROX_BYTES = 42 * 1024 * 1024

/** The speech model expects 16 kHz mono audio. Everything is resampled to this. */
export const SAMPLE_RATE = 16000

/** Longest slice handed to the model in one go. */
export const CHUNK_SECONDS = 30

/** Feed pagination. */
export const PAGE_SIZE = 10

export const ENTRY_TYPES = {
  audio: { label: 'Audio', emoji: '🎤' },
  video: { label: 'Video', emoji: '🎥' },
}
