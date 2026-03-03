import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"
import authConfig from "./auth.config"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      name: string | null
      email: string
      image: string | null
      institution: string | null
      npi: string | null
      fhirPractitionerId: string | null
      onboardingComplete: boolean
      role: string
    }
  }

  interface User {
    institution: string | null
    npi: string | null
    fhirPractitionerId: string | null
    onboardingComplete: boolean
    role: string
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adapter: PrismaAdapter(prisma) as any,
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user, trigger }) {
      // On sign-in, seed the token from the DB user
      if (user) {
        token.id = user.id
        token.institution = user.institution ?? null
        token.npi = user.npi ?? null
        token.fhirPractitionerId = user.fhirPractitionerId ?? null
        token.onboardingComplete = user.onboardingComplete ?? false
        token.role = user.role ?? 'user'
      }

      // Only refresh from DB when explicitly triggered (e.g. after onboarding)
      if (trigger === "update" && token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: {
            institution: true,
            npi: true,
            fhirPractitionerId: true,
            onboardingComplete: true,
            role: true,
          },
        })
        if (dbUser) {
          token.institution = dbUser.institution
          token.npi = dbUser.npi
          token.fhirPractitionerId = dbUser.fhirPractitionerId
          token.onboardingComplete = dbUser.onboardingComplete
          token.role = dbUser.role
        }
      }

      return token
    },
    async session({ session, token }) {
      session.user.id = token.id as string
      session.user.institution = token.institution as string | null
      session.user.npi = token.npi as string | null
      session.user.fhirPractitionerId = token.fhirPractitionerId as string | null
      session.user.onboardingComplete = token.onboardingComplete as boolean
      session.user.role = token.role as string
      return session
    },
  },
})
