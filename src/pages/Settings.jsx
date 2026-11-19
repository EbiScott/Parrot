import { useEffect, useState } from 'react'
import { useTranscriber } from '../hooks/useTranscriber'
import { clearEntries, countEntries, getQuotaEstimate, getStorageUsage } from '../utils/storage'
import { formatFileSize } from '../utils/formatters'
import { MODEL_APPROX_BYTES, MODEL_LABEL } from '../constants'

export default function Settings() {
  const [usage, setUsage] = useState(null)
  const [quota, setQuota] = useState(null)
  const [persisted, setPersisted] = useState(null)
  const [count, setCount] = useState(0)
  const [notice, setNotice] = useState('')
  const transcriber = useTranscriber()

  const load = async () => {
    setUsage(await getStorageUsage())
    setQuota(await getQuotaEstimate())
    setCount(await countEntries())
    if (navigator.storage?.persisted) setPersisted(await navigator.storage.persisted())
  }

  useEffect(() => {
    load()
  }, [])

  const requestPersist = async () => {
    if (!navigator.storage?.persist) {
      setNotice('This browser does not offer persistent storage.')
      return
    }
    const granted = await navigator.storage.persist()
    setPersisted(granted)
    setNotice(granted ? 'Storage is now persistent.' : 'The browser declined persistent storage.')
  }

  const resetModel = async () => {
    if (!window.confirm('Remove the cached speech model? The next transcription will download it again.')) return
    await transcriber.resetModel()
    setNotice('Model cache cleared.')
  }

  const clearAll = async () => {
    if (!window.confirm('Delete every entry and recording? This cannot be undone.')) return
    await clearEntries()
    await load()
    setNotice('All entries deleted.')
  }

  const quotaPercent = quota?.quota ? Math.min(100, (quota.usage / quota.quota) * 100) : 0

  return (
    <section className="page settings-page">
      <header className="page-head">
        <p className="eyebrow">Settings</p>
        <h1>Storage and engine.</h1>
        <p className="page-sub">Everything here is local. Nothing is uploaded.</p>
      </header>

      <div className="settings-card">
        <div className="settings-card__head">
          <h2>Journal storage</h2>
          <span>{count} {count === 1 ? 'entry' : 'entries'}</span>
        </div>
        <dl className="facts">
          <div><dt>Recordings</dt><dd>{usage ? formatFileSize(usage.bytes) : '—'}</dd></div>
          <div><dt>Browser quota used</dt><dd>{quota ? `${quotaPercent.toFixed(1)}%` : 'unavailable'}</dd></div>
          <div><dt>Persistent storage</dt><dd>{persisted === null ? 'unknown' : persisted ? 'yes' : 'no'}</dd></div>
        </dl>
        <div className="settings-actions">
          <button type="button" className="btn btn--line" onClick={requestPersist}>Protect storage</button>
          <button type="button" className="btn btn--danger" onClick={clearAll}>Delete all entries</button>
        </div>
      </div>

      <div className="settings-card">
        <div className="settings-card__head">
          <h2>Speech engine</h2>
          <span>{MODEL_LABEL}</span>
        </div>
        <p className="quiet">
          The model is about {formatFileSize(MODEL_APPROX_BYTES)} and is cached after the first download.
        </p>
        <div className="settings-actions">
          <button type="button" className="btn btn--line" onClick={transcriber.preloadModel}>
            {transcriber.isLoadingModel ? 'Loading…' : 'Load model'}
          </button>
          <button type="button" className="btn btn--line" onClick={resetModel}>Clear model cache</button>
        </div>
        {transcriber.error ? <p className="notice notice--error">{transcriber.error}</p> : null}
      </div>

      {notice ? <p className="notice">{notice}</p> : null}

      <p className="fine-print">
        Parrot keeps recordings in this browser. Clearing site data or uninstalling the app removes them.
      </p>
    </section>
  )
}
