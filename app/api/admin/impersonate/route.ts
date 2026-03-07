import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    const { userId } = await request.json()

    // --- START impersonation ---
    if (userId) {
      // Must be a real admin (not currently impersonating)
      if (session.user.role !== "admin" || session.user.originalAdminId) {
        return NextResponse.json({ error: "Admin access required" }, { status: 403 })
      }

      if (userId === session.user.id) {
        return NextResponse.json({ error: "Cannot impersonate yourself" }, { status: 400 })
      }

      const targetUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true },
      })

      if (!targetUser) {
        return NextResponse.json({ error: "User not found" }, { status: 404 })
      }

      await prisma.impersonationLog.create({
        data: { adminId: session.user.id, targetUserId: userId },
      })

      return NextResponse.json({ success: true, targetUserName: targetUser.name })
    }

    // --- STOP impersonation ---
    const originalAdminId = session.user.originalAdminId
    if (!originalAdminId) {
      return NextResponse.json({ error: "Not currently impersonating" }, { status: 400 })
    }

    const openLog = await prisma.impersonationLog.findFirst({
      where: { adminId: originalAdminId, targetUserId: session.user.id, endedAt: null },
      orderBy: { startedAt: "desc" },
    })

    if (openLog) {
      await prisma.impersonationLog.update({
        where: { id: openLog.id },
        data: { endedAt: new Date() },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Impersonation error:", error)
    return NextResponse.json({ error: "Impersonation failed" }, { status: 500 })
  }
}
