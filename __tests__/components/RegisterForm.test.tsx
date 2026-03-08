import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mockSignIn = vi.fn()
const mockRegister = vi.fn()

vi.mock('next-auth/react', () => ({
  signIn: (...args: any[]) => mockSignIn(...args),
}))

vi.mock('@/app/register/actions', () => ({
  register: (...args: any[]) => mockRegister(...args),
}))

import { RegisterForm } from '@/app/register/RegisterForm'

// The form uses labels without htmlFor, so getByLabelText won't work for all fields.
// Use getByRole with name for accessible queries, or fall back to DOM queries.
function getInput(name: string) {
  // Find the label text, then the input in the same parent container
  const label = screen.getByText(name)
  const container = label.closest('div')!
  return container.querySelector('input')!
}

describe('RegisterForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(window, 'location', {
      value: { href: '' },
      writable: true,
    })
  })

  it('renders name, email, and password fields', () => {
    render(<RegisterForm />)
    expect(screen.getByText('Name')).toBeInTheDocument()
    expect(screen.getByText('Email')).toBeInTheDocument()
    expect(screen.getByText('Password')).toBeInTheDocument()
    // Verify inputs exist
    expect(getInput('Name')).toBeInTheDocument()
    expect(getInput('Email')).toBeInTheDocument()
    expect(getInput('Password')).toBeInTheDocument()
  })

  it('submits and auto-signs in on success', async () => {
    const user = userEvent.setup()
    mockRegister.mockResolvedValue({ success: true })
    mockSignIn.mockResolvedValue({ error: null })
    render(<RegisterForm />)

    await user.type(getInput('Name'), 'John')
    await user.type(getInput('Email'), 'john@test.com')
    await user.type(getInput('Password'), 'password123')
    await user.click(screen.getByText('Create account'))

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith({
        name: 'John',
        email: 'john@test.com',
        password: 'password123',
      })
      expect(mockSignIn).toHaveBeenCalledWith('credentials', {
        email: 'john@test.com',
        password: 'password123',
        redirect: false,
      })
    })
  })

  it('shows error from register action', async () => {
    const user = userEvent.setup()
    mockRegister.mockResolvedValue({ error: 'Email already exists' })
    render(<RegisterForm />)

    await user.type(getInput('Name'), 'John')
    await user.type(getInput('Email'), 'john@test.com')
    await user.type(getInput('Password'), 'password123')
    await user.click(screen.getByText('Create account'))

    await waitFor(() => {
      expect(screen.getByText('Email already exists')).toBeInTheDocument()
    })
  })

  it('shows error when sign-in fails after registration', async () => {
    const user = userEvent.setup()
    mockRegister.mockResolvedValue({ success: true })
    mockSignIn.mockResolvedValue({ error: 'CredentialsSignin' })
    render(<RegisterForm />)

    await user.type(getInput('Name'), 'John')
    await user.type(getInput('Email'), 'john@test.com')
    await user.type(getInput('Password'), 'password123')
    await user.click(screen.getByText('Create account'))

    await waitFor(() => {
      expect(screen.getByText('Account created but sign-in failed. Please sign in manually.')).toBeInTheDocument()
    })
  })

  it('shows loading state', async () => {
    const user = userEvent.setup()
    mockRegister.mockImplementation(() => new Promise(() => {}))
    render(<RegisterForm />)

    await user.type(getInput('Name'), 'John')
    await user.type(getInput('Email'), 'john@test.com')
    await user.type(getInput('Password'), 'password123')
    await user.click(screen.getByText('Create account'))

    await waitFor(() => {
      expect(screen.getByText('Creating account...')).toBeInTheDocument()
    })
  })

  it('toggles password visibility', async () => {
    const user = userEvent.setup()
    render(<RegisterForm />)

    const passwordInput = getInput('Password')
    expect(passwordInput).toHaveAttribute('type', 'password')

    await user.click(screen.getByText('Show'))
    expect(passwordInput).toHaveAttribute('type', 'text')
  })

  it('has sign in link', () => {
    render(<RegisterForm />)
    expect(screen.getByText('Sign in')).toHaveAttribute('href', '/login')
  })
})
