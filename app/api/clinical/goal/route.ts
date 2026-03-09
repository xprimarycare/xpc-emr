import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAuth, isSession } from "@/lib/auth-helpers"
import { prismaClinical } from "@/lib/prisma-clinical"
import { requirePatientAccess } from "@/lib/clinical-auth"
import { logger } from "@/lib/logger"

const codingSchema = z.object({
  system: z.string().optional(),
  code: z.string().optional(),
  display: z.string().optional(),
}).optional()

const goalSchema = z.object({
  patientId: z.string().min(1),
  name: z.string().min(1),
  lifecycleStatus: z.string().optional(),
  expressedBy: z.string().optional(),
  startDate: z.string().optional(),
  coding: codingSchema,
  note: z.string().optional(),
})

const goalUpdateSchema = goalSchema.omit({ patientId: true }).partial().extend({
  id: z.string().min(1),
  coding: codingSchema,
})

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
    logger.error("Clinical goal search error", error)
    return NextResponse.json({ error: "Failed to fetch goals" }, { status: 500 })
  }
}

// POST /api/clinical/goal - Create a new goal
export async function POST(request: NextRequest) {
  const authResult = await requireAuth()
  if (!isSession(authResult)) return authResult

  try {
    const body = await request.json()
    const parsed = goalSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      )
    }

    const forbidden = await requirePatientAccess(authResult, parsed.data.patientId)
    if (forbidden) return forbidden

    const item = await prismaClinical.goal.create({
      data: {
        patientId: parsed.data.patientId,
        name: parsed.data.name,
        lifecycleStatus: parsed.data.lifecycleStatus || "proposed",
        expressedBy: parsed.data.expressedBy || null,
        startDate: parsed.data.startDate || null,
        codingSystem: parsed.data.coding?.system || null,
        codingCode: parsed.data.coding?.code || null,
        codingDisplay: parsed.data.coding?.display || null,
        note: parsed.data.note || null,
      },
    })
    return NextResponse.json({ id: item.id })
  } catch (error) {
    logger.error("Clinical goal create error", error)
    return NextResponse.json({ error: "Failed to create goal" }, { status: 500 })
  }
}

// PUT /api/clinical/goal - Update a goal
export async function PUT(request: NextRequest) {
  const authResult = await requireAuth()
  if (!isSession(authResult)) return authResult

  try {
    const body = await request.json()
    const parsed = goalUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      )
    }

    const { id, coding, ...fields } = parsed.data

    const existing = await prismaClinical.goal.findUnique({ where: { id }, select: { patientId: true } })
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const forbidden = await requirePatientAccess(authResult, existing.patientId)
    if (forbidden) return forbidden

    const data: Record<string, unknown> = {}
    if (fields.name !== undefined) data.name = fields.name
    if (fields.lifecycleStatus !== undefined) data.lifecycleStatus = fields.lifecycleStatus
    if (fields.expressedBy !== undefined) data.expressedBy = fields.expressedBy || null
    if (fields.startDate !== undefined) data.startDate = fields.startDate || null
    if (fields.note !== undefined) data.note = fields.note || null
    if (coding !== undefined) {
      data.codingSystem = coding?.system || null
      data.codingCode = coding?.code || null
      data.codingDisplay = coding?.display || null
    }

    const item = await prismaClinical.goal.update({ where: { id }, data })
    return NextResponse.json(item)
  } catch (error) {
    logger.error("Clinical goal update error", error)
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

    const existing = await prismaClinical.goal.findUnique({ where: { id }, select: { patientId: true } })
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const forbidden = await requirePatientAccess(authResult, existing.patientId)
    if (forbidden) return forbidden

    await prismaClinical.goal.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error("Clinical goal delete error", error)
    return NextResponse.json({ error: "Failed to delete goal" }, { status: 500 })
  }
}
