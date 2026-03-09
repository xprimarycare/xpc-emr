import { NextRequest, NextResponse } from "next/server"
import { requireAuth, isSession } from "@/lib/auth-helpers"
import { prismaClinical } from "@/lib/prisma-clinical"
import { logger } from "@/lib/logger"

// GET /api/clinical/catalog?text={search}&category={category}&limit={n}
// Replaces construe/semantic search for code resolution
export async function GET(request: NextRequest) {
  const authResult = await requireAuth()
  if (!isSession(authResult)) return authResult

  try {
    const searchParams = request.nextUrl.searchParams
    const text = searchParams.get("text")
    const category = searchParams.get("category")
    const rawLimit = parseInt(searchParams.get("limit") || "10")
    const limit = isNaN(rawLimit) ? 10 : Math.min(rawLimit, 100)

    if (!text) {
      return NextResponse.json({ error: "text parameter is required" }, { status: 400 })
    }

    const items = await prismaClinical.catalog.findMany({
      where: {
        ...(category ? { category } : {}),
        isActive: true,
        OR: [
          { name: { contains: text, mode: "insensitive" } },
          { displayName: { contains: text, mode: "insensitive" } },
          { code: { contains: text, mode: "insensitive" } },
          { aliases: { hasSome: [text] } },
        ],
      },
      take: limit,
    })

    // Shape to match what services expect from construe
    const codes = items.map((item) => ({
      code: item.code,
      system: item.codeSystem,
      display: item.displayName,
    }))

    return NextResponse.json({ codes })
  } catch (error) {
    logger.error("Clinical catalog search error", error)
    return NextResponse.json({ error: "Failed to search catalog" }, { status: 500 })
  }
}
