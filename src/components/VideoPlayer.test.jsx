// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import VideoPlayer from './VideoPlayer'

describe('VideoPlayer', () => {
  it('renders the video with controls', () => {
    const { container } = render(
      <VideoPlayer blob={new Blob(['v'], { type: 'video/webm' })} />,
    )
    const video = container.querySelector('video')
    expect(video).toBeInTheDocument()
    expect(video).toHaveAttribute('controls')
    expect(video).toHaveAttribute('playsinline')
    expect(video).toHaveAttribute('src', expect.stringContaining('blob:'))
  })

  it('renders nothing without a video', () => {
    const { container } = render(<VideoPlayer blob={null} />)
    expect(container.querySelector('video')).not.toBeInTheDocument()
  })

  it('attaches timed captions and offers a toggle', () => {
    const { container } = render(
      <VideoPlayer
        blob={new Blob(['v'], { type: 'video/webm' })}
        captions={[{ start: 0, end: 1.5, text: 'A spoken line.' }]}
      />,
    )

    expect(container.querySelector('track')).toHaveAttribute('kind', 'captions')
    expect(container.querySelector('track')).toHaveAttribute('srclang', 'en')
    expect(screen.getByRole('button', { name: /turn off captions/i })).toBeInTheDocument()
  })

  it('does not offer captions without cues', () => {
    render(<VideoPlayer blob={new Blob(['v'], { type: 'video/webm' })} captions={[]} />)
    expect(screen.queryByRole('button', { name: /captions/i })).not.toBeInTheDocument()
  })
})
