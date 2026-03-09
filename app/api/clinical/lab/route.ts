import { NextRequest, NextResponse } from "next/server"
import { requireAuth, isSession } from "@/lib/auth-helpers"
import { prismaClinical } from "@/lib/prisma-clinical"
import { requirePatientAccess } from "@/lib/clinical-auth"

// GET /api/clinical/lab?patient={id}
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

    const items = await prismaClinical.labOrder.findMany({
      where: { patientId },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ items, total: items.length })
  } catch (error) {
    console.error("Clinical lab order search error:", error)
    return NextResponse.json({ error: "Failed to fetch lab orders" }, { status: 500 })
  }
}

// POST /api/clinical/lab - Create a new lab order
export async function POST(request: NextRequest) {
  const authResult = await requireAuth()
  if (!isSession(authResult)) return authResult

  try {
    const body = await request.json()
    if (body.patientId) {
      const forbidden = await requirePatientAccess(authResult, body.patientId)
      if (forbidden) return forbidden
    }
    const item = await prismaClinical.labOrder.create({ data: body })
    return NextResponse.json({ id: item.id })
  } catch (error) {
    console.error("Clinical lab order create error:", error)
    return NextResponse.json({ error: "Failed to create lab order" }, { status: 500 })
  }
}

// PUT /api/clinical/lab - Update a lab order
export async function PUT(request: NextRequest) {
  const authResult = await requireAuth()
  if (!isSession(authResult)) return authResult

  try {
    const body = await request.json()
    const { id, ...data } = body

    if (!id) {
      return NextResponse.json({ error: "LabOrder ID is required" }, { status: 400 })
    }

    const item = await prismaClinical.labOrder.update({ where: { id }, data })
    return NextResponse.json(item)
  } catch (error) {
    console.error("Clinical lab order update error:", error)
    return NextResponse.json({ error: "Failed to update lab order" }, { status: 500 })
  }
}
