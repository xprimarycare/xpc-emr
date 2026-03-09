import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import type { Session } from "next-auth"

/**
 * Verify the user has access to the given clinical patient.
 * Admins have access to all patients. Regular users must have
 * a UserPatient assignment with a matching patientLocalId.
 *
 * Returns null if access is granted, or a 403 NextResponse.
 */
export async function requirePatientAccess(
  session: Session,
  patientId: string
): Promise<NextResponse | null> {
  if (session.user.role === "admin") return null

  const assignment = await prisma.userPatient.findFirst({
    where: {
      userId: session.user.id,
      patientLocalId: patientId,
    },
  })

  if (!assignment) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  return null
}
