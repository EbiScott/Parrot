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
})
