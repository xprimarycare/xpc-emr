import { NextRequest, NextResponse } from "next/server"
import { requireAuth, isSession } from "@/lib/auth-helpers"
import { getAllConfig, setConfig } from "@/lib/app-config"

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

  // Validate EMR_BACKEND values
  if (key === "EMR_BACKEND" && !["local", "medplum"].includes(value)) {
    return NextResponse.json({ error: "EMR_BACKEND must be 'local' or 'medplum'" }, { status: 400 })
  }

  await setConfig(key, value)

  // Apply to current process immediately
  process.env[key] = value
  if (key === "EMR_BACKEND") {
    process.env.NEXT_PUBLIC_EMR_BACKEND = value
  }

  return NextResponse.json({ success: true, key, value })
}
