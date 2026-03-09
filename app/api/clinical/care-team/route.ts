import { NextRequest, NextResponse } from "next/server"
import { requireAuth, isSession } from "@/lib/auth-helpers"
import { prismaClinical } from "@/lib/prisma-clinical"
import { requirePatientAccess } from "@/lib/clinical-auth"

// GET /api/clinical/care-team?patient={id}
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

    const items = await prismaClinical.careTeamMember.findMany({
      where: { patientId },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ items, total: items.length })
  } catch (error) {
    console.error("Clinical care team search error:", error)
    return NextResponse.json({ error: "Failed to fetch care team" }, { status: 500 })
  }
}

// POST /api/clinical/care-team - Create a new care team member
export async function POST(request: NextRequest) {
  const authResult = await requireAuth()
  if (!isSession(authResult)) return authResult

  try {
    const body = await request.json()
    if (body.patientId) {
      const forbidden = await requirePatientAccess(authResult, body.patientId)
      if (forbidden) return forbidden
    }
    const item = await prismaClinical.careTeamMember.create({ data: body })
    return NextResponse.json({ id: item.id })
  } catch (error) {
    console.error("Clinical care team create error:", error)
    return NextResponse.json({ error: "Failed to create care team member" }, { status: 500 })
  }
}

// PUT /api/clinical/care-team - Update a care team member
export async function PUT(request: NextRequest) {
  const authResult = await requireAuth()
  if (!isSession(authResult)) return authResult

  try {
    const body = await request.json()
    const { id, ...data } = body

    if (!id) {
      return NextResponse.json({ error: "CareTeamMember ID is required" }, { status: 400 })
    }

    const item = await prismaClinical.careTeamMember.update({ where: { id }, data })
    return NextResponse.json(item)
  } catch (error) {
    console.error("Clinical care team update error:", error)
    return NextResponse.json({ error: "Failed to update care team member" }, { status: 500 })
  }
}

// DELETE /api/clinical/care-team?id={id}
export async function DELETE(request: NextRequest) {
  const authResult = await requireAuth()
  if (!isSession(authResult)) return authResult

  try {
    const id = request.nextUrl.searchParams.get("id")
    if (!id) {
      return NextResponse.json({ error: "id parameter is required" }, { status: 400 })
    }

    await prismaClinical.careTeamMember.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Clinical care team delete error:", error)
    return NextResponse.json({ error: "Failed to delete care team member" }, { status: 500 })
  }
}
