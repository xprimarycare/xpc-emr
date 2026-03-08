import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mockUpdate = vi.fn()
const mockPush = vi.fn()

vi.mock('next-auth/react', () => ({
  useSession: () => ({ update: mockUpdate }),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

import { UserManagement } from '@/app/admin/UserManagement'

const mockUsers = [
  { id: 'user-1', name: 'Alice', email: 'alice@test.com', role: 'user' },
  { id: 'user-2', name: 'Bob', email: 'bob@test.com', role: 'admin' },
  { id: 'admin-1', name: 'Current Admin', email: 'admin@test.com', role: 'admin' },
]

describe('UserManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
  })

  it('shows loading state initially', () => {
    vi.mocked(global.fetch).mockImplementation(() => new Promise(() => {}))
    render(<UserManagement currentUserId="admin-1" />)
    expect(screen.getByText('Loading team members...')).toBeInTheDocument()
  })

  it('renders user list after loading', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ users: mockUsers }),
    } as Response)

    render(<UserManagement currentUserId="admin-1" />)

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument()
      expect(screen.getByText('Bob')).toBeInTheDocument()
    })
  })

  it('shows (you) for current user', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ users: mockUsers }),
    } as Response)

    render(<UserManagement currentUserId="admin-1" />)

    await waitFor(() => {
      expect(screen.getByText('(you)')).toBeInTheDocument()
    })
  })

  it('disables role select for current user', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ users: mockUsers }),
    } as Response)

    render(<UserManagement currentUserId="admin-1" />)

    await waitFor(() => {
      const selects = screen.getAllByRole('combobox')
      // At least one select should be disabled (the current user's)
      const disabledSelects = selects.filter(s => s.hasAttribute('disabled'))
      expect(disabledSelects.length).toBeGreaterThanOrEqual(1)
    })
  })

  it('shows impersonate button for non-self, non-admin users', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ users: mockUsers }),
    } as Response)

    render(<UserManagement currentUserId="admin-1" />)

    await waitFor(() => {
      expect(screen.getByText('Impersonate')).toBeInTheDocument()
    })
  })

  it('handles role change', async () => {
    const user = userEvent.setup()
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ users: mockUsers }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      } as Response)

    render(<UserManagement currentUserId="admin-1" />)

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument()
    })

    // Find Alice's role select and change it
    const selects = screen.getAllByRole('combobox')
    const aliceSelect = selects.find(s => !s.hasAttribute('disabled') && (s as HTMLSelectElement).value === 'user')
    if (aliceSelect) {
      await user.selectOptions(aliceSelect, 'admin')
    }

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/user/role', expect.objectContaining({
        method: 'PATCH',
      }))
    })
  })

  it('handles impersonation', async () => {
    const user = userEvent.setup()
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ users: mockUsers }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      } as Response)

    mockUpdate.mockResolvedValue({})

    render(<UserManagement currentUserId="admin-1" />)

    await waitFor(() => {
      expect(screen.getByText('Impersonate')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Impersonate'))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/admin/impersonate', expect.objectContaining({
        method: 'POST',
      }))
      expect(mockUpdate).toHaveBeenCalled()
      expect(mockPush).toHaveBeenCalledWith('/')
    })
  })
})
