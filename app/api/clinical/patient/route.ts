import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAuth, isSession } from "@/lib/auth-helpers"
import { prismaClinical } from "@/lib/prisma-clinical"
import { prisma } from "@/lib/prisma"
import { requirePatientAccess } from "@/lib/clinical-auth"
import { getPatientIdField } from "@/lib/patient-id"
import { logger } from "@/lib/logger"

const patientSchema = z.object({
  name: z.string().min(1),
  dob: z.string().optional(),
  sex: z.string().optional(),
  mrn: z.string().optional(),
  avatar: z.string().optional(),
  summary: z.string().optional(),
})

const patientUpdateSchema = patientSchema.partial().extend({ id: z.string().min(1) })

// GET /api/clinical/patient - List patients or get by id
export async function GET(request: NextRequest) {
  const authResult = await requireAuth()
  if (!isSession(authResult)) return authResult

  try {
    const searchParams = request.nextUrl.searchParams
    const id = searchParams.get("id")
    const name = searchParams.get("name")

    if (id) {
      const forbidden = await requirePatientAccess(authResult, id)
      if (forbidden) return forbidden

      const patient = await prismaClinical.patient.findFirst({
        where: { id, deletedAt: null },
      })
      if (!patient) {
        return NextResponse.json({ error: "Patient not found" }, { status: 404 })
      }
      return NextResponse.json(patient)
    }

    // List: admins see all, regular users see only assigned patients
    if (authResult.user.role !== "admin") {
      const idField = getPatientIdField()
      const assignments = await prisma.userPatient.findMany({
        where: { userId: authResult.user.id },
        select: { [idField]: true },
      })
      const assignedIds = assignments
        .map((a) => (a as Record<string, string | null>)[idField])
        .filter((id): id is string => id != null)
      const patients = await prismaClinical.patient.findMany({
        where: {
          id: { in: assignedIds },
          deletedAt: null,
          ...(name ? { name: { contains: name, mode: "insensitive" as const } } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: 200,
      })
      return NextResponse.json({ items: patients, total: patients.length })
    }

    const patients = await prismaClinical.patient.findMany({
      where: {
        deletedAt: null,
        ...(name ? { name: { contains: name, mode: "insensitive" as const } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    })

    return NextResponse.json({ items: patients, total: patients.length })
  } catch (error) {
    logger.error("Clinical patient search error", error)
    return NextResponse.json({ error: "Failed to fetch patients" }, { status: 500 })
  }
}

// POST /api/clinical/patient - Create a new patient
export async function POST(request: NextRequest) {
  const authResult = await requireAuth()
  if (!isSession(authResult)) return authResult

  try {
    const body = await request.json()
    const parsed = patientSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      )
    }

    const patient = await prismaClinical.patient.create({
      data: {
        name: parsed.data.name,
        dob: parsed.data.dob || "",
        sex: parsed.data.sex || "",
        mrn: parsed.data.mrn || "",
        avatar: parsed.data.avatar,
        summary: parsed.data.summary,
      },
    })

    return NextResponse.json({ id: patient.id })
  } catch (error) {
    logger.error("Clinical patient create error", error)
    return NextResponse.json({ error: "Failed to create patient" }, { status: 500 })
  }
}

// PUT /api/clinical/patient - Update a patient
export async function PUT(request: NextRequest) {
  const authResult = await requireAuth()
  if (!isSession(authResult)) return authResult

  try {
    const body = await request.json()
    const parsed = patientUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      )
    }

    const { id, ...data } = parsed.data

    const existing = await prismaClinical.patient.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    })
    if (!existing) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 })
    }

    const forbidden = await requirePatientAccess(authResult, id)
    if (forbidden) return forbidden

    const patient = await prismaClinical.patient.update({ where: { id }, data })

    return NextResponse.json(patient)
  } catch (error) {
    logger.error("Clinical patient update error", error)
    return NextResponse.json({ error: "Failed to update patient" }, { status: 500 })
  }
}

// DELETE /api/clinical/patient?id=<id> (soft delete, admin only)
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
    await prismaClinical.patient.update({
      where: { id },
      data: { deletedAt: new Date() },
    })

    logger.info("Patient soft-deleted", { patientId: id, userId: authResult.user.id })

    return NextResponse.json({ deleted: id })
  } catch (error) {
    logger.error("Clinical patient delete error", error)
    return NextResponse.json({ error: "Failed to delete patient" }, { status: 500 })
  }
}
