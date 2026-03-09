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

    const rows = await prismaClinical.goal.findMany({
      where: { patientId },
      orderBy: { createdAt: "desc" },
    })

    const items = rows.map((row) => ({
      id: row.id,
      fhirId: row.id,
      name: row.name,
      lifecycleStatus: row.lifecycleStatus,
      expressedBy: row.expressedBy,
      startDate: row.startDate,
      note: row.note,
      ...(row.codingCode
        ? {
            coding: {
              system: row.codingSystem,
              code: row.codingCode,
              display: row.codingDisplay,
            },
          }
        : {}),
    }))

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
    if (!body.patientId) {
      return NextResponse.json({ error: "patientId is required" }, { status: 400 })
    }

    const forbidden = await requirePatientAccess(authResult, body.patientId)
    if (forbidden) return forbidden

    const item = await prismaClinical.goal.create({
      data: {
        patientId: body.patientId,
        name: body.name,
        lifecycleStatus: body.lifecycleStatus || "proposed",
        expressedBy: body.expressedBy || null,
        startDate: body.startDate || null,
        codingSystem: body.coding?.system || null,
        codingCode: body.coding?.code || null,
        codingDisplay: body.coding?.display || null,
        note: body.note || null,
      },
    })
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
    const { id } = body

    if (!id) {
      return NextResponse.json({ error: "Goal ID is required" }, { status: 400 })
    }

    const data: Record<string, unknown> = {}
    if (body.name !== undefined) data.name = body.name
    if (body.lifecycleStatus !== undefined) data.lifecycleStatus = body.lifecycleStatus
    if (body.expressedBy !== undefined) data.expressedBy = body.expressedBy || null
    if (body.startDate !== undefined) data.startDate = body.startDate || null
    if (body.note !== undefined) data.note = body.note || null
    if (body.coding !== undefined) {
      data.codingSystem = body.coding?.system || null
      data.codingCode = body.coding?.code || null
      data.codingDisplay = body.coding?.display || null
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
