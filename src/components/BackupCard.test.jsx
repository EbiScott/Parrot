// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import BackupCard from './BackupCard'

const mocks = vi.hoisted(() => ({
  createBackupBlob: vi.fn(),
  readBackupFile: vi.fn(),
  ensureUuids: vi.fn(),
  getAllEntries: vi.fn(),
  importEntries: vi.fn(),
}))

vi.mock('../utils/backup', () => ({
  backupFileName: () => 'parrot-backup-test.parrot',
  createBackupBlob: mocks.createBackupBlob,
  readBackupFile: mocks.readBackupFile,
}))

vi.mock('../utils/storage', () => ({
  ensureUuids: mocks.ensureUuids,
  getAllEntries: mocks.getAllEntries,
  importEntries: mocks.importEntries,
}))

const restored = {
  uuid: 'entry-one',
  type: 'audio',
  title: 'Oct 17 2026 - 3:42 PM',
  transcript: 'A thought.',
  duration: 4,
  createdAt: 1760690000000,
  updatedAt: 1760690000000,
  status: 'done',
  audioBlob: new Blob(['a'], { type: 'audio/webm' }),
  videoBlob: null,
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('BackupCard', () => {
  it('requires a long passphrase before exporting', async () => {
    render(<BackupCard />)

    await userEvent.type(screen.getByLabelText(/^backup passphrase$/i), 'short')
    await userEvent.click(screen.getByRole('button', { name: /export backup/i }))

    expect(screen.getByText(/at least 10 characters/i)).toBeInTheDocument()
    expect(mocks.createBackupBlob).not.toHaveBeenCalled()
  })

  it('previews an import before changing the journal', async () => {
    mocks.readBackupFile.mockResolvedValue({ entries: [restored], exportedAt: 1760690000000 })
    mocks.importEntries.mockResolvedValue({ added: 1, skipped: 0 })
    const onChanged = vi.fn()
    const { container } = render(<BackupCard onChanged={onChanged} />)

    await userEvent.type(
      screen.getByLabelText(/^backup passphrase$/i),
      'correct horse battery staple',
    )
    const fileInput = container.querySelector('input[type="file"]')
    fireEvent.change(fileInput, {
      target: { files: [new File(['backup'], 'journal.parrot')] },
    })

    expect(await screen.findByText(/1 entry/i)).toBeInTheDocument()
    expect(mocks.importEntries).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: /merge into journal/i }))

    await waitFor(() => {
      expect(mocks.importEntries).toHaveBeenCalledWith([restored], { replace: false })
    })
    expect(onChanged).toHaveBeenCalledOnce()
  })
})
