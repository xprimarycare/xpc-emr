import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAuth, isSession } from "@/lib/auth-helpers"
import { prismaClinical } from "@/lib/prisma-clinical"
import { requirePatientAccess } from "@/lib/clinical-auth"
import { logger } from "@/lib/logger"

const newThreadSchema = z.object({
  patientId: z.string().min(1),
  topic: z.string().optional(),
})

const newMessageSchema = z.object({
  threadId: z.string().min(1),
  senderType: z.string().optional(),
  senderRef: z.string().optional(),
  text: z.string().min(1),
  sentAt: z.string().optional(),
  receivedAt: z.string().optional(),
  status: z.string().optional(),
})

// GET /api/clinical/communication?patient={id} - Get threads with nested messages
// GET /api/clinical/communication?thread={threadId} - Get messages in a thread
export async function GET(request: NextRequest) {
  const authResult = await requireAuth()
  if (!isSession(authResult)) return authResult

  try {
    const searchParams = request.nextUrl.searchParams
    const patientId = searchParams.get("patient")
    const threadId = searchParams.get("thread")

    if (threadId) {
      const thread = await prismaClinical.thread.findUnique({
        where: { id: threadId },
        include: {
          messages: { orderBy: { sentAt: "asc" } },
        },
      })

      if (!thread) {
        return NextResponse.json({ error: "Thread not found" }, { status: 404 })
      }

      const forbidden = await requirePatientAccess(authResult, thread.patientId)
      if (forbidden) return forbidden

      return NextResponse.json(thread)
    }

    if (!patientId) {
      return NextResponse.json({ error: "patient parameter is required" }, { status: 400 })
    }

    const forbidden = await requirePatientAccess(authResult, patientId)
    if (forbidden) return forbidden

    const threads = await prismaClinical.thread.findMany({
      where: { patientId },
      include: {
        messages: { orderBy: { sentAt: "asc" } },
      },
      orderBy: { updatedAt: "desc" },
    })

    return NextResponse.json({ items: threads, total: threads.length })
  } catch (error) {
    logger.error("Clinical communication search error", error)
    return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 })
  }
}

// POST /api/clinical/communication - Create a thread or add a message
// Body: { patientId, topic } to create a thread
// Body: { threadId, senderType, senderRef, text, sentAt } to add a message
export async function POST(request: NextRequest) {
  const authResult = await requireAuth()
  if (!isSession(authResult)) return authResult

  try {
    const body = await request.json()

    if (body.threadId) {
      // Add message to existing thread
      const parsed = newMessageSchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json(
          { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
          { status: 400 },
        )
      }

      const thread = await prismaClinical.thread.findUnique({
        where: { id: parsed.data.threadId },
        select: { patientId: true },
      })
      if (!thread) {
        return NextResponse.json({ error: "Thread not found" }, { status: 404 })
      }

      const forbidden = await requirePatientAccess(authResult, thread.patientId)
      if (forbidden) return forbidden

      const message = await prismaClinical.message.create({
        data: {
          threadId: parsed.data.threadId,
          senderType: parsed.data.senderType || "provider",
          senderRef: parsed.data.senderRef || "",
          text: parsed.data.text,
          sentAt: parsed.data.sentAt || new Date().toISOString(),
          receivedAt: parsed.data.receivedAt,
          status: parsed.data.status || "completed",
        },
      })

      // Touch thread updatedAt
      await prismaClinical.thread.update({
        where: { id: parsed.data.threadId },
        data: { updatedAt: new Date() },
      })

      return NextResponse.json({ id: message.id })
    }

    // Create new thread
    const parsed = newThreadSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      )
    }

    const forbidden = await requirePatientAccess(authResult, parsed.data.patientId)
    if (forbidden) return forbidden

    const thread = await prismaClinical.thread.create({
      data: {
        patientId: parsed.data.patientId,
        topic: parsed.data.topic || "",
      },
    })

    return NextResponse.json({ id: thread.id })
  } catch (error) {
    logger.error("Clinical communication create error", error)
    return NextResponse.json({ error: "Failed to create message/thread" }, { status: 500 })
  }
}
