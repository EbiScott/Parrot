import { useEffect, useState } from 'react'
import {
  detectInstallPlatform,
  installInstructions,
  isStandalone,
  runInstallPrompt,
} from '../utils/install'

export const INSTALL_AVAILABLE_EVENT = 'parrot:install-available'

function currentPrompt() {
  return typeof window === 'undefined' ? null : window.__parrotInstallPrompt || null
}

export function useInstallPrompt() {
  const [prompt, setPrompt] = useState(currentPrompt)
  const [installed, setInstalled] = useState(() => isStandalone())
  const [installing, setInstalling] = useState(false)

  useEffect(() => {
    const refresh = () => {
      setPrompt(currentPrompt())
      setInstalled(isStandalone())
    }
    const onInstalled = () => {
      setPrompt(null)
      setInstalled(true)
    }
    const displayMode = window.matchMedia?.('(display-mode: standalone)')

    window.addEventListener(INSTALL_AVAILABLE_EVENT, refresh)
    window.addEventListener('appinstalled', onInstalled)
    displayMode?.addEventListener?.('change', refresh)

    return () => {
      window.removeEventListener(INSTALL_AVAILABLE_EVENT, refresh)
      window.removeEventListener('appinstalled', onInstalled)
      displayMode?.removeEventListener?.('change', refresh)
    }
  }, [])

  const install = async () => {
    if (!prompt) return 'unavailable'
    setInstalling(true)
    const outcome = await runInstallPrompt(prompt)
    setInstalling(false)
    setPrompt(null)
    delete window.__parrotInstallPrompt
    if (outcome === 'accepted') setInstalled(true)
    return outcome
  }

  const platform = detectInstallPlatform(
    typeof navigator === 'undefined' ? '' : navigator.userAgent,
  )

  return {
    available: Boolean(prompt) && !installed,
    installed,
    installing,
    platform,
    instructions: installInstructions(platform),
    install,
  }
}
