import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import Google from "next-auth/providers/google"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { rateLimit } from "@/lib/rate-limit"
import authConfig from "./auth.config"

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

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
    }
  }

  interface User {
    institution: string | null
    npi: string | null
    fhirPractitionerId: string | null
    onboardingComplete: boolean
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adapter: PrismaAdapter(prisma) as any,
  // Override providers to add real Credentials authorize with DB access
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials)
        if (!parsed.success) return null

        const normalizedEmail = parsed.data.email.toLowerCase().trim()
        const password = parsed.data.password
        const { success } = rateLimit(`login:${normalizedEmail}`, {
          maxRequests: 10,
          windowMs: 60_000,
        })
        if (!success) return null

        const user = await prisma.user.findUnique({
          where: { email: normalizedEmail },
        })
        if (!user?.hashedPassword) return null

        const isValid = await bcrypt.compare(password, user.hashedPassword)
        if (!isValid) return null

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          institution: user.institution,
          npi: user.npi,
          fhirPractitionerId: user.fhirPractitionerId,
          onboardingComplete: user.onboardingComplete,
        }
      },
    }),
  ],
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
          },
        })
        if (dbUser) {
          token.institution = dbUser.institution
          token.npi = dbUser.npi
          token.fhirPractitionerId = dbUser.fhirPractitionerId
          token.onboardingComplete = dbUser.onboardingComplete
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
      return session
    },
  },
})
