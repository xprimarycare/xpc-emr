import { NextRequest, NextResponse } from "next/server"
import { requireAuth, isSession } from "@/lib/auth-helpers"
import { prismaClinical } from "@/lib/prisma-clinical"
import { requirePatientAccess } from "@/lib/clinical-auth"

// GET /api/clinical/goal?patient={id}
export async function GET(request: NextRequest) {
  const authResult = await requireAuth()
  if (!isSession(authResult)) return authResult

  try {
    const patientId = request.nextUrl.searchParams.get("patient")
    if (!patientId) {
      return NextResponse.json({ error: "patient parameter is required" }, { status: 400 })
    }

    const forbidden = await requirePatientAccess(authResult, patientId)
    if (forbidden) return forbidden

    const items = await prismaClinical.goal.findMany({
      where: { patientId },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ items, total: items.length })
  } catch (error) {
    console.error("Clinical goal search error:", error)
    return NextResponse.json({ error: "Failed to fetch goals" }, { status: 500 })
  }
}

// POST /api/clinical/goal - Create a new goal
export async function POST(request: NextRequest) {
  const authResult = await requireAuth()
  if (!isSession(authResult)) return authResult

  try {
    const body = await request.json()
    if (body.patientId) {
      const forbidden = await requirePatientAccess(authResult, body.patientId)
      if (forbidden) return forbidden
    }
    const item = await prismaClinical.goal.create({ data: body })
    return NextResponse.json({ id: item.id })
  } catch (error) {
    console.error("Clinical goal create error:", error)
    return NextResponse.json({ error: "Failed to create goal" }, { status: 500 })
  }
}

// PUT /api/clinical/goal - Update a goal
export async function PUT(request: NextRequest) {
  const authResult = await requireAuth()
  if (!isSession(authResult)) return authResult

  try {
    const body = await request.json()
    const { id, ...data } = body

    if (!id) {
      return NextResponse.json({ error: "Goal ID is required" }, { status: 400 })
    }

    const item = await prismaClinical.goal.update({ where: { id }, data })
    return NextResponse.json(item)
  } catch (error) {
    console.error("Clinical goal update error:", error)
    return NextResponse.json({ error: "Failed to update goal" }, { status: 500 })
  }
}

// DELETE /api/clinical/goal?id={id}
export async function DELETE(request: NextRequest) {
  const authResult = await requireAuth()
  if (!isSession(authResult)) return authResult

  try {
    const id = request.nextUrl.searchParams.get("id")
    if (!id) {
      return NextResponse.json({ error: "id parameter is required" }, { status: 400 })
    }

    await prismaClinical.goal.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Clinical goal delete error:", error)
    return NextResponse.json({ error: "Failed to delete goal" }, { status: 500 })
  }
}
