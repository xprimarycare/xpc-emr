import { NextRequest, NextResponse } from "next/server"
import { requireAuth, isSession } from "@/lib/auth-helpers"
import { prismaClinical } from "@/lib/prisma-clinical"
import { requirePatientAccess } from "@/lib/clinical-auth"

// GET /api/clinical/appointment?patient={id} or ?start=ge{date}&end=le{date}
export async function GET(request: NextRequest) {
  const authResult = await requireAuth()
  if (!isSession(authResult)) return authResult

  try {
    const searchParams = request.nextUrl.searchParams
    const patientId = searchParams.get("patient")
    const startGte = searchParams.get("startGte")
    const startLte = searchParams.get("startLte")

    if (patientId) {
      const forbidden = await requirePatientAccess(authResult, patientId)
      if (forbidden) return forbidden
    }

    const where: Record<string, unknown> = {}
    if (patientId) where.patientId = patientId
    if (startGte || startLte) {
      where.start = {
        ...(startGte ? { gte: startGte } : {}),
        ...(startLte ? { lte: startLte } : {}),
      }
    }

    const items = await prismaClinical.appointment.findMany({
      where,
      orderBy: { start: "asc" },
      take: 100,
    })

    return NextResponse.json({ items, total: items.length })
  } catch (error) {
    console.error("Clinical appointment search error:", error)
    return NextResponse.json({ error: "Failed to fetch appointments" }, { status: 500 })
  }
}

// POST /api/clinical/appointment - Create a new appointment
export async function POST(request: NextRequest) {
  const authResult = await requireAuth()
  if (!isSession(authResult)) return authResult

  try {
    const body = await request.json()
    if (body.patientId) {
      const forbidden = await requirePatientAccess(authResult, body.patientId)
      if (forbidden) return forbidden
    }
    const item = await prismaClinical.appointment.create({ data: body })
    return NextResponse.json({ id: item.id })
  } catch (error) {
    console.error("Clinical appointment create error:", error)
    return NextResponse.json({ error: "Failed to create appointment" }, { status: 500 })
  }
}

// PUT /api/clinical/appointment - Update an appointment
export async function PUT(request: NextRequest) {
  const authResult = await requireAuth()
  if (!isSession(authResult)) return authResult

  try {
    const body = await request.json()
    const { id, ...data } = body

    if (!id) {
      return NextResponse.json({ error: "Appointment ID is required" }, { status: 400 })
    }

    const item = await prismaClinical.appointment.update({ where: { id }, data })
    return NextResponse.json(item)
  } catch (error) {
    console.error("Clinical appointment update error:", error)
    return NextResponse.json({ error: "Failed to update appointment" }, { status: 500 })
  }
}

// DELETE /api/clinical/appointment?id={id}
export async function DELETE(request: NextRequest) {
  const authResult = await requireAuth()
  if (!isSession(authResult)) return authResult

  try {
    const id = request.nextUrl.searchParams.get("id")
    if (!id) {
      return NextResponse.json({ error: "id parameter is required" }, { status: 400 })
    }

    await prismaClinical.appointment.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Clinical appointment delete error:", error)
    return NextResponse.json({ error: "Failed to delete appointment" }, { status: 500 })
  }
}
