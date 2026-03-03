import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

// GET: List onboarded users for PCP dropdown
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      )
    }

    const users = await prisma.user.findMany({
      where: { onboardingComplete: true },
      select: {
        id: true,
        name: true,
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
