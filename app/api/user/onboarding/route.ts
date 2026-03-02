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
      salt: useSecureCookies()
        ? "__Secure-authjs.session-token"
        : "authjs.session-token",
    })

    const cookieName = useSecureCookies()
      ? "__Secure-authjs.session-token"
      : "authjs.session-token"

    const response = NextResponse.json({ success: true })
    response.cookies.set(cookieName, newToken, {
      httpOnly: true,
      secure: useSecureCookies(),
      sameSite: "lax",
      path: "/",
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
