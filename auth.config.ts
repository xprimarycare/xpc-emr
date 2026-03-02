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
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.onboardingComplete =
          (user as unknown as Record<string, unknown>).onboardingComplete ??
          false
      }
      return token
    },
    async session({ session, token }) {
      session.user.id = token.id as string
      ;(session.user as unknown as Record<string, unknown>).onboardingComplete =
        token.onboardingComplete as boolean
      return session
    },
  },
} satisfies NextAuthConfig
