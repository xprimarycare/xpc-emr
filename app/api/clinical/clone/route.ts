import { NextRequest, NextResponse } from "next/server"
import { requireAuth, isSession } from "@/lib/auth-helpers"
import { prismaClinical } from "@/lib/prisma-clinical"

// POST /api/clinical/clone - Duplicate a patient with all related resources (admin only)
export async function POST(request: NextRequest) {
  const authResult = await requireAuth()
  if (!isSession(authResult)) return authResult

  if (authResult.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const { sourcePatientId, newName, newDob, newSex } = await request.json()

    if (!sourcePatientId) {
      return NextResponse.json({ error: "sourcePatientId is required" }, { status: 400 })
    }

    const source = await prismaClinical.patient.findUnique({
      where: { id: sourcePatientId },
      include: {
        encounters: true,
        medications: true,
        allergies: true,
        conditions: true,
        procedures: true,
        familyHistories: { include: { conditions: true } },
        vitals: true,
        socialHistories: true,
        labOrders: true,
        imagingOrders: true,
        referrals: true,
        goals: true,
        careTeamMembers: true,
        tasks: true,
        appointments: true,
        threads: { include: { messages: true } },
        tabs: true,
      },
    })

    if (!source) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 })
    }

    // Helper to strip id/timestamps/FK from records for cloning
    function stripMeta<T extends Record<string, unknown>>(
      record: T,
      extraKeys: string[] = []
    ): Omit<T, "id" | "createdAt" | "updatedAt" | "patientId"> {
      const { id, createdAt, updatedAt, patientId, ...rest } = record
      for (const key of extraKeys) delete rest[key]
      return rest as Omit<T, "id" | "createdAt" | "updatedAt" | "patientId">
    }

    // Run entire clone inside a transaction for atomicity
    const encounterIdMap = new Map<string, string>()

    const newPatient = await prismaClinical.$transaction(async (tx) => {
      // Create the patient with nested resources that don't need ID mapping
      const patient = await tx.patient.create({
        data: {
          name: newName || source.name,
          dob: newDob || source.dob,
          sex: newSex || source.sex,
          mrn: source.mrn,
          avatar: source.avatar,
          summary: source.summary,
          medications: {
            create: source.medications.map((m) => stripMeta(m) as Parameters<typeof prismaClinical.medication.create>[0]["data"]),
          },
          allergies: {
            create: source.allergies.map((a) => stripMeta(a) as Parameters<typeof prismaClinical.allergy.create>[0]["data"]),
          },
          conditions: {
            create: source.conditions.map((c) => stripMeta(c) as Parameters<typeof prismaClinical.condition.create>[0]["data"]),
          },
          procedures: {
            create: source.procedures.map((p) => stripMeta(p) as Parameters<typeof prismaClinical.procedure.create>[0]["data"]),
          },
          socialHistories: {
            create: source.socialHistories.map((s) => stripMeta(s) as Parameters<typeof prismaClinical.socialHistory.create>[0]["data"]),
          },
          labOrders: {
            create: source.labOrders.map((l) => stripMeta(l) as Parameters<typeof prismaClinical.labOrder.create>[0]["data"]),
          },
          imagingOrders: {
            create: source.imagingOrders.map((i) => stripMeta(i) as Parameters<typeof prismaClinical.imagingOrder.create>[0]["data"]),
          },
          referrals: {
            create: source.referrals.map((r) => stripMeta(r) as Parameters<typeof prismaClinical.referral.create>[0]["data"]),
          },
          goals: {
            create: source.goals.map((g) => stripMeta(g) as Parameters<typeof prismaClinical.goal.create>[0]["data"]),
          },
          careTeamMembers: {
            create: source.careTeamMembers.map((c) => stripMeta(c) as Parameters<typeof prismaClinical.careTeamMember.create>[0]["data"]),
          },
        },
      })

      // Create encounters individually to build deterministic ID mapping
      for (const e of source.encounters) {
        const { id: oldId, createdAt, updatedAt, patientId, ...data } = e
        const newEnc = await tx.encounter.create({
          data: { ...data, patientId: patient.id } as Parameters<typeof prismaClinical.encounter.create>[0]["data"],
        })
        encounterIdMap.set(oldId, newEnc.id)
      }

      // Clone vitals with encounter mapping
      for (const v of source.vitals) {
        const { id, createdAt, updatedAt, patientId, encounterId, ...data } = v
        await tx.vital.create({
          data: {
            ...data,
            patientId: patient.id,
            encounterId: encounterId ? encounterIdMap.get(encounterId) || null : null,
          },
        })
      }

      // Clone tasks with encounter mapping
      for (const t of source.tasks) {
        const { id, createdAt, updatedAt, patientId, encounterId, ...data } = t
        await tx.task.create({
          data: {
            ...data,
            patientId: patient.id,
            encounterId: encounterId ? encounterIdMap.get(encounterId) || null : null,
          },
        })
      }

      // Clone appointments
      for (const a of source.appointments) {
        const { id, createdAt, updatedAt, patientId, ...data } = a
        await tx.appointment.create({
          data: { ...data, patientId: patient.id },
        })
      }

      // Clone family histories with nested conditions
      for (const fh of source.familyHistories) {
        const { id, createdAt, updatedAt, patientId, conditions, ...data } = fh
        await tx.familyHistory.create({
          data: {
            ...data,
            patientId: patient.id,
            conditions: {
              create: conditions.map((c) => {
                const { id: cId, familyHistoryId, ...cData } = c
                return cData
              }),
            },
          },
        })
      }

      // Clone threads with messages
      for (const thread of source.threads) {
        const { id, createdAt, updatedAt, patientId, messages, ...threadData } = thread
        await tx.thread.create({
          data: {
            ...threadData,
            patientId: patient.id,
            messages: {
              create: messages.map((m) => {
                const { id: mId, threadId, createdAt: mCreatedAt, ...mData } = m
                return mData
              }),
            },
          },
        })
      }

      // Clone tabs with encounter mapping
      for (const tab of source.tabs) {
        const { id, createdAt, updatedAt, patientId, encounterId, taskId, ...data } = tab
        await tx.tab.create({
          data: {
            ...data,
            patientId: patient.id,
            encounterId: encounterId ? encounterIdMap.get(encounterId) || null : null,
            taskId: null,
          },
        })
      }

      return patient
    })

    return NextResponse.json({
      id: newPatient.id,
      clonedCounts: {
        encounters: source.encounters.length,
        medications: source.medications.length,
        allergies: source.allergies.length,
        conditions: source.conditions.length,
        procedures: source.procedures.length,
        familyHistories: source.familyHistories.length,
        vitals: source.vitals.length,
        socialHistories: source.socialHistories.length,
        labOrders: source.labOrders.length,
        imagingOrders: source.imagingOrders.length,
        referrals: source.referrals.length,
        goals: source.goals.length,
        careTeamMembers: source.careTeamMembers.length,
        tasks: source.tasks.length,
        appointments: source.appointments.length,
        threads: source.threads.length,
        tabs: source.tabs.length,
      },
    })
  } catch (error) {
    console.error("Clinical clone error:", error)
    return NextResponse.json({ error: "Failed to clone patient" }, { status: 500 })
  }
}
