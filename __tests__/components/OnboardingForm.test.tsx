import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OnboardingForm } from '@/app/onboarding/OnboardingForm'

describe('OnboardingForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(window, 'location', {
      value: { href: '' },
      writable: true,
    })
    global.fetch = vi.fn()
  })

  it('renders pre-filled disabled name and email', () => {
    render(<OnboardingForm userName="John" userEmail="john@test.com" />)
    const nameInput = screen.getByDisplayValue('John')
    const emailInput = screen.getByDisplayValue('john@test.com')
    expect(nameInput).toBeDisabled()
    expect(emailInput).toBeDisabled()
  })

  it('renders editable institution and NPI fields', () => {
    render(<OnboardingForm userName="John" userEmail="john@test.com" />)
    expect(screen.getByPlaceholderText(/Metro General/)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/National Provider/)).toBeInTheDocument()
  })

  it('submits and redirects on success', async () => {
    const user = userEvent.setup()
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    } as Response)

    render(<OnboardingForm userName="John" userEmail="john@test.com" />)
    await user.type(screen.getByPlaceholderText(/Metro General/), 'Hospital A')
    await user.click(screen.getByText('Complete Setup'))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/user/onboarding', expect.objectContaining({
        method: 'POST',
      }))
      expect(window.location.href).toBe('/')
    })
  })

  it('shows error on API failure', async () => {
    const user = userEvent.setup()
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'Failed to save profile' }),
    } as Response)

    render(<OnboardingForm userName="John" userEmail="john@test.com" />)
    await user.click(screen.getByText('Complete Setup'))

    await waitFor(() => {
      expect(screen.getByText('Failed to save profile')).toBeInTheDocument()
    })
  })

  it('shows loading state during submission', async () => {
    const user = userEvent.setup()
    vi.mocked(global.fetch).mockImplementation(() => new Promise(() => {}))

    render(<OnboardingForm userName="John" userEmail="john@test.com" />)
    await user.click(screen.getByText('Complete Setup'))

    await waitFor(() => {
      expect(screen.getByText('Saving...')).toBeInTheDocument()
    })
  })

  it('can submit with empty optional fields', async () => {
    const user = userEvent.setup()
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    } as Response)

    render(<OnboardingForm userName="John" userEmail="john@test.com" />)
    await user.click(screen.getByText('Complete Setup'))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled()
    })
  })
})
