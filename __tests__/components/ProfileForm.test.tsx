import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mockRefresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}))

import { ProfileForm } from '@/app/account/ProfileForm'

describe('ProfileForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
  })

  it('renders with initial values', () => {
    render(<ProfileForm institution="Hospital A" npi="1234567890" />)
    expect(screen.getByDisplayValue('Hospital A')).toBeInTheDocument()
    expect(screen.getByDisplayValue('1234567890')).toBeInTheDocument()
  })

  it('renders with null initial values', () => {
    render(<ProfileForm institution={null} npi={null} />)
    expect(screen.getByPlaceholderText(/Metro General/)).toHaveValue('')
    expect(screen.getByPlaceholderText(/National Provider/)).toHaveValue('')
  })

  it('shows Saved! on successful save', async () => {
    const user = userEvent.setup()
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    } as Response)

    render(<ProfileForm institution="Hospital A" npi="123" />)
    await user.click(screen.getByText('Save Changes'))

    await waitFor(() => {
      expect(screen.getByText('Saved!')).toBeInTheDocument()
      expect(mockRefresh).toHaveBeenCalled()
    })
  })

  it('shows error on save failure', async () => {
    const user = userEvent.setup()
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'Failed to save' }),
    } as Response)

    render(<ProfileForm institution="Hospital A" npi="123" />)
    await user.click(screen.getByText('Save Changes'))

    await waitFor(() => {
      expect(screen.getByText('Failed to save')).toBeInTheDocument()
    })
  })

  it('shows Saving... during submission', async () => {
    const user = userEvent.setup()
    vi.mocked(global.fetch).mockImplementation(() => new Promise(() => {}))

    render(<ProfileForm institution={null} npi={null} />)
    await user.click(screen.getByText('Save Changes'))

    await waitFor(() => {
      expect(screen.getByText('Saving...')).toBeInTheDocument()
    })
  })

  it('success message auto-clears after timeout', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    } as Response)

    render(<ProfileForm institution={null} npi={null} />)
    await user.click(screen.getByText('Save Changes'))

    await waitFor(() => {
      expect(screen.getByText('Saved!')).toBeInTheDocument()
    })

    // Advance past the 2000ms setTimeout in the component
    await act(async () => {
      vi.advanceTimersByTime(2100)
    })

    expect(screen.getByText('Save Changes')).toBeInTheDocument()

    vi.useRealTimers()
  })
})
