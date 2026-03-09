import { NextRequest, NextResponse } from "next/server"
import { requireAuth, isSession } from "@/lib/auth-helpers"
import { getAllConfig, setConfig } from "@/lib/app-config"
import { logger } from "@/lib/logger"

// GET /api/admin/settings - Read all config
export async function GET() {
  const authResult = await requireAuth()
  if (!isSession(authResult)) return authResult

  if (authResult.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const config = await getAllConfig()
  return NextResponse.json(config)
}

// PUT /api/admin/settings - Update a config value
export async function PUT(request: NextRequest) {
  const authResult = await requireAuth()
  if (!isSession(authResult)) return authResult

  if (authResult.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await request.json()
  const { key, value } = body

  if (!key || typeof value !== "string") {
    return NextResponse.json({ error: "key and value are required" }, { status: 400 })
  }

  const allowedKeys = ["EMR_BACKEND"]
  if (!allowedKeys.includes(key)) {
    return NextResponse.json({ error: `Key "${key}" is not configurable` }, { status: 400 })
  }

  if (key === "EMR_BACKEND" && !["local", "medplum"].includes(value)) {
    return NextResponse.json({ error: "EMR_BACKEND must be 'local' or 'medplum'" }, { status: 400 })
  }

  await setConfig(key, value)

  // TODO: Runtime process.env mutation only affects this server instance.
  // In serverless (Vercel), each function invocation may use a cold-start value.
  // NEXT_PUBLIC_* vars are inlined at build time — client-side reads are stale
  // until a rebuild. Consider a full-page reload or API-based client read.
  process.env[key] = value

  logger.info("Config updated", { key, value, userId: authResult.user.id })

  return NextResponse.json({ success: true, key, value })
}
