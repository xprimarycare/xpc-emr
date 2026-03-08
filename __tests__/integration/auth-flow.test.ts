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

describe('Authentication Flow Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRateLimit.mockReturnValue({ success: true, remaining: 4 })
    mockPrisma.user.create.mockResolvedValue({})
  })

  it('register -> validates input -> hashes password -> creates user', async () => {
    const result = await register({
      name: 'Jane Doe',
      email: 'jane@hospital.org',
      password: 'securePassword123',
    })

    expect(result).toEqual({ success: true })
    expect(mockPrisma.user.create).toHaveBeenCalledWith({
      data: {
        name: 'Jane Doe',
        email: 'jane@hospital.org',
        hashedPassword: 'hashed_password',
      },
    })
  })

  it('register with duplicate email returns user-friendly error', async () => {
    const { Prisma } = await import('@/app/generated/prisma/client')
    mockPrisma.user.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique', { code: 'P2002' })
    )

    const result = await register({
      name: 'Jane',
      email: 'existing@hospital.org',
      password: 'securePassword123',
    })

    expect(result).toEqual({ error: 'An account with this email already exists' })
  })

  it('rate limiting prevents rapid registrations', async () => {
    // First call succeeds
    const result1 = await register({
      name: 'User1',
      email: 'user1@test.com',
      password: 'password123',
    })
    expect(result1).toEqual({ success: true })

    // Rate limit kicks in
    mockRateLimit.mockReturnValue({ success: false, remaining: 0 })
    const result2 = await register({
      name: 'User2',
      email: 'user2@test.com',
      password: 'password123',
    })
    expect(result2).toEqual({ error: 'Too many requests. Please try again later.' })
    expect(mockPrisma.user.create).toHaveBeenCalledTimes(1) // Only first call hit DB
  })

  it('validation runs before rate limiting and DB operations', async () => {
    const result = await register({
      name: '',
      email: 'bad',
      password: '1',
    })

    expect(result).toHaveProperty('error')
    // Validation short-circuits before rate limiting and DB operations
    expect(mockRateLimit).not.toHaveBeenCalled()
    expect(mockPrisma.user.create).not.toHaveBeenCalled()
  })
})
