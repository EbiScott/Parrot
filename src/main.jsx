import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { INSTALL_AVAILABLE_EVENT } from './hooks/useInstallPrompt'
import './styles.css'

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault()
  window.__parrotInstallPrompt = event
  window.dispatchEvent(new Event(INSTALL_AVAILABLE_EVENT))
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
