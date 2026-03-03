import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"

// GET: List current user's assigned patient FHIR IDs
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      )
    }

    const assignments = await prisma.userPatient.findMany({
      where: { userId: session.user.id },
      select: { patientFhirId: true, assignedAt: true },
      orderBy: { assignedAt: "desc" },
    })

    return NextResponse.json({
      patientFhirIds: assignments.map((a) => a.patientFhirId),
      assignments,
    })
  } catch (error) {
    console.error("Failed to list patient assignments:", error)
    return NextResponse.json(
      { error: "Failed to list patient assignments" },
      { status: 500 }
    )
  }
}

// POST: Assign a patient to the current user
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      )
    }

    const { patientFhirId, userId } = await request.json()

    if (!patientFhirId?.trim()) {
      return NextResponse.json(
        { error: "patientFhirId is required" },
        { status: 400 }
      )
    }

    // Allow assigning to another user (e.g. when selecting a PCP)
    const targetUserId = userId?.trim() || session.user.id

    // Validate target user exists and is onboarded
    if (targetUserId !== session.user.id) {
      const targetUser = await prisma.user.findUnique({
        where: { id: targetUserId },
        select: { id: true, onboardingComplete: true },
      })
      if (!targetUser || !targetUser.onboardingComplete) {
        return NextResponse.json(
          { error: "Target user not found" },
          { status: 404 }
        )
      }
    }

    const assignment = await prisma.userPatient.upsert({
      where: {
        userId_patientFhirId: {
          userId: targetUserId,
          patientFhirId: patientFhirId.trim(),
        },
      },
      update: {},
      create: {
        userId: targetUserId,
        patientFhirId: patientFhirId.trim(),
      },
    })

    return NextResponse.json({ success: true, assignment })
  } catch (error) {
    console.error("Failed to assign patient:", error)
    return NextResponse.json(
      { error: "Failed to assign patient" },
      { status: 500 }
    )
  }
}

// DELETE: Unassign a patient from the current user
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      )
    }

    const { patientFhirId } = await request.json()

    if (!patientFhirId?.trim()) {
      return NextResponse.json(
        { error: "patientFhirId is required" },
        { status: 400 }
      )
    }

    await prisma.userPatient.deleteMany({
      where: {
        userId: session.user.id,
        patientFhirId: patientFhirId.trim(),
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to unassign patient:", error)
    return NextResponse.json(
      { error: "Failed to unassign patient" },
      { status: 500 }
    )
  }
}
