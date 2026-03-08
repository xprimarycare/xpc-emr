// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createAdminSession, createMockSession } from '../../helpers/mocks'

vi.mock('@/lib/prisma', () => ({
  prisma: { user: { findMany: vi.fn() } },
}))
vi.mock('@/auth', () => ({ auth: vi.fn() }))

import { GET } from '@/app/api/user/list/route'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

const mockAuth = vi.mocked(auth)
const mockFindMany = vi.mocked((prisma as any).user.findMany)

describe('GET /api/user/list', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns users', async () => {
    mockAuth.mockResolvedValue(createMockSession() as any)
    mockFindMany.mockResolvedValue([{ id: 'u1', name: 'Alice' }])
    const res = await GET()
    const json = await res.json()
    expect(json.users).toHaveLength(1)
  })

  it('admin gets extra fields', async () => {
    mockAuth.mockResolvedValue(createAdminSession() as any)
    mockFindMany.mockResolvedValue([])
    await GET()
    const selectArg = mockFindMany.mock.calls[0][0].select
    expect(selectArg).toHaveProperty('email')
    expect(selectArg).toHaveProperty('role')
  })

  it('non-admin does not get extra fields', async () => {
    mockAuth.mockResolvedValue(createMockSession() as any)
    mockFindMany.mockResolvedValue([])
    await GET()
    const selectArg = mockFindMany.mock.calls[0][0].select
    expect(selectArg.email).toBeUndefined()
  })

  it('queries only onboarded users', async () => {
    mockAuth.mockResolvedValue(createMockSession() as any)
    mockFindMany.mockResolvedValue([])
    await GET()
    expect(mockFindMany.mock.calls[0][0].where).toEqual({ onboardingComplete: true })
  })

  it('returns 500 on error', async () => {
    mockAuth.mockResolvedValue(createMockSession() as any)
    mockFindMany.mockRejectedValue(new Error('DB'))
    const res = await GET()
    expect(res.status).toBe(500)
  })
})
