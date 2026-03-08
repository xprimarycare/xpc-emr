// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { create: vi.fn() },
  },
}))

vi.mock('bcryptjs', () => ({
  default: { hash: vi.fn().mockResolvedValue('hashed_password') },
}))

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue({
    get: vi.fn((name: string) => {
      if (name === 'x-real-ip') return '127.0.0.1'
      return null
    }),
  }),
}))

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn().mockReturnValue({ success: true, remaining: 4 }),
}))

vi.mock('@/app/generated/prisma/client', () => {
  class MockPrismaClientKnownRequestError extends Error {
    code: string
    clientVersion: string
    constructor(message: string, meta: { code: string; clientVersion?: string }) {
      super(message)
      this.code = meta.code
      this.clientVersion = meta.clientVersion ?? '0.0.0'
      this.name = 'PrismaClientKnownRequestError'
    }
  }
  return {
    Prisma: {
      PrismaClientKnownRequestError: MockPrismaClientKnownRequestError,
    },
  }
})

import { register } from '@/app/register/actions'
import { prisma } from '@/lib/prisma'
import { rateLimit } from '@/lib/rate-limit'

const mockPrisma = prisma as any
const mockRateLimit = vi.mocked(rateLimit)

describe('register', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRateLimit.mockReturnValue({ success: true, remaining: 4 })
    mockPrisma.user.create.mockResolvedValue({})
  })

  it('succeeds with valid input', async () => {
    const result = await register({
      name: 'John Doe',
      email: 'john@example.com',
      password: 'password123',
    })
    expect(result).toEqual({ success: true })
    expect(mockPrisma.user.create).toHaveBeenCalledWith({
      data: {
        name: 'John Doe',
        email: 'john@example.com',
        hashedPassword: 'hashed_password',
      },
    })
  })

  it('rejects empty name', async () => {
    const result = await register({
      name: '',
      email: 'john@example.com',
      password: 'password123',
    })
    expect(result).toHaveProperty('error')
  })

  it('rejects name over 200 chars', async () => {
    const result = await register({
      name: 'A'.repeat(201),
      email: 'john@example.com',
      password: 'password123',
    })
    expect(result).toHaveProperty('error')
  })

  it('rejects invalid email', async () => {
    const result = await register({
      name: 'John',
      email: 'not-an-email',
      password: 'password123',
    })
    expect(result).toHaveProperty('error')
  })

  it('rejects password under 8 chars', async () => {
    const result = await register({
      name: 'John',
      email: 'john@example.com',
      password: 'short',
    })
    expect(result).toHaveProperty('error')
  })

  it('rejects password over 72 chars', async () => {
    const result = await register({
      name: 'John',
      email: 'john@example.com',
      password: 'A'.repeat(73),
    })
    expect(result).toHaveProperty('error')
  })

  it('returns error when rate limited', async () => {
    mockRateLimit.mockReturnValue({ success: false, remaining: 0 })
    const result = await register({
      name: 'John',
      email: 'john@example.com',
      password: 'password123',
    })
    expect(result).toEqual({ error: 'Too many requests. Please try again later.' })
  })

  it('returns error for duplicate email (P2002)', async () => {
    const { Prisma } = await import('@/app/generated/prisma/client')
    mockPrisma.user.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint', { code: 'P2002' })
    )
    const result = await register({
      name: 'John',
      email: 'john@example.com',
      password: 'password123',
    })
    expect(result).toEqual({ error: 'An account with this email already exists' })
  })

  it('returns generic error for unknown DB errors', async () => {
    mockPrisma.user.create.mockRejectedValue(new Error('Connection failed'))
    const result = await register({
      name: 'John',
      email: 'john@example.com',
      password: 'password123',
    })
    expect(result).toEqual({ error: 'Registration failed' })
  })

  it('normalizes email to lowercase and trims', async () => {
    await register({
      name: 'John',
      email: '  JOHN@Example.COM  ',
      password: 'password123',
    })
    expect(mockPrisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'john@example.com',
        }),
      })
    )
  })
})
