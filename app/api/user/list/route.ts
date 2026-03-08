import { requireAuth, isSession } from "@/lib/auth-helpers"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { UserRole } from "@/lib/constants/case-status"

// GET: List onboarded users for PCP dropdown
export async function GET() {
  try {
    const authResult = await requireAuth()
    if (!isSession(authResult)) return authResult

    const isAdmin = authResult.user.role === UserRole.ADMIN

    const users = await prisma.user.findMany({
      where: { onboardingComplete: true },
      select: {
        id: true,
        name: true,
        ...(isAdmin && { email: true, role: true, institution: true }),
      },
      orderBy: { name: "asc" },
    })

    return NextResponse.json({ users })
  } catch (error) {
    console.error("Failed to list users:", error)
    return NextResponse.json(
      { error: "Failed to list users" },
      { status: 500 }
    )
  }
}
