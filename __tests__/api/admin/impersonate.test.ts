// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { createAdminSession, createMockSession } from '../../helpers/mocks'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    impersonationLog: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  },
}))
vi.mock('@/auth', () => ({ auth: vi.fn() }))

import { POST } from '@/app/api/admin/impersonate/route'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

const mockAuth = vi.mocked(auth)
const mockUserFindUnique = vi.mocked((prisma as any).user.findUnique)
const mockLogCreate = vi.mocked((prisma as any).impersonationLog.create)
const mockLogFindFirst = vi.mocked((prisma as any).impersonationLog.findFirst)
const mockLogUpdate = vi.mocked((prisma as any).impersonationLog.update)

function makeRequest(body: any) {
  return new NextRequest(new Request('http://localhost/api/admin/impersonate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }))
}

describe('POST /api/admin/impersonate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('start impersonation', () => {
    it('returns 401 when unauthenticated', async () => {
      mockAuth.mockResolvedValue(null)
      const res = await POST(makeRequest({ userId: 'u2' }))
      expect(res.status).toBe(401)
    })

    it('returns 403 for non-admin', async () => {
      mockAuth.mockResolvedValue(createMockSession() as any)
      const res = await POST(makeRequest({ userId: 'u2' }))
      expect(res.status).toBe(403)
    })

    it('returns 403 if already impersonating', async () => {
      mockAuth.mockResolvedValue(createAdminSession({ originalAdminId: 'other-admin' }) as any)
      const res = await POST(makeRequest({ userId: 'u2' }))
      expect(res.status).toBe(403)
    })

    it('returns 400 for self-impersonation', async () => {
      mockAuth.mockResolvedValue(createAdminSession() as any)
      const res = await POST(makeRequest({ userId: 'admin-1' }))
      expect(res.status).toBe(400)
    })

    it('returns 404 when target user not found', async () => {
      mockAuth.mockResolvedValue(createAdminSession() as any)
      mockUserFindUnique.mockResolvedValue(null)
      const res = await POST(makeRequest({ userId: 'nonexistent' }))
      expect(res.status).toBe(404)
    })

    it('creates log and returns target name', async () => {
      mockAuth.mockResolvedValue(createAdminSession() as any)
      mockUserFindUnique.mockResolvedValue({ id: 'u2', name: 'Jane' } as any)
      mockLogCreate.mockResolvedValue({} as any)

      const res = await POST(makeRequest({ userId: 'u2' }))
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.targetUserName).toBe('Jane')
      expect(mockLogCreate).toHaveBeenCalledWith({
        data: { adminId: 'admin-1', targetUserId: 'u2' },
      })
    })
  })

  describe('stop impersonation', () => {
    it('returns 400 when not impersonating', async () => {
      mockAuth.mockResolvedValue(createAdminSession() as any)
      const res = await POST(makeRequest({}))
      expect(res.status).toBe(400)
    })

    it('closes open log and returns success', async () => {
      const session = createMockSession({
        id: 'target-user',
        role: 'user',
        originalAdminId: 'admin-1',
      })
      mockAuth.mockResolvedValue(session as any)
      mockLogFindFirst.mockResolvedValue({ id: 'log-1' } as any)
      mockLogUpdate.mockResolvedValue({} as any)

      const res = await POST(makeRequest({}))
      expect(res.status).toBe(200)
      expect(mockLogUpdate).toHaveBeenCalledWith({
        where: { id: 'log-1' },
        data: { endedAt: expect.any(Date) },
      })
    })

    it('returns success even without open log', async () => {
      const session = createMockSession({
        id: 'target-user',
        role: 'user',
        originalAdminId: 'admin-1',
      })
      mockAuth.mockResolvedValue(session as any)
      mockLogFindFirst.mockResolvedValue(null)

      const res = await POST(makeRequest({}))
      expect(res.status).toBe(200)
    })
  })

  it('returns 500 on unexpected error', async () => {
    mockAuth.mockResolvedValue(createAdminSession() as any)
    mockUserFindUnique.mockRejectedValue(new Error('DB down'))
    const res = await POST(makeRequest({ userId: 'u2' }))
    expect(res.status).toBe(500)
  })
})
