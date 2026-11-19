// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import EntryCard from './EntryCard'

const audioEntry = {
  id: 1760690000000,
  type: 'audio',
  title: 'Oct 17 2026 - 3:42 PM',
  duration: 154,
  transcript: 'First line here. Second sentence follows.\n\nSecond paragraph.',
  status: 'done',
  createdAt: 1760690000000,
  audioBlob: new Blob(['abc'], { type: 'audio/webm' }),
  videoBlob: null,
}

describe('EntryCard', () => {
  it('shows the type, duration and transcript preview', () => {
    render(<EntryCard entry={audioEntry} onOpen={() => {}} />)

    expect(screen.getByText(/audio/i)).toBeInTheDocument()
    expect(screen.getByText('2m 34s')).toBeInTheDocument()
    expect(screen.getByText(/first line here/i)).toBeInTheDocument()
  })

  it('opens the entry when the card is tapped', async () => {
    const onOpen = vi.fn()
    render(<EntryCard entry={audioEntry} onOpen={onOpen} />)

    await userEvent.click(screen.getByRole('button', { name: /open entry/i }))
    expect(onOpen).toHaveBeenCalledWith(audioEntry.id)
  })

  it('has a separate play control that does not open the entry', async () => {
    const onOpen = vi.fn()
    render(<EntryCard entry={audioEntry} onOpen={onOpen} />)

    await userEvent.click(screen.getByRole('button', { name: /play recording/i }))
    expect(onOpen).not.toHaveBeenCalled()
  })

  it('marks video entries', () => {
    render(
      <EntryCard
        entry={{ ...audioEntry, type: 'video', videoBlob: new Blob(['v'], { type: 'video/webm' }) }}
        onOpen={() => {}}
      />,
    )
    expect(screen.getByText(/video/i)).toBeInTheDocument()
  })

  it('flags an entry whose transcript is missing', () => {
    render(<EntryCard entry={{ ...audioEntry, transcript: '', status: 'error' }} onOpen={() => {}} />)
    expect(screen.getByText(/transcription failed/i)).toBeInTheDocument()
  })

  it('shows a working state while transcribing', () => {
    render(
      <EntryCard entry={{ ...audioEntry, transcript: '', status: 'transcribing' }} onOpen={() => {}} />,
    )
    expect(screen.getByText(/transcribing/i)).toBeInTheDocument()
  })
})
