import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"
import { CaseStatus, VALID_STATUS_TRANSITIONS } from "@/lib/constants/case-status"
import { isLocalBackend } from "@/lib/emr-backend"
import { getPatientIdField } from "@/lib/patient-id"

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
      select: {
        patientFhirId: true,
        patientLocalId: true,
        assignedAt: true,
        status: true,
        assignedBy: true,
        encounterFhirId: true,
        sourceEncounterFhirId: true,
        sourcePatientFhirId: true,
        includeNoteText: true,
      },
      orderBy: { assignedAt: "desc" },
    })

    const idField = getPatientIdField()
    return NextResponse.json({
      patientFhirIds: assignments.map((a) => a[idField] ?? a.patientFhirId),
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

    // Only admins may assign to another user
    const targetUserId = userId?.trim() || session.user.id
    if (targetUserId !== session.user.id && session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

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

    const pid = patientFhirId.trim()
    const assignment = isLocalBackend()
      ? await prisma.userPatient.upsert({
          where: {
            userId_patientLocalId: { userId: targetUserId, patientLocalId: pid },
          },
          update: {},
          create: { userId: targetUserId, patientFhirId: pid, patientLocalId: pid },
        })
      : await prisma.userPatient.upsert({
          where: {
            userId_patientFhirId: { userId: targetUserId, patientFhirId: pid },
          },
          update: {},
          create: { userId: targetUserId, patientFhirId: pid },
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

// PATCH: Update assignment status (self-only, atomic transition)
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      )
    }

    const { patientFhirId, status } = await request.json()

    if (!patientFhirId?.trim()) {
      return NextResponse.json(
        { error: "patientFhirId is required" },
        { status: 400 }
      )
    }

    // Validate and determine which current status can transition to the requested status
    if (!Object.values(CaseStatus).includes(status)) {
      return NextResponse.json(
        { error: `Invalid target status: ${status}` },
        { status: 400 }
      )
    }

    const requiredCurrentStatus = Object.entries(VALID_STATUS_TRANSITIONS).find(
      ([, allowed]) => allowed.includes(status)
    )?.[0]

    if (!requiredCurrentStatus) {
      return NextResponse.json(
        { error: `No valid transition to status: ${status}` },
        { status: 400 }
      )
    }

    // Atomic conditional update — avoids TOCTOU race
    const idField = getPatientIdField()
    const result = await prisma.userPatient.updateMany({
      where: {
        userId: session.user.id,
        [idField]: patientFhirId.trim(),
        status: requiredCurrentStatus,
      },
      data: { status },
    })

    if (result.count === 0) {
      return NextResponse.json(
        { error: "Assignment not found or transition not allowed" },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to update assignment status:", error)
    return NextResponse.json(
      { error: "Failed to update assignment status" },
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

    const idField = getPatientIdField()
    await prisma.userPatient.deleteMany({
      where: {
        userId: session.user.id,
        [idField]: patientFhirId.trim(),
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
