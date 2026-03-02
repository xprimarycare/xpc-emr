import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
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

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        institution: institution?.trim() || null,
        npi: npi?.trim() || null,
        fhirPractitionerId: fhirPractitionerId?.trim() || null,
        onboardingComplete: true,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Onboarding error:", error)
    return NextResponse.json(
      { error: "Failed to save profile" },
      { status: 500 }
    )
  }
}
