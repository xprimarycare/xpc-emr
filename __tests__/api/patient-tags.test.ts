// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { createAdminSession, createMockSession } from '../helpers/mocks'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    patientTag: { findMany: vi.fn(), deleteMany: vi.fn(), createMany: vi.fn() },
    $transaction: vi.fn(),
  },
}))
vi.mock('@/auth', () => ({ auth: vi.fn() }))

import { GET, PUT } from '@/app/api/patient-tags/route'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

const mockAuth = vi.mocked(auth)
const mockTagFindMany = vi.mocked((prisma as any).patientTag.findMany)
const mockTransaction = vi.mocked((prisma as any).$transaction)

function makeGetRequest(params: string) {
  return new NextRequest(new Request(`http://localhost/api/patient-tags?${params}`))
}

function makePutRequest(body: any) {
  return new NextRequest(new Request('http://localhost/api/patient-tags', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }))
}

describe('GET /api/patient-tags', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const res = await GET(makeGetRequest('patientFhirIds=p1'))
    expect(res.status).toBe(401)
  })

  it('returns 403 for non-admin', async () => {
    mockAuth.mockResolvedValue(createMockSession() as any)
    const res = await GET(makeGetRequest('patientFhirIds=p1'))
    expect(res.status).toBe(403)
  })

  it('returns 400 when patientFhirIds missing', async () => {
    mockAuth.mockResolvedValue(createAdminSession() as any)
    const res = await GET(makeGetRequest(''))
    expect(res.status).toBe(400)
  })

  it('returns tags grouped by patient and category', async () => {
    mockAuth.mockResolvedValue(createAdminSession() as any)
    mockTagFindMany.mockResolvedValue([
      { patientFhirId: 'p1', category: 'conditions', value: 'COPD', createdAt: new Date() },
      { patientFhirId: 'p1', category: 'competencies', value: 'EPA 1', createdAt: new Date() },
    ])
    const res = await GET(makeGetRequest('patientFhirIds=p1'))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.p1.conditions).toEqual(['COPD'])
    expect(json.p1.competencies).toEqual(['EPA 1'])
    expect(json.p1.contexts).toEqual([])
  })
})

describe('PUT /api/patient-tags', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const res = await PUT(makePutRequest({ patientFhirId: 'p1', tags: {} }))
    expect(res.status).toBe(401)
  })

  it('returns 403 for non-admin', async () => {
    mockAuth.mockResolvedValue(createMockSession() as any)
    const res = await PUT(makePutRequest({ patientFhirId: 'p1', tags: {} }))
    expect(res.status).toBe(403)
  })

  it('returns 400 when patientFhirId missing', async () => {
    mockAuth.mockResolvedValue(createAdminSession() as any)
    const res = await PUT(makePutRequest({ tags: {} }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when tags missing', async () => {
    mockAuth.mockResolvedValue(createAdminSession() as any)
    const res = await PUT(makePutRequest({ patientFhirId: 'p1' }))
    expect(res.status).toBe(400)
  })

  it('replaces tags in a transaction', async () => {
    mockAuth.mockResolvedValue(createAdminSession() as any)
    const txDeleteMany = vi.fn()
    const txCreateMany = vi.fn()
    mockTransaction.mockImplementation(async (fn: any) => {
      return fn({ patientTag: { deleteMany: txDeleteMany, createMany: txCreateMany } })
    })

    const res = await PUT(makePutRequest({
      patientFhirId: 'p1',
      tags: { conditions: ['COPD', 'Asthma'], competencies: ['EPA 1'] },
    }))
    expect(res.status).toBe(200)
    expect(mockTransaction).toHaveBeenCalled()
    // Verify deleteMany called for each provided category
    expect(txDeleteMany).toHaveBeenCalledWith({ where: { patientFhirId: 'p1', category: 'conditions' } })
    expect(txDeleteMany).toHaveBeenCalledWith({ where: { patientFhirId: 'p1', category: 'competencies' } })
    // Verify createMany called with correct tag data
    expect(txCreateMany).toHaveBeenCalledWith({
      data: [
        { patientFhirId: 'p1', category: 'conditions', value: 'COPD' },
        { patientFhirId: 'p1', category: 'conditions', value: 'Asthma' },
      ],
    })
    expect(txCreateMany).toHaveBeenCalledWith({
      data: [
        { patientFhirId: 'p1', category: 'competencies', value: 'EPA 1' },
      ],
    })
  })

  it('returns 500 for tag value exceeding 200 chars (validation thrown inside transaction)', async () => {
    mockAuth.mockResolvedValue(createAdminSession() as any)
    const txDeleteMany = vi.fn()
    const txCreateMany = vi.fn()
    mockTransaction.mockImplementation(async (fn: any) => {
      return fn({ patientTag: { deleteMany: txDeleteMany, createMany: txCreateMany } })
    })

    const res = await PUT(makePutRequest({
      patientFhirId: 'p1',
      tags: { conditions: ['A'.repeat(201)] },
    }))
    expect(res.status).toBe(500)
    // Verify createMany was never called due to validation failure
    expect(txCreateMany).not.toHaveBeenCalled()
  })
})
