import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { encode } from "next-auth/jwt"
import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      )
    }

    const { institution, npi, fhirPractitionerId } = await request.json()

    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        institution: institution?.trim() || null,
        npi: npi?.trim() || null,
        fhirPractitionerId: fhirPractitionerId?.trim() || null,
        onboardingComplete: true,
      },
    })

    // Build a fresh JWT with the updated user data
    const maxAge = 30 * 24 * 60 * 60 // 30 days — match Auth.js default
    const cookieName = useSecureCookies()
      ? "__Secure-authjs.session-token"
      : "authjs.session-token"

    const newToken = await encode({
      token: {
        name: session.user.name,
        email: session.user.email,
        picture: session.user.image,
        sub: session.user.id,
        id: session.user.id,
        institution: updatedUser.institution,
        npi: updatedUser.npi,
        fhirPractitionerId: updatedUser.fhirPractitionerId,
        onboardingComplete: true,
      },
      secret: process.env.AUTH_SECRET!,
      salt: cookieName,
      maxAge,
    })

    const response = NextResponse.json({ success: true })
    response.cookies.set(cookieName, newToken, {
      httpOnly: true,
      secure: useSecureCookies(),
      sameSite: "lax",
      path: "/",
      maxAge,
    })

    return response
  } catch (error) {
    console.error("Onboarding error:", error)
    return NextResponse.json(
      { error: "Failed to save profile" },
      { status: 500 }
    )
  }
}

function useSecureCookies() {
  return process.env.NODE_ENV === "production"
}
