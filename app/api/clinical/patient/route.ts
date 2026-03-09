import { NextRequest, NextResponse } from "next/server"
import { requireAuth, isSession } from "@/lib/auth-helpers"
import { prismaClinical } from "@/lib/prisma-clinical"
import { prisma } from "@/lib/prisma"
import { getPatientIdField } from "@/lib/patient-id"

// GET /api/clinical/patient - List patients or get by id
export async function GET(request: NextRequest) {
  const authResult = await requireAuth()
  if (!isSession(authResult)) return authResult

  try {
    const searchParams = request.nextUrl.searchParams
    const id = searchParams.get("id")
    const name = searchParams.get("name")

    if (id) {
      const patient = await prismaClinical.patient.findUnique({ where: { id } })
      if (!patient) {
        return NextResponse.json({ error: "Patient not found" }, { status: 404 })
      }
      return NextResponse.json(patient)
    }

    const patients = await prismaClinical.patient.findMany({
      where: name
        ? { name: { contains: name, mode: "insensitive" } }
        : undefined,
      orderBy: { createdAt: "desc" },
      take: 200,
    })

    return NextResponse.json({ items: patients, total: patients.length })
  } catch (error) {
    console.error("Clinical patient search error:", error)
    return NextResponse.json({ error: "Failed to fetch patients" }, { status: 500 })
  }
}

// POST /api/clinical/patient - Create a new patient
export async function POST(request: NextRequest) {
  const authResult = await requireAuth()
  if (!isSession(authResult)) return authResult

  try {
    const { name, dob, sex, mrn, avatar } = await request.json()

    if (!name) {
      return NextResponse.json({ error: "Patient name is required" }, { status: 400 })
    }

    const patient = await prismaClinical.patient.create({
      data: { name, dob: dob || "", sex: sex || "", mrn: mrn || "", avatar },
    })

    return NextResponse.json({ id: patient.id })
  } catch (error) {
    console.error("Clinical patient create error:", error)
    return NextResponse.json({ error: "Failed to create patient" }, { status: 500 })
  }
}

// PUT /api/clinical/patient - Update a patient
export async function PUT(request: NextRequest) {
  const authResult = await requireAuth()
  if (!isSession(authResult)) return authResult

  try {
    const body = await request.json()
    const { id, ...data } = body

    if (!id) {
      return NextResponse.json({ error: "Patient ID is required" }, { status: 400 })
    }

    const patient = await prismaClinical.patient.update({ where: { id }, data })

    return NextResponse.json(patient)
  } catch (error) {
    console.error("Clinical patient update error:", error)
    return NextResponse.json({ error: "Failed to update patient" }, { status: 500 })
  }
}

// DELETE /api/clinical/patient?id=<id>
export async function DELETE(request: NextRequest) {
  const authResult = await requireAuth()
  if (!isSession(authResult)) return authResult

  if (authResult.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const id = request.nextUrl.searchParams.get("id")
  if (!id?.trim()) {
    return NextResponse.json({ error: "id is required" }, { status: 400 })
  }

  try {
    // Cascade delete in clinical DB handled by Prisma onDelete: Cascade
    await prismaClinical.patient.delete({ where: { id } })
    // Clean up auth DB references using the correct patient ID column
    const idField = getPatientIdField()
    await prisma.userPatient.deleteMany({ where: { [idField]: id } })
    await prisma.patientTag.deleteMany({ where: { [idField]: id } })

    return NextResponse.json({ deleted: id })
  } catch (error) {
    console.error("Clinical patient delete error:", error)
    return NextResponse.json({ error: "Failed to delete patient" }, { status: 500 })
  }
}
