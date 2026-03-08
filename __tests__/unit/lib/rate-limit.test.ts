import { rateLimit } from '@/lib/rate-limit'

describe('rateLimit', () => {
  it('allows the first request', () => {
    const key = `test-${Date.now()}-first`
    const result = rateLimit(key, { maxRequests: 5, windowMs: 60000 })
    expect(result.success).toBe(true)
    expect(result.remaining).toBe(4)
  })

  it('decrements remaining count', () => {
    const key = `test-${Date.now()}-decrement`
    rateLimit(key, { maxRequests: 5, windowMs: 60000 })
    const result = rateLimit(key, { maxRequests: 5, windowMs: 60000 })
    expect(result.remaining).toBe(3)
  })

  it('blocks after maxRequests is reached', () => {
    const key = `test-${Date.now()}-block`
    for (let i = 0; i < 3; i++) {
      rateLimit(key, { maxRequests: 3, windowMs: 60000 })
    }
    const result = rateLimit(key, { maxRequests: 3, windowMs: 60000 })
    expect(result.success).toBe(false)
    expect(result.remaining).toBe(0)
  })

  it('uses independent counters per key', () => {
    const key1 = `test-${Date.now()}-ind1`
    const key2 = `test-${Date.now()}-ind2`

    for (let i = 0; i < 2; i++) {
      rateLimit(key1, { maxRequests: 2, windowMs: 60000 })
    }
    expect(rateLimit(key1, { maxRequests: 2, windowMs: 60000 }).success).toBe(false)
    expect(rateLimit(key2, { maxRequests: 2, windowMs: 60000 }).success).toBe(true)
  })

  it('resets after window expires', () => {
    const key = `test-${Date.now()}-expire`
    let currentTime = 1000000

    vi.spyOn(Date, 'now').mockImplementation(() => currentTime)

    for (let i = 0; i < 2; i++) {
      rateLimit(key, { maxRequests: 2, windowMs: 1000 })
    }
    expect(rateLimit(key, { maxRequests: 2, windowMs: 1000 }).success).toBe(false)

    // Advance time past the window
    currentTime += 1001
    const result = rateLimit(key, { maxRequests: 2, windowMs: 1000 })
    expect(result.success).toBe(true)
    expect(result.remaining).toBe(1)
  })
})
