import { NextRequest, NextResponse } from "next/server"
import { requireAuth, isSession } from "@/lib/auth-helpers"
import { prismaClinical } from "@/lib/prisma-clinical"
import { requirePatientAccess } from "@/lib/clinical-auth"

// GET /api/clinical/condition?patient={id}
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

    const items = await prismaClinical.condition.findMany({
      where: { patientId },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ items, total: items.length })
  } catch (error) {
    console.error("Clinical condition search error:", error)
    return NextResponse.json({ error: "Failed to fetch conditions" }, { status: 500 })
  }
}

// POST /api/clinical/condition - Create a new condition
export async function POST(request: NextRequest) {
  const authResult = await requireAuth()
  if (!isSession(authResult)) return authResult

  try {
    const body = await request.json()
    if (body.patientId) {
      const forbidden = await requirePatientAccess(authResult, body.patientId)
      if (forbidden) return forbidden
    }
    const item = await prismaClinical.condition.create({ data: body })
    return NextResponse.json({ id: item.id })
  } catch (error) {
    console.error("Clinical condition create error:", error)
    return NextResponse.json({ error: "Failed to create condition" }, { status: 500 })
  }
}

// PUT /api/clinical/condition - Update a condition
export async function PUT(request: NextRequest) {
  const authResult = await requireAuth()
  if (!isSession(authResult)) return authResult

  try {
    const body = await request.json()
    const { id, ...data } = body

    if (!id) {
      return NextResponse.json({ error: "Condition ID is required" }, { status: 400 })
    }

    const item = await prismaClinical.condition.update({ where: { id }, data })
    return NextResponse.json(item)
  } catch (error) {
    console.error("Clinical condition update error:", error)
    return NextResponse.json({ error: "Failed to update condition" }, { status: 500 })
  }
}

// DELETE /api/clinical/condition?id={id}
export async function DELETE(request: NextRequest) {
  const authResult = await requireAuth()
  if (!isSession(authResult)) return authResult

  try {
    const id = request.nextUrl.searchParams.get("id")
    if (!id) {
      return NextResponse.json({ error: "id parameter is required" }, { status: 400 })
    }

    await prismaClinical.condition.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Clinical condition delete error:", error)
    return NextResponse.json({ error: "Failed to delete condition" }, { status: 500 })
  }
}
