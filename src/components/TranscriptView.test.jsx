// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import TranscriptView from './TranscriptView'

const TEXT = 'First paragraph here. Second sentence.\n\nSecond paragraph starts. And ends.'

describe('TranscriptView', () => {
  it('renders each paragraph separately', () => {
    const { container } = render(<TranscriptView text={TEXT} />)
    const paragraphs = container.querySelectorAll('p')
    expect(paragraphs).toHaveLength(2)
    expect(paragraphs[0]).toHaveTextContent('First paragraph here.')
    expect(paragraphs[1]).toHaveTextContent('Second paragraph starts.')
  })

  it('shows a placeholder when there is no transcript yet', () => {
    render(<TranscriptView text="" />)
    expect(screen.getByText(/no transcript yet/i)).toBeInTheDocument()
  })

  it('renders an editable textarea while editing', async () => {
    const onChange = vi.fn()
    render(<TranscriptView text={TEXT} editing draft="Draft text" onChange={onChange} />)

    const textarea = screen.getByRole('textbox', { name: /edit transcript/i })
    expect(textarea).toHaveValue('Draft text')

    await userEvent.type(textarea, '!')
    expect(onChange).toHaveBeenCalled()
  })

  it('does not render a textarea when not editing', () => {
    render(<TranscriptView text={TEXT} />)
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })
})
