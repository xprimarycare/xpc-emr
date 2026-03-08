import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

// Stub env vars needed by modules that throw on missing values at import time
vi.stubEnv('DATABASE_URL', 'postgresql://test:test@localhost:5432/test')
vi.stubEnv('PHENOML_USERNAME', 'test')
vi.stubEnv('PHENOML_PASSWORD', 'test')
vi.stubEnv('PHENOML_BASE_URL', 'https://test.phenoml.com')
vi.stubEnv('AUTH_SECRET', 'test-secret')
vi.stubEnv('PHENOML_FHIR_PROVIDER_ID', 'test-provider')

// Mock Prisma generated client (used by register action)
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
