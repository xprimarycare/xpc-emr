/**
 * Simple in-memory sliding-window rate limiter.
 * Suitable for single-instance deployments.
 * For multi-instance, swap for Redis-backed (e.g. Upstash Ratelimit).
 */

interface RateLimitEntry {
  timestamps: number[]
  windowMs: number
}

const store = new Map<string, RateLimitEntry>()

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store) {
    entry.timestamps = entry.timestamps.filter((t) => now - t < entry.windowMs)
    if (entry.timestamps.length === 0) store.delete(key)
  }
}, 300_000).unref()

export function rateLimit(
  key: string,
  { maxRequests, windowMs }: { maxRequests: number; windowMs: number }
): { success: boolean; remaining: number } {
  const now = Date.now()
  const entry = store.get(key) ?? { timestamps: [], windowMs }

  // Keep only timestamps within the window
  entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs)

  if (entry.timestamps.length >= maxRequests) {
    store.set(key, entry)
    return { success: false, remaining: 0 }
  }

  entry.timestamps.push(now)
  store.set(key, entry)
  return { success: true, remaining: maxRequests - entry.timestamps.length }
}
