import { useInstallPrompt } from '../hooks/useInstallPrompt'

function Steps({ steps }) {
  return (
    <ol className="install-steps">
      {steps.map((step) => (
        <li key={step}>{step}</li>
      ))}
    </ol>
  )
}

export default function InstallCard({ compact = false }) {
  const { available, installed, installing, instructions, install } = useInstallPrompt()

  if (installed) return null

  if (compact) {
    return (
      <aside className="install-card install-card--compact">
        <div className="install-card__copy">
          <strong>Keep Parrot one tap away.</strong>
          <span>Installs like an app and still works offline.</span>
        </div>
        {available ? (
          <button
            type="button"
            className="btn btn--solid"
            onClick={install}
            disabled={installing}
          >
            {installing ? 'Installing…' : 'Install'}
          </button>
        ) : (
          <details className="install-details">
            <summary className="btn btn--line">How to install</summary>
            <Steps steps={instructions.steps} />
          </details>
        )}
      </aside>
    )
  }

  return (
    <div className="settings-card install-card">
      <div className="settings-card__head">
        <h2>{instructions.title}</h2>
        <span>Home screen</span>
      </div>
      <p className="quiet">
        Open Parrot from your home screen, without the browser bars. Your journal stays on this
        device.
      </p>
      {available ? (
        <div className="settings-actions install-card__actions">
          <button
            type="button"
            className="btn btn--solid"
            onClick={install}
            disabled={installing}
          >
            {installing ? 'Installing…' : 'Install Parrot'}
          </button>
        </div>
      ) : (
        <Steps steps={instructions.steps} />
      )}
    </div>
  )
}
