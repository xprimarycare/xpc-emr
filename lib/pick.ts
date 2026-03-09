/**
 * Pick only the specified keys from an object.
 * Used to prevent mass assignment by allowlisting fields.
 */
export function pick(
  obj: Record<string, unknown>,
  keys: readonly string[]
): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const key of keys) {
    if (key in obj) {
      result[key] = obj[key]
    }
  }
  return result
}
