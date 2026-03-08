// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { createAdminSession, createMockSession } from '../../helpers/mocks'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    userPatient: { findMany: vi.fn(), upsert: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
  },
}))
vi.mock('@/auth', () => ({ auth: vi.fn() }))

import { GET, POST, PATCH, DELETE } from '@/app/api/user/patients/route'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

const mockAuth = vi.mocked(auth)
const mockUserFindUnique = vi.mocked((prisma as any).user.findUnique)
const mockFindMany = vi.mocked((prisma as any).userPatient.findMany)
const mockUpsert = vi.mocked((prisma as any).userPatient.upsert)
const mockUpdateMany = vi.mocked((prisma as any).userPatient.updateMany)
const mockDeleteMany = vi.mocked((prisma as any).userPatient.deleteMany)

function makeRequest(method: string, body?: any) {
  return new NextRequest(new Request('http://localhost/api/user/patients', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  }))
}

describe('GET /api/user/patients', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns assignments', async () => {
    mockAuth.mockResolvedValue(createMockSession() as any)
    const assignments = [
      { patientFhirId: 'p1', status: 'waiting_room', assignedAt: new Date() },
    ]
    mockFindMany.mockResolvedValue(assignments)
    const res = await GET()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.patientFhirIds).toEqual(['p1'])
    expect(json.assignments).toHaveLength(1)
  })

  it('returns empty for no assignments', async () => {
    mockAuth.mockResolvedValue(createMockSession() as any)
    mockFindMany.mockResolvedValue([])
    const res = await GET()
    const json = await res.json()
    expect(json.patientFhirIds).toEqual([])
  })
})

describe('POST /api/user/patients', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const res = await POST(makeRequest('POST', { patientFhirId: 'p1' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 when patientFhirId missing', async () => {
    mockAuth.mockResolvedValue(createMockSession() as any)
    const res = await POST(makeRequest('POST', {}))
    expect(res.status).toBe(400)
  })

  it('self-assignment succeeds', async () => {
    mockAuth.mockResolvedValue(createMockSession() as any)
    mockUpsert.mockResolvedValue({ id: 'a1' } as any)
    const res = await POST(makeRequest('POST', { patientFhirId: 'p1' }))
    expect(res.status).toBe(200)
    expect(mockUpsert).toHaveBeenCalled()
  })

  it('admin can assign to another user', async () => {
    mockAuth.mockResolvedValue(createAdminSession() as any)
    mockUserFindUnique.mockResolvedValue({ id: 'u2', onboardingComplete: true } as any)
    mockUpsert.mockResolvedValue({ id: 'a1' } as any)
    const res = await POST(makeRequest('POST', { patientFhirId: 'p1', userId: 'u2' }))
    expect(res.status).toBe(200)
  })

  it('non-admin cannot assign to another user', async () => {
    mockAuth.mockResolvedValue(createMockSession() as any)
    const res = await POST(makeRequest('POST', { patientFhirId: 'p1', userId: 'other' }))
    expect(res.status).toBe(403)
  })

  it('returns 404 when target user not found or not onboarded', async () => {
    mockAuth.mockResolvedValue(createAdminSession() as any)
    mockUserFindUnique.mockResolvedValue(null)
    const res = await POST(makeRequest('POST', { patientFhirId: 'p1', userId: 'nonexistent' }))
    expect(res.status).toBe(404)
  })
})

describe('PATCH /api/user/patients', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const res = await PATCH(makeRequest('PATCH', { patientFhirId: 'p1', status: 'in_progress' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 when patientFhirId missing', async () => {
    mockAuth.mockResolvedValue(createMockSession() as any)
    const res = await PATCH(makeRequest('PATCH', { status: 'in_progress' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid status', async () => {
    mockAuth.mockResolvedValue(createMockSession() as any)
    const res = await PATCH(makeRequest('PATCH', { patientFhirId: 'p1', status: 'invalid' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for status with no valid transition (waiting_room cannot be transitioned TO)', async () => {
    mockAuth.mockResolvedValue(createMockSession() as any)
    const res = await PATCH(makeRequest('PATCH', { patientFhirId: 'p1', status: 'waiting_room' }))
    expect(res.status).toBe(400)
  })

  it('succeeds for valid transition waiting_room -> in_progress', async () => {
    mockAuth.mockResolvedValue(createMockSession() as any)
    mockUpdateMany.mockResolvedValue({ count: 1 })
    const res = await PATCH(makeRequest('PATCH', { patientFhirId: 'p1', status: 'in_progress' }))
    expect(res.status).toBe(200)
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        patientFhirId: 'p1',
        status: 'waiting_room',
      },
      data: { status: 'in_progress' },
    })
  })

  it('succeeds for valid transition in_progress -> completed', async () => {
    mockAuth.mockResolvedValue(createMockSession() as any)
    mockUpdateMany.mockResolvedValue({ count: 1 })
    const res = await PATCH(makeRequest('PATCH', { patientFhirId: 'p1', status: 'completed' }))
    expect(res.status).toBe(200)
  })

  it('returns 400 when assignment not found or wrong current status', async () => {
    mockAuth.mockResolvedValue(createMockSession() as any)
    mockUpdateMany.mockResolvedValue({ count: 0 })
    const res = await PATCH(makeRequest('PATCH', { patientFhirId: 'p1', status: 'in_progress' }))
    expect(res.status).toBe(400)
  })
})

describe('DELETE /api/user/patients', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const res = await DELETE(makeRequest('DELETE', { patientFhirId: 'p1' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 when patientFhirId missing', async () => {
    mockAuth.mockResolvedValue(createMockSession() as any)
    const res = await DELETE(makeRequest('DELETE', {}))
    expect(res.status).toBe(400)
  })

  it('deletes assignment successfully', async () => {
    mockAuth.mockResolvedValue(createMockSession() as any)
    mockDeleteMany.mockResolvedValue({ count: 1 })
    const res = await DELETE(makeRequest('DELETE', { patientFhirId: 'p1' }))
    expect(res.status).toBe(200)
    expect(mockDeleteMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        patientFhirId: 'p1',
      },
    })
  })
})
