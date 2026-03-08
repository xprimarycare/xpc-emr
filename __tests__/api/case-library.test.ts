// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { createAdminSession, createMockSession } from '../helpers/mocks'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findMany: vi.fn() },
    userPatient: { findMany: vi.fn(), findUnique: vi.fn() },
  },
}))
vi.mock('@/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/phenoml/client', () => ({
  phenomlClient: {
    fhir: {
      search: vi.fn().mockResolvedValue({ entry: [] }),
    },
  },
}))
vi.mock('@/lib/phenoml/fhir-mapper', () => ({
  mapFhirBundleToEncounters: vi.fn().mockReturnValue([]),
}))

import { GET } from '@/app/api/case-library/route'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

const mockAuth = vi.mocked(auth)
const mockUserFindMany = vi.mocked((prisma as any).user.findMany)
const mockUserPatientFindMany = vi.mocked((prisma as any).userPatient.findMany)
const mockUserPatientFindUnique = vi.mocked((prisma as any).userPatient.findUnique)

function makeRequest(params: string) {
  return new NextRequest(new Request(`http://localhost/api/case-library?${params}`))
}

describe('GET /api/case-library', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const res = await GET(makeRequest('view=users'))
    expect(res.status).toBe(401)
  })

  it('returns 400 for missing view parameter', async () => {
    mockAuth.mockResolvedValue(createAdminSession() as any)
    const res = await GET(makeRequest(''))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid view parameter', async () => {
    mockAuth.mockResolvedValue(createAdminSession() as any)
    const res = await GET(makeRequest('view=invalid'))
    expect(res.status).toBe(400)
  })

  describe('view=users', () => {
    it('returns 403 for non-admin', async () => {
      mockAuth.mockResolvedValue(createMockSession() as any)
      const res = await GET(makeRequest('view=users'))
      expect(res.status).toBe(403)
    })

    it('returns user list for admin', async () => {
      mockAuth.mockResolvedValue(createAdminSession() as any)
      mockUserFindMany.mockResolvedValue([
        {
          id: 'u1', name: 'Alice', email: 'alice@test.com', institution: 'Hospital A',
          _count: { patients: 2 },
          patients: [{ patientFhirId: 'p1' }, { patientFhirId: 'p2' }],
        },
      ])
      const res = await GET(makeRequest('view=users'))
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json).toHaveLength(1)
      expect(json[0]).toHaveProperty('name', 'Alice')
      expect(json[0]).toHaveProperty('patientCount', 2)
    })
  })

  describe('view=user-patients', () => {
    it('returns 400 when userId missing', async () => {
      mockAuth.mockResolvedValue(createAdminSession() as any)
      const res = await GET(makeRequest('view=user-patients'))
      expect(res.status).toBe(400)
    })

    it('returns 403 for non-admin viewing another user', async () => {
      mockAuth.mockResolvedValue(createMockSession() as any)
      const res = await GET(makeRequest('view=user-patients&userId=other'))
      expect(res.status).toBe(403)
    })

    it('allows user to view own patients', async () => {
      mockAuth.mockResolvedValue(createMockSession() as any)
      mockUserPatientFindMany.mockResolvedValue([])
      const res = await GET(makeRequest('view=user-patients&userId=user-1'))
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json).toEqual([])
    })
  })

  describe('view=assignments', () => {
    it('returns 403 for non-admin', async () => {
      mockAuth.mockResolvedValue(createMockSession() as any)
      const res = await GET(makeRequest('view=assignments'))
      expect(res.status).toBe(403)
    })

    it('returns assignments for admin', async () => {
      mockAuth.mockResolvedValue(createAdminSession() as any)
      mockUserPatientFindMany.mockResolvedValue([
        {
          id: 'a1', patientFhirId: 'p1', userId: 'u1', status: 'waiting_room',
          assignedAt: new Date(), assignedBy: null,
          user: { name: 'Alice', email: 'alice@test.com' },
        },
      ])
      const res = await GET(makeRequest('view=assignments'))
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json).toHaveLength(1)
      expect(json[0]).toHaveProperty('clinicianName', 'Alice')
    })
  })

  describe('view=patient-encounters', () => {
    it('returns 400 when patientFhirId missing', async () => {
      mockAuth.mockResolvedValue(createAdminSession() as any)
      const res = await GET(makeRequest('view=patient-encounters'))
      expect(res.status).toBe(400)
    })

    it('returns 403 for non-admin without assignment', async () => {
      mockAuth.mockResolvedValue(createMockSession() as any)
      mockUserPatientFindUnique.mockResolvedValue(null)
      const res = await GET(makeRequest('view=patient-encounters&patientFhirId=p1'))
      expect(res.status).toBe(403)
    })

    it('returns encounters for admin', async () => {
      mockAuth.mockResolvedValue(createAdminSession() as any)
      const res = await GET(makeRequest('view=patient-encounters&patientFhirId=p1'))
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json).toEqual([]) // mapFhirBundleToEncounters returns [] so no signed encounters
    })
  })

  describe('view=recent-activity', () => {
    it('returns 403 for non-admin', async () => {
      mockAuth.mockResolvedValue(createMockSession() as any)
      const res = await GET(makeRequest('view=recent-activity'))
      expect(res.status).toBe(403)
    })

    it('returns recent activity for admin', async () => {
      mockAuth.mockResolvedValue(createAdminSession() as any)
      mockUserPatientFindMany.mockResolvedValue([])
      const res = await GET(makeRequest('view=recent-activity'))
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json).toEqual([]) // no assignments means no encounters to report
    })
  })
})
