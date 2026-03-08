import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mockSignIn = vi.fn()

vi.mock('next-auth/react', () => ({
  signIn: (...args: any[]) => mockSignIn(...args),
}))

vi.mock('next/navigation', () => ({
  useSearchParams: vi.fn(() => ({
    get: vi.fn(() => null),
  })),
}))

import { LoginForm } from '@/app/login/LoginForm'
import { useSearchParams } from 'next/navigation'

describe('LoginForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock window.location
    Object.defineProperty(window, 'location', {
      value: { href: '', origin: 'http://localhost:3000' },
      writable: true,
    })
  })

  it('renders email and password inputs', () => {
    render(<LoginForm />)
    expect(screen.getByPlaceholderText('Email')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Password')).toBeInTheDocument()
  })

  it('renders Google sign-in button', () => {
    render(<LoginForm />)
    expect(screen.getByText('Sign in with Google')).toBeInTheDocument()
  })

  it('calls signIn with google on Google button click', async () => {
    const user = userEvent.setup()
    render(<LoginForm />)
    await user.click(screen.getByText('Sign in with Google'))
    expect(mockSignIn).toHaveBeenCalledWith('google', { callbackUrl: '/' })
  })

  it('submits credentials and redirects on success', async () => {
    const user = userEvent.setup()
    mockSignIn.mockResolvedValue({ error: null })
    render(<LoginForm />)

    await user.type(screen.getByPlaceholderText('Email'), 'test@test.com')
    await user.type(screen.getByPlaceholderText('Password'), 'password123')
    await user.click(screen.getByText('Sign in with email'))

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith('credentials', {
        email: 'test@test.com',
        password: 'password123',
        redirect: false,
      })
      expect(window.location.href).toBe('/')
    })
  })

  it('shows error on credentials failure', async () => {
    const user = userEvent.setup()
    mockSignIn.mockResolvedValue({ error: 'CredentialsSignin' })
    render(<LoginForm />)

    await user.type(screen.getByPlaceholderText('Email'), 'test@test.com')
    await user.type(screen.getByPlaceholderText('Password'), 'wrong')
    await user.click(screen.getByText('Sign in with email'))

    await waitFor(() => {
      expect(screen.getByText('Invalid email or password.')).toBeInTheDocument()
    })
  })

  it('toggles password visibility', async () => {
    const user = userEvent.setup()
    render(<LoginForm />)

    const passwordInput = screen.getByPlaceholderText('Password')
    expect(passwordInput).toHaveAttribute('type', 'password')

    await user.click(screen.getByText('Show'))
    expect(passwordInput).toHaveAttribute('type', 'text')

    await user.click(screen.getByText('Hide'))
    expect(passwordInput).toHaveAttribute('type', 'password')
  })

  it('shows loading state during submission', async () => {
    const user = userEvent.setup()
    mockSignIn.mockImplementation(() => new Promise(() => {})) // never resolves
    render(<LoginForm />)

    await user.type(screen.getByPlaceholderText('Email'), 'test@test.com')
    await user.type(screen.getByPlaceholderText('Password'), 'password')
    await user.click(screen.getByText('Sign in with email'))

    await waitFor(() => {
      expect(screen.getByText('Signing in...')).toBeInTheDocument()
    })
  })

  it('shows OAuth error from URL params', async () => {
    vi.mocked(useSearchParams).mockReturnValue({
      get: vi.fn((key: string) => key === 'error' ? 'OAuthAccountNotLinked' : null),
    } as any)

    render(<LoginForm />)
    expect(screen.getByText('This email is already associated with another account.')).toBeInTheDocument()
  })

  it('has register link', () => {
    render(<LoginForm />)
    expect(screen.getByText('Register')).toHaveAttribute('href', '/register')
  })
})
