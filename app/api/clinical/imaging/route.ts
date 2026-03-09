import { NextRequest, NextResponse } from "next/server"
import { requireAuth, isSession } from "@/lib/auth-helpers"
import { prismaClinical } from "@/lib/prisma-clinical"
import { requirePatientAccess } from "@/lib/clinical-auth"

// GET /api/clinical/imaging?patient={id}
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

    const items = await prismaClinical.imagingOrder.findMany({
      where: { patientId },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ items, total: items.length })
  } catch (error) {
    console.error("Clinical imaging order search error:", error)
    return NextResponse.json({ error: "Failed to fetch imaging orders" }, { status: 500 })
  }
}

// POST /api/clinical/imaging - Create a new imaging order
export async function POST(request: NextRequest) {
  const authResult = await requireAuth()
  if (!isSession(authResult)) return authResult

  try {
    const body = await request.json()
    if (body.patientId) {
      const forbidden = await requirePatientAccess(authResult, body.patientId)
      if (forbidden) return forbidden
    }
    const item = await prismaClinical.imagingOrder.create({ data: body })
    return NextResponse.json({ id: item.id })
  } catch (error) {
    console.error("Clinical imaging order create error:", error)
    return NextResponse.json({ error: "Failed to create imaging order" }, { status: 500 })
  }
}

// PUT /api/clinical/imaging - Update an imaging order
export async function PUT(request: NextRequest) {
  const authResult = await requireAuth()
  if (!isSession(authResult)) return authResult

  try {
    const body = await request.json()
    const { id, ...data } = body

    if (!id) {
      return NextResponse.json({ error: "ImagingOrder ID is required" }, { status: 400 })
    }

    const item = await prismaClinical.imagingOrder.update({ where: { id }, data })
    return NextResponse.json(item)
  } catch (error) {
    console.error("Clinical imaging order update error:", error)
    return NextResponse.json({ error: "Failed to update imaging order" }, { status: 500 })
  }
}
