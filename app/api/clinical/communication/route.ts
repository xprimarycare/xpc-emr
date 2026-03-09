import { NextRequest, NextResponse } from "next/server"
import { requireAuth, isSession } from "@/lib/auth-helpers"
import { prismaClinical } from "@/lib/prisma-clinical"
import { requirePatientAccess } from "@/lib/clinical-auth"

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
    console.error("Clinical communication search error:", error)
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

    if (body.patientId) {
      const forbidden = await requirePatientAccess(authResult, body.patientId)
      if (forbidden) return forbidden
    }

    if (body.threadId) {
      // Add message to existing thread
      const message = await prismaClinical.message.create({
        data: {
          threadId: body.threadId,
          senderType: body.senderType || "provider",
          senderRef: body.senderRef || "",
          text: body.text,
          sentAt: body.sentAt || new Date().toISOString(),
          receivedAt: body.receivedAt,
          status: body.status || "completed",
        },
      })

      // Touch thread updatedAt
      await prismaClinical.thread.update({
        where: { id: body.threadId },
        data: { updatedAt: new Date() },
      })

      return NextResponse.json({ id: message.id })
    }

    // Create new thread
    const thread = await prismaClinical.thread.create({
      data: {
        patientId: body.patientId,
        topic: body.topic || "",
      },
    })

    return NextResponse.json({ id: thread.id })
  } catch (error) {
    console.error("Clinical communication create error:", error)
    return NextResponse.json({ error: "Failed to create message/thread" }, { status: 500 })
  }
}
