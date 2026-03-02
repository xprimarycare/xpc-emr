import type { NextAuthConfig } from "next-auth"
import Google from "next-auth/providers/google"

/**
 * Auth config without the Prisma adapter.
 * Used by middleware (Edge Runtime) where Node.js modules aren't available.
 */
export default {
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  ],
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    // Map custom JWT fields → session.user so the middleware can read them.
    // No DB access — safe for Edge Runtime.
    session({ session, token }) {
      session.user.id = token.id as string
      session.user.institution = token.institution as string | null
      session.user.npi = token.npi as string | null
      session.user.fhirPractitionerId = token.fhirPractitionerId as string | null
      session.user.onboardingComplete = token.onboardingComplete as boolean
      return session
    },
  },
} satisfies NextAuthConfig
