import { auth } from "@/auth"
import { NextResponse } from "next/server"
import type { Session } from "next-auth"

/**
 * Verify the request is authenticated.
 * Returns the session or a 401 NextResponse.
 */
export async function requireAuth(): Promise<Session | NextResponse> {
  const session = await auth()

  if (!session?.user) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    )
  }

  return session
}

/**
 * Type guard to check if requireAuth returned a session (not an error response).
 */
export function isSession(result: Session | NextResponse): result is Session {
  return !(result instanceof NextResponse)
}
