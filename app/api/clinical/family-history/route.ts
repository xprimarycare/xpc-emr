import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAuth, isSession } from "@/lib/auth-helpers"
import { prismaClinical } from "@/lib/prisma-clinical"
import { requirePatientAccess } from "@/lib/clinical-auth"
import { logger } from "@/lib/logger"

const conditionSchema = z.object({
  name: z.string().optional(),
  outcome: z.string().optional(),
  onsetAge: z.string().optional(),
  contributedToDeath: z.string().optional(),
  codingSystem: z.string().optional(),
  codingCode: z.string().optional(),
  codingDisplay: z.string().optional(),
  note: z.string().optional(),
})

const familyHistorySchema = z.object({
  patientId: z.string().min(1),
  name: z.string().optional(),
  relationship: z.string().optional(),
  relationshipDisplay: z.string().optional(),
  status: z.string().optional(),
  deceased: z.string().optional(),
  deceasedAge: z.string().optional(),
  note: z.string().optional(),
  conditions: z.array(conditionSchema).optional(),
})

const familyHistoryUpdateSchema = familyHistorySchema
  .omit({ patientId: true })
  .partial()
  .extend({ id: z.string().min(1), conditions: z.array(conditionSchema).optional() })

// GET /api/clinical/family-history?patient={id}
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

    const items = await prismaClinical.familyHistory.findMany({
      where: { patientId },
      include: { conditions: true },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ items, total: items.length })
  } catch (error) {
    logger.error("Clinical family history search error", error)
    return NextResponse.json({ error: "Failed to fetch family history" }, { status: 500 })
  }
}

// POST /api/clinical/family-history - Create a new family history entry
export async function POST(request: NextRequest) {
  const authResult = await requireAuth()
  if (!isSession(authResult)) return authResult

  try {
    const body = await request.json()
    const parsed = familyHistorySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      )
    }

    const forbidden = await requirePatientAccess(authResult, parsed.data.patientId)
    if (forbidden) return forbidden

    const { conditions, ...data } = parsed.data

    const item = await prismaClinical.familyHistory.create({
      data: {
        ...data,
        conditions: conditions?.length
          ? { create: conditions }
          : undefined,
      } as Parameters<typeof prismaClinical.familyHistory.create>[0]["data"],
      include: { conditions: true },
    })

    return NextResponse.json({ id: item.id })
  } catch (error) {
    logger.error("Clinical family history create error", error)
    return NextResponse.json({ error: "Failed to create family history" }, { status: 500 })
  }
}

// PUT /api/clinical/family-history - Update a family history entry
export async function PUT(request: NextRequest) {
  const authResult = await requireAuth()
  if (!isSession(authResult)) return authResult

  try {
    const body = await request.json()
    const parsed = familyHistoryUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      )
    }

    const { id, conditions, ...data } = parsed.data

    const existing = await prismaClinical.familyHistory.findUnique({ where: { id }, select: { patientId: true } })
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const forbidden = await requirePatientAccess(authResult, existing.patientId)
    if (forbidden) return forbidden

    // Delete existing conditions and recreate atomically
    const item = await prismaClinical.$transaction(async (tx) => {
      await tx.familyHistoryCondition.deleteMany({
        where: { familyHistoryId: id },
      })

      return tx.familyHistory.update({
        where: { id },
        data: {
          ...data,
          conditions: conditions?.length
            ? { create: conditions }
            : undefined,
        } as Parameters<typeof prismaClinical.familyHistory.update>[0]["data"],
        include: { conditions: true },
      })
    })

    return NextResponse.json(item)
  } catch (error) {
    logger.error("Clinical family history update error", error)
    return NextResponse.json({ error: "Failed to update family history" }, { status: 500 })
  }
}

// DELETE /api/clinical/family-history?id={id}
export async function DELETE(request: NextRequest) {
  const authResult = await requireAuth()
  if (!isSession(authResult)) return authResult

  try {
    const id = request.nextUrl.searchParams.get("id")
    if (!id) {
      return NextResponse.json({ error: "id parameter is required" }, { status: 400 })
    }

    const existing = await prismaClinical.familyHistory.findUnique({ where: { id }, select: { patientId: true } })
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const forbidden = await requirePatientAccess(authResult, existing.patientId)
    if (forbidden) return forbidden

    // Conditions cascade-deleted via onDelete: Cascade
    await prismaClinical.familyHistory.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error("Clinical family history delete error", error)
    return NextResponse.json({ error: "Failed to delete family history" }, { status: 500 })
  }
}
