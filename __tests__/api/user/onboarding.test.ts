// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { createMockSession } from '../../helpers/mocks'

vi.mock('@/lib/prisma', () => ({
  prisma: { user: { update: vi.fn() } },
}))
vi.mock('@/auth', () => ({ auth: vi.fn() }))

import { POST } from '@/app/api/user/onboarding/route'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

const mockAuth = vi.mocked(auth)
const mockUserUpdate = vi.mocked((prisma as any).user.update)

function makeRequest(body: any) {
  return new NextRequest(new Request('http://localhost/api/user/onboarding', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }))
}

describe('POST /api/user/onboarding', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(401)
  })

  it('succeeds with all fields', async () => {
    mockAuth.mockResolvedValue(createMockSession() as any)
    mockUserUpdate.mockResolvedValue({} as any)
    const res = await POST(makeRequest({ institution: 'Hospital A', npi: '123', fhirPractitionerId: 'p1' }))
    expect(res.status).toBe(200)
    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { institution: 'Hospital A', npi: '123', fhirPractitionerId: 'p1', onboardingComplete: true },
    })
  })

  it('stores null for empty optional fields', async () => {
    mockAuth.mockResolvedValue(createMockSession() as any)
    mockUserUpdate.mockResolvedValue({} as any)
    await POST(makeRequest({}))
    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: expect.objectContaining({ institution: null, npi: null, fhirPractitionerId: null, onboardingComplete: true }),
    })
  })

  it('returns 500 on database error', async () => {
    mockAuth.mockResolvedValue(createMockSession() as any)
    mockUserUpdate.mockRejectedValue(new Error('DB error'))
    const res = await POST(makeRequest({ institution: 'Test' }))
    expect(res.status).toBe(500)
  })
})
