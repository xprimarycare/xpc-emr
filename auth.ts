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
      role: string
      originalAdminId?: string
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
          role: user.role,
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id
        token.institution = user.institution
        token.npi = user.npi
        token.fhirPractitionerId = user.fhirPractitionerId
        token.onboardingComplete = user.onboardingComplete
        token.role = user.role
        // OAuth providers don't pass custom fields — fetch from DB if missing
        if (!token.role && token.id) {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { role: true, institution: true, npi: true, fhirPractitionerId: true, onboardingComplete: true },
          })
          if (dbUser) {
            token.role = dbUser.role
            token.institution = dbUser.institution
            token.npi = dbUser.npi
            token.fhirPractitionerId = dbUser.fhirPractitionerId
            token.onboardingComplete = dbUser.onboardingComplete
          }
        }
      } else if (trigger === "update" && token.id) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data = session as any

        if (data?.impersonating && token.role === "admin") {
          // Start impersonation: load the target user's data
          try {
            const targetUser = await prisma.user.findUnique({
              where: { id: data.impersonating as string },
              select: { id: true, name: true, email: true, image: true, institution: true, npi: true, fhirPractitionerId: true, onboardingComplete: true, role: true },
            })
            if (targetUser) {
              token.originalAdminId = token.id // preserve real admin id
              token.id = targetUser.id
              token.name = targetUser.name
              token.email = targetUser.email
              token.picture = targetUser.image
              token.institution = targetUser.institution
              token.npi = targetUser.npi
              token.fhirPractitionerId = targetUser.fhirPractitionerId
              token.onboardingComplete = targetUser.onboardingComplete
              token.role = targetUser.role
              return token
            }
          } catch {
            // Keep existing token values on error
          }
        } else if (data?.stopImpersonating && token.originalAdminId) {
          // Stop impersonation: restore the original admin's data
          try {
            const adminUser = await prisma.user.findUnique({
              where: { id: token.originalAdminId as string },
              select: { id: true, name: true, email: true, image: true, institution: true, npi: true, fhirPractitionerId: true, onboardingComplete: true, role: true },
            })
            if (adminUser) {
              token.id = adminUser.id
              token.name = adminUser.name
              token.email = adminUser.email
              token.picture = adminUser.image
              token.institution = adminUser.institution
              token.npi = adminUser.npi
              token.fhirPractitionerId = adminUser.fhirPractitionerId
              token.onboardingComplete = adminUser.onboardingComplete
              token.role = adminUser.role
              delete token.originalAdminId
              return token
            }
          } catch {
            // Keep existing token values on error
          }
        } else {
          // Explicit session refresh (e.g. after onboarding) — fetch fresh data.
          try {
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
          } catch {
            // DB unavailable — keep existing token values
          }
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
      if (token.originalAdminId) {
        session.user.originalAdminId = token.originalAdminId as string
      }
      return session
    },
  },
})
