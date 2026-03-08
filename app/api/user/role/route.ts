import { requireAuth, isSession } from "@/lib/auth-helpers"
import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"
import { UserRole } from "@/lib/constants/case-status"

export async function PATCH(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if (!isSession(authResult)) return authResult

    if (authResult.user.role !== UserRole.ADMIN) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      )
    }

    const { userId, role } = await request.json()

    if (!userId || !role) {
      return NextResponse.json(
        { error: "userId and role are required" },
        { status: 400 }
      )
    }

    if (role !== UserRole.USER && role !== UserRole.ADMIN) {
      return NextResponse.json(
        { error: "Role must be 'user' or 'admin'" },
        { status: 400 }
      )
    }

    if (userId === authResult.user.id) {
      return NextResponse.json(
        { error: "Cannot change your own role" },
        { status: 400 }
      )
    }

    await prisma.user.update({
      where: { id: userId },
      data: { role },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((error as any)?.code === "P2025") {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }
    console.error("Role update error:", error)
    return NextResponse.json(
      { error: "Failed to update role" },
      { status: 500 }
    )
  }
}
