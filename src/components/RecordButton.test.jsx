// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import RecordButton from './RecordButton'

describe('RecordButton', () => {
  it('offers a start action when idle', () => {
    render(<RecordButton recording={false} onToggle={() => {}} />)
    expect(screen.getByRole('button', { name: /start recording/i })).toBeInTheDocument()
  })

  it('offers a stop action while recording', () => {
    render(<RecordButton recording onToggle={() => {}} />)
    expect(screen.getByRole('button', { name: /stop recording/i })).toBeInTheDocument()
  })

  it('calls onToggle when pressed', async () => {
    const onToggle = vi.fn()
    render(<RecordButton recording={false} onToggle={onToggle} />)
    await userEvent.click(screen.getByRole('button'))
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('does nothing while disabled', async () => {
    const onToggle = vi.fn()
    render(<RecordButton recording={false} onToggle={onToggle} disabled />)
    await userEvent.click(screen.getByRole('button'))
    expect(onToggle).not.toHaveBeenCalled()
  })

  it('reflects the recording state in the markup', () => {
    const { container, rerender } = render(<RecordButton recording={false} onToggle={() => {}} />)
    expect(container.querySelector('.record-button')).not.toHaveClass('is-recording')

    rerender(<RecordButton recording onToggle={() => {}} />)
    expect(container.querySelector('.record-button')).toHaveClass('is-recording')
  })

  it('exposes the selected mode', () => {
    render(<RecordButton recording={false} onToggle={() => {}} mode="video" />)
    expect(screen.getByRole('button')).toHaveAttribute('data-mode', 'video')
  })
})
