import { useRef, useState } from 'react'
import { backupFileName, createBackupBlob, readBackupFile } from '../utils/backup'
import { getLastBackupAt, recordBackup } from '../utils/backupStatus'
import { formatFileSize, formatRelativeTime } from '../utils/formatters'
import { ensureUuids, getAllEntries, importEntries } from '../utils/storage'

function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export default function BackupCard({ onChanged }) {
  const [passphrase, setPassphrase] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState('')
  const [progress, setProgress] = useState(null)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(null)
  const [lastBackupAt, setLastBackupAt] = useState(() => getLastBackupAt())
  const fileInput = useRef(null)

  const cleanMessages = () => {
    setNotice('')
    setError('')
  }

  const validPassphrase = (withConfirm = false) => {
    if (passphrase.trim().length < 10) {
      setError('Use a backup passphrase of at least 10 characters.')
      return false
    }
    if (withConfirm && passphrase !== confirm) {
      setError('The two passphrases do not match.')
      return false
    }
    return true
  }

  const exportBackup = async () => {
    cleanMessages()
    if (!validPassphrase(true)) return

    setBusy('export')
    setProgress(null)
    try {
      await ensureUuids()
      const entries = await getAllEntries()
      const blob = await createBackupBlob(entries, passphrase, {
        onProgress: ({ done, total }) => setProgress({ done, total, action: 'Encrypting' }),
      })
      saveBlob(blob, backupFileName())
      setLastBackupAt(recordBackup())
      setNotice(`Backup saved (${formatFileSize(blob.size)}). Keep the passphrase safe.`)
      setPassphrase('')
      setConfirm('')
    } catch (err) {
      setError(err.message || 'Could not create the backup.')
    } finally {
      setBusy('')
      setProgress(null)
    }
  }

  const chooseImport = () => {
    cleanMessages()
    if (!validPassphrase()) return
    fileInput.current?.click()
  }

  const pickImport = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setBusy('read')
    setProgress(null)
    setPending(null)
    try {
      const result = await readBackupFile(file, passphrase, {
        onProgress: ({ done, total }) => setProgress({ done, total, action: 'Opening' }),
      })
      setPending({ ...result, fileName: file.name })
    } catch (err) {
      setError(err.message || 'Could not open that backup.')
    } finally {
      setBusy('')
      setProgress(null)
    }
  }

  const finishImport = async (replace) => {
    if (!pending) return
    if (
      replace &&
      !window.confirm(
        'Replace every entry on this device with the backup? Existing entries will be deleted.',
      )
    ) {
      return
    }

    cleanMessages()
    setBusy(replace ? 'replace' : 'merge')
    try {
      const result = await importEntries(pending.entries, { replace })
      setNotice(
        `${result.added} ${result.added === 1 ? 'entry' : 'entries'} added${
          result.skipped ? `, ${result.skipped} already present` : ''
        }.`,
      )
      setPending(null)
      setPassphrase('')
      setConfirm('')
      onChanged?.()
    } catch (err) {
      setError(err.message || 'Could not restore that backup.')
    } finally {
      setBusy('')
    }
  }

  const disabled = Boolean(busy)
  const progressText = progress
    ? `${progress.action} backup… ${progress.done} of ${progress.total}`
    : null

  return (
    <div className="settings-card">
      <div className="settings-card__head">
        <h2>Backup &amp; devices</h2>
        <span>Encrypted</span>
      </div>
      <p className="quiet">
        Move your journal to a new device with one encrypted file. The passphrase is never stored
        and cannot be recovered.
      </p>

      <dl className="facts backup-facts">
        <div>
          <dt>Last backup</dt>
          <dd>{lastBackupAt ? formatRelativeTime(lastBackupAt) : 'Never'}</dd>
        </div>
      </dl>

      <div className="backup-fields">
        <label className="backup-field">
          <span>Backup passphrase</span>
          <input
            type="password"
            value={passphrase}
            onChange={(event) => setPassphrase(event.target.value)}
            autoComplete="new-password"
            placeholder="At least 10 characters"
            disabled={disabled}
          />
        </label>
        <label className="backup-field">
          <span>Confirm passphrase for export</span>
          <input
            type="password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            autoComplete="new-password"
            placeholder="Repeat the passphrase"
            disabled={disabled}
          />
        </label>
      </div>

      <div className="settings-actions backup-actions">
        <button type="button" className="btn btn--solid" onClick={exportBackup} disabled={disabled}>
          {busy === 'export' ? 'Encrypting…' : 'Export backup'}
        </button>
        <button type="button" className="btn btn--line" onClick={chooseImport} disabled={disabled}>
          {busy === 'read' ? 'Opening…' : 'Import backup'}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".parrot,application/octet-stream"
          onChange={pickImport}
          hidden
        />
      </div>

      {progressText ? <p className="backup-progress">{progressText}</p> : null}

      {pending ? (
        <div className="backup-pending">
          <p>
            <strong>
              {pending.entries.length} {pending.entries.length === 1 ? 'entry' : 'entries'}
            </strong>{' '}
            ready from {pending.fileName}. Nothing has changed yet.
          </p>
          <div className="settings-actions">
            <button
              type="button"
              className="btn btn--solid"
              onClick={() => finishImport(false)}
              disabled={disabled}
            >
              Merge into journal
            </button>
            <button
              type="button"
              className="btn btn--danger"
              onClick={() => finishImport(true)}
              disabled={disabled}
            >
              Replace all
            </button>
            <button type="button" className="btn btn--line" onClick={() => setPending(null)} disabled={disabled}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {notice ? <p className="notice">{notice}</p> : null}
      {error ? <p className="notice notice--error">{error}</p> : null}

      <p className="fine-print backup-note">
        Cloud accounts are not enabled yet. This file is the only way to move a journal between
        devices.
      </p>
    </div>
  )
}
