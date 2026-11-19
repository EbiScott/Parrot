// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import InstallCard from './InstallCard'

afterEach(() => {
  delete window.__parrotInstallPrompt
})

describe('InstallCard', () => {
  it('shows the browser install button when the install prompt is available', () => {
    window.__parrotInstallPrompt = {
      prompt: vi.fn(),
      userChoice: Promise.resolve({ outcome: 'dismissed' }),
    }

    render(<InstallCard />)
    expect(screen.getByRole('button', { name: /install parrot/i })).toBeInTheDocument()
  })

  it('shows manual instructions when the browser cannot prompt', () => {
    render(<InstallCard />)
    expect(screen.getByText(/open parrot over https/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /install parrot/i })).not.toBeInTheDocument()
  })

  it('opens the browser install prompt', async () => {
    const prompt = vi.fn()
    window.__parrotInstallPrompt = {
      prompt,
      userChoice: Promise.resolve({ outcome: 'accepted' }),
    }

    render(<InstallCard compact />)
    await userEvent.click(screen.getByRole('button', { name: /^install$/i }))

    expect(prompt).toHaveBeenCalledOnce()
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /^install$/i })).not.toBeInTheDocument()
    })
  })
})
