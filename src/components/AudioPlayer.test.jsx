// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AudioPlayer from './AudioPlayer'

const blob = new Blob(['abc'], { type: 'audio/webm' })

describe('AudioPlayer', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('shows the total duration', () => {
    render(<AudioPlayer blob={blob} duration={154} />)
    expect(screen.getByText('2:34')).toBeInTheDocument()
  })

  it('starts at zero', () => {
    render(<AudioPlayer blob={blob} duration={154} />)
    expect(screen.getByText('0:00')).toBeInTheDocument()
  })

  it('plays when the play control is pressed', async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play')
    render(<AudioPlayer blob={blob} duration={10} />)

    await userEvent.click(screen.getByRole('button', { name: /play/i }))
    expect(play).toHaveBeenCalled()
  })

  it('renders a seek control', () => {
    render(<AudioPlayer blob={blob} duration={10} />)
    expect(screen.getByRole('slider', { name: /seek/i })).toBeInTheDocument()
  })

  it('copes with a blob the browser cannot decode', () => {
    // No OfflineAudioContext in jsdom: the waveform falls back to flat bars.
    expect(() => render(<AudioPlayer blob={blob} duration={5} />)).not.toThrow()
  })
})
