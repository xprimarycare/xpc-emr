import { NextRequest, NextResponse } from "next/server"
import { requireAuth, isSession } from "@/lib/auth-helpers"
import { prismaClinical } from "@/lib/prisma-clinical"
import { requirePatientAccess } from "@/lib/clinical-auth"

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
    console.error("Clinical family history search error:", error)
    return NextResponse.json({ error: "Failed to fetch family history" }, { status: 500 })
  }
}

// POST /api/clinical/family-history - Create a new family history entry
export async function POST(request: NextRequest) {
  const authResult = await requireAuth()
  if (!isSession(authResult)) return authResult

  try {
    const { conditions, ...data } = await request.json()
    if (data.patientId) {
      const forbidden = await requirePatientAccess(authResult, data.patientId)
      if (forbidden) return forbidden
    }

    const item = await prismaClinical.familyHistory.create({
      data: {
        ...data,
        conditions: conditions?.length
          ? { create: conditions }
          : undefined,
      },
      include: { conditions: true },
    })

    return NextResponse.json({ id: item.id })
  } catch (error) {
    console.error("Clinical family history create error:", error)
    return NextResponse.json({ error: "Failed to create family history" }, { status: 500 })
  }
}

// PUT /api/clinical/family-history - Update a family history entry
export async function PUT(request: NextRequest) {
  const authResult = await requireAuth()
  if (!isSession(authResult)) return authResult

  try {
    const { id, conditions, ...data } = await request.json()

    if (!id) {
      return NextResponse.json({ error: "FamilyHistory ID is required" }, { status: 400 })
    }

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
        },
        include: { conditions: true },
      })
    })

    return NextResponse.json(item)
  } catch (error) {
    console.error("Clinical family history update error:", error)
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

    // Conditions cascade-deleted via onDelete: Cascade
    await prismaClinical.familyHistory.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Clinical family history delete error:", error)
    return NextResponse.json({ error: "Failed to delete family history" }, { status: 500 })
  }
}
