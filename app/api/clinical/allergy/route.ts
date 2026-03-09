import { NextRequest, NextResponse } from "next/server"
import { requireAuth, isSession } from "@/lib/auth-helpers"
import { prismaClinical } from "@/lib/prisma-clinical"
import { requirePatientAccess } from "@/lib/clinical-auth"

// GET /api/clinical/allergy?patient={id}
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

    const items = await prismaClinical.allergy.findMany({
      where: { patientId },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ items, total: items.length })
  } catch (error) {
    console.error("Clinical allergy search error:", error)
    return NextResponse.json({ error: "Failed to fetch allergies" }, { status: 500 })
  }
}

// POST /api/clinical/allergy - Create a new allergy
export async function POST(request: NextRequest) {
  const authResult = await requireAuth()
  if (!isSession(authResult)) return authResult

  try {
    const body = await request.json()
    if (body.patientId) {
      const forbidden = await requirePatientAccess(authResult, body.patientId)
      if (forbidden) return forbidden
    }
    const item = await prismaClinical.allergy.create({ data: body })
    return NextResponse.json({ id: item.id })
  } catch (error) {
    console.error("Clinical allergy create error:", error)
    return NextResponse.json({ error: "Failed to create allergy" }, { status: 500 })
  }
}

// PUT /api/clinical/allergy - Update an allergy
export async function PUT(request: NextRequest) {
  const authResult = await requireAuth()
  if (!isSession(authResult)) return authResult

  try {
    const body = await request.json()
    const { id, ...data } = body

    if (!id) {
      return NextResponse.json({ error: "Allergy ID is required" }, { status: 400 })
    }

    const item = await prismaClinical.allergy.update({ where: { id }, data })
    return NextResponse.json(item)
  } catch (error) {
    console.error("Clinical allergy update error:", error)
    return NextResponse.json({ error: "Failed to update allergy" }, { status: 500 })
  }
}

// DELETE /api/clinical/allergy?id={id}
export async function DELETE(request: NextRequest) {
  const authResult = await requireAuth()
  if (!isSession(authResult)) return authResult

  try {
    const id = request.nextUrl.searchParams.get("id")
    if (!id) {
      return NextResponse.json({ error: "id parameter is required" }, { status: 400 })
    }

    await prismaClinical.allergy.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Clinical allergy delete error:", error)
    return NextResponse.json({ error: "Failed to delete allergy" }, { status: 500 })
  }
}
