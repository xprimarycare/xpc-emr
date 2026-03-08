// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'

vi.mock('@/auth', () => ({ auth: vi.fn() }))

import { requireAuth, isSession } from '@/lib/auth-helpers'
import { auth } from '@/auth'

const mockAuth = vi.mocked(auth)

describe('requireAuth', () => {
  beforeEach(() => {
    mockAuth.mockReset()
  })

  it('returns session when authenticated', async () => {
    const session = {
      user: { id: 'user-1', name: 'Test', email: 'test@test.com' },
      expires: new Date(Date.now() + 86400000).toISOString(),
    }
    mockAuth.mockResolvedValue(session as any)

    const result = await requireAuth()
    expect(isSession(result)).toBe(true)
  })

  it('returns 401 when auth returns null', async () => {
    mockAuth.mockResolvedValue(null as any)

    const result = await requireAuth()
    expect(result).toBeInstanceOf(NextResponse)
    const json = await (result as NextResponse).json()
    expect(json.error).toBe('Authentication required')
  })

  it('returns 401 when session has no user', async () => {
    mockAuth.mockResolvedValue({ user: undefined } as any)

    const result = await requireAuth()
    expect(result).toBeInstanceOf(NextResponse)
  })
})

describe('isSession', () => {
  it('returns true for a plain session object', () => {
    const session = { user: { id: '1' }, expires: '' }
    expect(isSession(session as any)).toBe(true)
  })

  it('returns false for a NextResponse', () => {
    const response = NextResponse.json({ error: 'test' }, { status: 401 })
    expect(isSession(response as any)).toBe(false)
  })
})
