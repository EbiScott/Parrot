import { useSyncExternalStore } from 'react'
import {
  clearError,
  getState,
  preloadModel,
  resetModel,
  subscribe,
  transcribe,
} from '../utils/transcriberClient'

/** View binding for the shared transcription worker. */
export function useTranscriber() {
  const state = useSyncExternalStore(subscribe, getState, getState)

  return {
    ...state,
    isLoadingModel: state.phase === 'model',
    isTranscribing: state.phase === 'decoding' || state.phase === 'warming' || state.phase === 'transcribing',
    transcribe,
    preloadModel,
    resetModel,
    clearError,
  }
}
