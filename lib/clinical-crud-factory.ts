import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAuth, isSession } from "@/lib/auth-helpers"
import { prismaClinical } from "@/lib/prisma-clinical"
import { requirePatientAccess } from "@/lib/clinical-auth"
import { logger } from "@/lib/logger"
import type { Prisma } from "@/app/generated/prisma-clinical/client"

/** Lowercase model names available on prismaClinical */
type ClinicalModelName = Uncapitalize<Prisma.ModelName>

interface CrudConfig {
  /** Prisma model name (type-checked against generated client) */
  model: ClinicalModelName
  /** Human-readable resource name for error messages */
  label: string
  /** Zod schema for POST body validation. PUT schema is derived (all fields optional + id required). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: z.ZodObject<any>
}

/**
 * Creates standard GET/POST/PUT/DELETE route handlers for a clinical resource.
 *
 * Backend guard is handled by middleware.ts (blocks /api/clinical/* in Medplum mode),
 * so individual handlers don't need to check the backend.
 */
export function createClinicalCrudHandlers(config: CrudConfig) {
  const { model, label, schema } = config
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const delegate = (prismaClinical as any)[model]
  const updateSchema = schema.partial().extend({ id: z.string().min(1) })

  async function GET(request: NextRequest) {
    const authResult = await requireAuth()
    if (!isSession(authResult)) return authResult

    try {
      const patientId = request.nextUrl.searchParams.get("patient")
      if (!patientId) {
        return NextResponse.json({ error: "patient parameter is required" }, { status: 400 })
      }

      const forbidden = await requirePatientAccess(authResult, patientId)
      if (forbidden) return forbidden

      const items = await delegate.findMany({
        where: { patientId },
        orderBy: { createdAt: "desc" },
      })

      return NextResponse.json({ items, total: items.length })
    } catch (error) {
      logger.error(`Clinical ${label} search error`, error)
      return NextResponse.json({ error: `Failed to fetch ${label}` }, { status: 500 })
    }
  }

  async function POST(request: NextRequest) {
    const authResult = await requireAuth()
    if (!isSession(authResult)) return authResult

    try {
      const body = await request.json()
      const parsed = schema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json(
          { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
          { status: 400 },
        )
      }

      const forbidden = await requirePatientAccess(authResult, parsed.data.patientId as string)
      if (forbidden) return forbidden

      const item = await delegate.create({ data: parsed.data })
      return NextResponse.json({ id: item.id })
    } catch (error) {
      logger.error(`Clinical ${label} create error`, error)
      return NextResponse.json({ error: `Failed to create ${label}` }, { status: 500 })
    }
  }

  async function PUT(request: NextRequest) {
    const authResult = await requireAuth()
    if (!isSession(authResult)) return authResult

    try {
      const body = await request.json()
      const parsed = updateSchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json(
          { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
          { status: 400 },
        )
      }

      const { id, ...data } = parsed.data
      delete data.patientId

      const existing = await delegate.findUnique({ where: { id }, select: { patientId: true } })
      if (!existing) {
        return NextResponse.json({ error: "Not found" }, { status: 404 })
      }

      const forbidden = await requirePatientAccess(authResult, existing.patientId)
      if (forbidden) return forbidden

      const item = await delegate.update({ where: { id }, data })
      return NextResponse.json(item)
    } catch (error) {
      logger.error(`Clinical ${label} update error`, error)
      return NextResponse.json({ error: `Failed to update ${label}` }, { status: 500 })
    }
  }

  async function DELETE(request: NextRequest) {
    const authResult = await requireAuth()
    if (!isSession(authResult)) return authResult

    try {
      const id = request.nextUrl.searchParams.get("id")
      if (!id) {
        return NextResponse.json({ error: "id parameter is required" }, { status: 400 })
      }

      const existing = await delegate.findUnique({ where: { id }, select: { patientId: true } })
      if (!existing) {
        return NextResponse.json({ error: "Not found" }, { status: 404 })
      }

      const forbidden = await requirePatientAccess(authResult, existing.patientId)
      if (forbidden) return forbidden

      await delegate.delete({ where: { id } })
      return NextResponse.json({ success: true })
    } catch (error) {
      logger.error(`Clinical ${label} delete error`, error)
      return NextResponse.json({ error: `Failed to delete ${label}` }, { status: 500 })
    }
  }

  return { GET, POST, PUT, DELETE }
}
