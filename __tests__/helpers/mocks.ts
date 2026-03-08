import { vi } from 'vitest'

// -- Shared Prisma error mock (single source of truth) --
export class MockPrismaClientKnownRequestError extends Error {
  code: string
  clientVersion: string
  constructor(message: string, meta: { code: string; clientVersion?: string }) {
    super(message)
    this.code = meta.code
    this.clientVersion = meta.clientVersion ?? '0.0.0'
    this.name = 'PrismaClientKnownRequestError'
  }
}

// -- NextAuth mock session factory --
export function createMockSession(overrides: Record<string, any> = {}) {
  return {
    user: {
      id: 'user-1',
      name: 'Test User',
      email: 'test@example.com',
      image: null,
      institution: null,
      npi: null,
      fhirPractitionerId: null,
      onboardingComplete: true,
      role: 'user',
      ...overrides,
    },
    expires: new Date(Date.now() + 86400000).toISOString(),
  }
}

export function createAdminSession(overrides: Record<string, any> = {}) {
  return createMockSession({ id: 'admin-1', role: 'admin', ...overrides })
}

// -- NextRequest helper --
export function createRequest(
  method: string,
  body?: any,
  url = 'http://localhost:3000/api/test'
) {
  return new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
}
