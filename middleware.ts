import NextAuth from "next-auth"
import authConfig from "./auth.config"
import { NextResponse } from "next/server"

const { auth } = NextAuth(authConfig)

export default auth((req) => {
  const { pathname } = req.nextUrl

  // Allow public routes
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/api/auth")
  ) {
    return NextResponse.next()
  }

  // Check authentication
  if (!req.auth) {
    // API routes: return 401 JSON
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      )
    }

    // Page routes: redirect to login
    const loginUrl = new URL("/login", req.url)
    loginUrl.searchParams.set("callbackUrl", pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Enforce onboarding for authenticated page routes (not API or the onboarding page itself)
  if (
    !pathname.startsWith("/api/") &&
    !pathname.startsWith("/onboarding") &&
    !req.auth.user?.onboardingComplete
  ) {
    return NextResponse.redirect(new URL("/onboarding", req.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|public/).*)",
  ],
}
