// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import BottomNav from './BottomNav'

describe('BottomNav', () => {
  it('renders the three destinations', () => {
    render(<BottomNav current="feed" onNavigate={() => {}} />)
    expect(screen.getByRole('button', { name: /journal/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /record/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /settings/i })).toBeInTheDocument()
  })

  it('marks the current destination', () => {
    render(<BottomNav current="record" onNavigate={() => {}} />)
    expect(screen.getByRole('button', { name: /record/i })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('button', { name: /journal/i })).not.toHaveAttribute('aria-current')
  })

  it('navigates on tap', async () => {
    const onNavigate = vi.fn()
    render(<BottomNav current="feed" onNavigate={onNavigate} />)
    await userEvent.click(screen.getByRole('button', { name: /settings/i }))
    expect(onNavigate).toHaveBeenCalledWith('settings')
  })
})
