import { NextRequest, NextResponse } from "next/server"
import { requireAuth, isSession } from "@/lib/auth-helpers"
import { prismaClinical } from "@/lib/prisma-clinical"
import { requirePatientAccess } from "@/lib/clinical-auth"
import { pick } from "@/lib/pick"
import { logger } from "@/lib/logger"

const APPOINTMENT_FIELDS = [
  "patientId", "status", "description", "start", "end",
  "appointmentType", "patientName",
] as const

// GET /api/clinical/appointment?patient={id} or ?startGte={date}&startLte={date}
export async function GET(request: NextRequest) {
  const authResult = await requireAuth()
  if (!isSession(authResult)) return authResult

  try {
    const searchParams = request.nextUrl.searchParams
    const patientId = searchParams.get("patient")
    const startGte = searchParams.get("startGte")
    const startLte = searchParams.get("startLte")

    if (!patientId && !startGte && !startLte) {
      return NextResponse.json({ error: "patient or date range parameter is required" }, { status: 400 })
    }

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
    logger.error("Clinical appointment search error", error)
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

    const data = pick(body, APPOINTMENT_FIELDS)
    const item = await prismaClinical.appointment.create({ data: data as Parameters<typeof prismaClinical.appointment.create>[0]["data"] })
    return NextResponse.json({ id: item.id })
  } catch (error) {
    logger.error("Clinical appointment create error", error)
    return NextResponse.json({ error: "Failed to create appointment" }, { status: 500 })
  }
}

// PUT /api/clinical/appointment - Update an appointment
export async function PUT(request: NextRequest) {
  const authResult = await requireAuth()
  if (!isSession(authResult)) return authResult

  try {
    const body = await request.json()
    const { id } = body

    if (!id) {
      return NextResponse.json({ error: "Appointment ID is required" }, { status: 400 })
    }

    const existing = await prismaClinical.appointment.findUnique({ where: { id }, select: { patientId: true } })
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    if (existing.patientId) {
      const forbidden = await requirePatientAccess(authResult, existing.patientId)
      if (forbidden) return forbidden
    }

    const data = pick(body, APPOINTMENT_FIELDS.filter((f) => f !== "patientId"))
    const item = await prismaClinical.appointment.update({ where: { id }, data })
    return NextResponse.json(item)
  } catch (error) {
    logger.error("Clinical appointment update error", error)
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

    const existing = await prismaClinical.appointment.findUnique({ where: { id }, select: { patientId: true } })
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    if (existing.patientId) {
      const forbidden = await requirePatientAccess(authResult, existing.patientId)
      if (forbidden) return forbidden
    }

    await prismaClinical.appointment.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error("Clinical appointment delete error", error)
    return NextResponse.json({ error: "Failed to delete appointment" }, { status: 500 })
  }
}
