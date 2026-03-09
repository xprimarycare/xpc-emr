import { NextRequest, NextResponse } from "next/server";
import { VertexAI } from "@google-cloud/vertexai";
import { phenomlClient } from "@/lib/phenoml/client";
import {
  mapFhirBundleToPatients,
  mapFhirBundleToMedications,
  mapFhirBundleToAllergies,
  mapFhirBundleToConditions,
  mapFhirBundleToProcedures,
  mapFhirBundleToFamilyHistories,
  mapFhirBundleToSocialHistories,
  mapFhirBundleToEncounters,
  mapFhirBundleToLabOrders,
  mapFhirBundleToImagingOrders,
  mapFhirBundleToTasks,
  mapFhirBundleToAppointments,
  mapFhirBundleToVitals,
  mapFhirBundleToThreads,
  mapFhirBundleToCareTeamMembers,
  mapFhirBundleToGoals,
  mapFhirBundleToReferrals,
} from "@/lib/phenoml/fhir-mapper";
import type { PatientData } from "@/lib/types/patient";
import type { AppMedication } from "@/lib/types/medication";
import type { AppAllergy } from "@/lib/types/allergy";
import type { AppCondition } from "@/lib/types/condition";
import type { AppProcedure } from "@/lib/types/procedure";
import type { AppFamilyMemberHistory } from "@/lib/types/family-history";
import type { AppSocialHistoryObservation } from "@/lib/types/social-history";
import type { AppEncounter } from "@/lib/types/encounter";
import type { AppLabOrder } from "@/lib/types/lab";
import type { AppImagingOrder } from "@/lib/types/imaging";
import type { AppTask } from "@/lib/types/task";
import type { AppAppointment } from "@/lib/types/appointment";
import type { AppVital } from "@/lib/types/vital";
import type { AppThread } from "@/lib/types/message";
import type { AppCareTeamMember } from "@/lib/types/care-team";
import type { AppGoal } from "@/lib/types/goal";
import type { AppReferral } from "@/lib/types/referral";
import type { AIAssistantMessage } from "@/lib/types/ai-assistant";
import { requireAuth, isSession } from "@/lib/auth-helpers";
import { isLocalBackend } from "@/lib/emr-backend";
import { prismaClinical } from "@/lib/prisma-clinical";

// --- In-Memory Patient Context Cache ---

interface CachedPatientContext {
  patient: PatientData | null;
  medications: AppMedication[];
  allergies: AppAllergy[];
  conditions: AppCondition[];
  procedures: AppProcedure[];
  familyHistory: AppFamilyMemberHistory[];
  socialHistory: AppSocialHistoryObservation[];
  encounters: AppEncounter[];
  labOrders: AppLabOrder[];
  imagingOrders: AppImagingOrder[];
  tasks: AppTask[];
  appointments: AppAppointment[];
  vitals: AppVital[];
  messages: AppThread[];
  careTeam: AppCareTeamMember[];
  goals: AppGoal[];
  referrals: AppReferral[];
  fetchedAt: number;
  errors: string[];
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 100;
const patientContextCache = new Map<string, CachedPatientContext>();

function evictStaleEntries() {
  const now = Date.now();
  for (const [key, entry] of patientContextCache) {
    if (now - entry.fetchedAt >= CACHE_TTL_MS) {
      patientContextCache.delete(key);
    }
  }
  // If still over limit, evict oldest entries
  if (patientContextCache.size > MAX_CACHE_SIZE) {
    const entries = [...patientContextCache.entries()]
      .sort((a, b) => a[1].fetchedAt - b[1].fetchedAt);
    const toRemove = entries.slice(0, entries.length - MAX_CACHE_SIZE);
    for (const [key] of toRemove) {
      patientContextCache.delete(key);
    }
  }
}

// --- FHIR Data Aggregation ---

async function fetchPatientContext(
  patientFhirId: string,
  providerId: string
): Promise<CachedPatientContext> {
  const errors: string[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function fhirSearch(
    resourceType: string,
    queryParams: Record<string, string>,
    label: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<any> {
    try {
      return await phenomlClient.fhir.search(providerId, resourceType, {}, { queryParams });
    } catch {
      errors.push(label);
      return { resourceType: "Bundle", type: "searchset", entry: [] };
    }
  }

  const patientRef = `Patient/${patientFhirId}`;

  // Fire all searches in parallel
  const [
    patientBundle,
    medicationBundle,
    allergyBundle,
    conditionBundle,
    procedureBundle,
    familyHistoryBundle,
    socialHistoryBundle,
    encounterBundle,
    clinicalImpressionBundle,
    serviceRequestBundle,
    referralBundle,
    taskBundle,
    appointmentBundle,
    vitalBundle,
    communicationBundle,
    careTeamBundle,
    goalBundle,
  ] = await Promise.all([
    fhirSearch("Patient", {}, "patient"),
    fhirSearch("MedicationRequest", { subject: patientRef, _count: "100" }, "medications"),
    fhirSearch("AllergyIntolerance", { patient: patientRef, _count: "100" }, "allergies"),
    fhirSearch("Condition", { subject: patientRef, _count: "100" }, "conditions"),
    fhirSearch("Procedure", { subject: patientRef, _count: "100" }, "procedures"),
    fhirSearch("FamilyMemberHistory", { patient: patientRef, _count: "100" }, "family history"),
    fhirSearch("Observation", { subject: patientRef, category: "social-history", _count: "100" }, "social history"),
    fhirSearch("Encounter", { subject: patientRef, _count: "100" }, "encounters"),
    fhirSearch("ClinicalImpression", { subject: patientRef, _count: "100" }, "clinical impressions"),
    fhirSearch("ServiceRequest", { subject: patientRef, _count: "100" }, "service requests"),
    fhirSearch("ServiceRequest", { subject: patientRef, category: "3457005", _count: "100" }, "referrals"),
    fhirSearch("Task", { patient: patientRef, _count: "100" }, "tasks"),
    fhirSearch("Appointment", { actor: patientRef, _count: "100" }, "appointments"),
    fhirSearch("Observation", { patient: patientRef, category: "vital-signs", _count: "100", _sort: "-date" }, "vitals"),
    fhirSearch("Communication", { subject: patientRef, "part-of:missing": "true", _revinclude: "Communication:part-of", _sort: "-sent", _count: "100" }, "messages"),
    fhirSearch("CareTeam", { subject: patientRef, _count: "100" }, "care team"),
    fhirSearch("Goal", { subject: patientRef, _count: "100" }, "goals"),
  ]);

  // Filter patient bundle to just this patient (matches existing pattern in patient route)
  if (patientBundle?.entry) {
    patientBundle.entry = patientBundle.entry.filter(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (entry: any) => entry.resource?.id === patientFhirId
    );
  }

  const patients = mapFhirBundleToPatients(patientBundle);
  const patient = patients[0] || null;

  return {
    patient,
    medications: mapFhirBundleToMedications(medicationBundle),
    allergies: mapFhirBundleToAllergies(allergyBundle),
    conditions: mapFhirBundleToConditions(conditionBundle),
    procedures: mapFhirBundleToProcedures(procedureBundle),
    familyHistory: mapFhirBundleToFamilyHistories(familyHistoryBundle),
    socialHistory: mapFhirBundleToSocialHistories(socialHistoryBundle),
    encounters: mapFhirBundleToEncounters(encounterBundle, clinicalImpressionBundle),
    labOrders: mapFhirBundleToLabOrders(serviceRequestBundle),
    imagingOrders: mapFhirBundleToImagingOrders(serviceRequestBundle),
    tasks: mapFhirBundleToTasks(taskBundle),
    appointments: mapFhirBundleToAppointments(appointmentBundle),
    vitals: mapFhirBundleToVitals(vitalBundle),
    messages: mapFhirBundleToThreads(communicationBundle),
    careTeam: mapFhirBundleToCareTeamMembers(careTeamBundle),
    goals: mapFhirBundleToGoals(goalBundle),
    referrals: mapFhirBundleToReferrals(referralBundle),
    fetchedAt: Date.now(),
    errors,
  };
}

// --- Local DB Data Aggregation ---

async function fetchLocalPatientContext(
  patientId: string
): Promise<CachedPatientContext> {
  const errors: string[] = [];

  try {
    const patient = await prismaClinical.patient.findUnique({
      where: { id: patientId },
      include: {
        medications: true,
        allergies: true,
        conditions: true,
        procedures: true,
        familyHistories: { include: { conditions: true } },
        vitals: { orderBy: { effectiveDateTime: "desc" } },
        socialHistories: true,
        encounters: true,
        labOrders: true,
        imagingOrders: true,
        referrals: true,
        goals: true,
        careTeamMembers: true,
        tasks: true,
        appointments: true,
        threads: { include: { messages: true } },
      },
    });

    if (!patient) {
      return {
        patient: null,
        medications: [],
        allergies: [],
        conditions: [],
        procedures: [],
        familyHistory: [],
        socialHistory: [],
        encounters: [],
        labOrders: [],
        imagingOrders: [],
        tasks: [],
        appointments: [],
        vitals: [],
        messages: [],
        careTeam: [],
        goals: [],
        referrals: [],
        fetchedAt: Date.now(),
        errors: ["Patient not found"],
      };
    }

    // Map to app types (clinical DB fields closely match app types)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mapId = (item: any) => ({ ...item, fhirId: item.id });

    return {
      patient: {
        fhirId: patient.id,
        name: patient.name,
        dob: patient.dob,
        sex: patient.sex,
        mrn: patient.mrn,
        avatar: patient.avatar || undefined,
        summary: patient.summary || undefined,
      } as PatientData,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      medications: patient.medications.map(mapId) as any[],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      allergies: patient.allergies.map(mapId) as any[],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      conditions: patient.conditions.map((c) => ({
        ...c,
        fhirId: c.id,
        coding: c.codingCode ? { code: c.codingCode, system: c.codingSystem || "", display: c.codingDisplay || "" } : undefined,
      })) as any[],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      procedures: patient.procedures.map(mapId) as any[],
      familyHistory: patient.familyHistories.map((fh) => ({
        ...fh,
        fhirId: fh.id,
        conditions: fh.conditions.map((c) => ({ ...c, fhirId: c.id })),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      })) as any[],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      socialHistory: patient.socialHistories.map(mapId) as any[],
      encounters: patient.encounters.map((e) => ({
        ...e,
        fhirId: e.id,
        encounterFhirId: e.id,
        patientFhirId: e.patientId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      })) as any[],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      labOrders: patient.labOrders.map(mapId) as any[],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      imagingOrders: patient.imagingOrders.map(mapId) as any[],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tasks: patient.tasks.map((t) => ({ ...t, fhirId: t.id, patientFhirId: patient.id })) as any[],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      appointments: patient.appointments.map(mapId) as any[],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vitals: patient.vitals.map((v) => ({ ...v, fhirId: v.id, patientFhirId: patient.id })) as any[],
      messages: patient.threads.map((t) => ({
        id: t.id,
        fhirId: t.id,
        topic: t.topic || "",
        patientRef: `Patient/${patient.id}`,
        messages: t.messages.map((m) => ({
          id: m.id,
          fhirId: m.id,
          threadId: t.id,
          text: m.text,
          senderType: m.senderType,
          senderRef: m.senderRef || "",
          sentAt: m.sentAt || "",
          status: "completed" as const,
        })),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      })) as any[],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      careTeam: patient.careTeamMembers.map(mapId) as any[],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      goals: patient.goals.map((g: any) => ({
        ...g,
        fhirId: g.id,
        coding: g.codingCode ? { code: g.codingCode, system: g.codingSystem || "", display: g.codingDisplay || "" } : undefined,
      })) as any[],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      referrals: patient.referrals.map((r) => ({ ...r, fhirId: r.id, patientFhirId: patient.id })) as any[],
      fetchedAt: Date.now(),
      errors,
    };
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "Failed to fetch patient context");
    return {
      patient: null,
      medications: [],
      allergies: [],
      conditions: [],
      procedures: [],
      familyHistory: [],
      socialHistory: [],
      encounters: [],
      labOrders: [],
      imagingOrders: [],
      tasks: [],
      appointments: [],
      vitals: [],
      messages: [],
      careTeam: [],
      goals: [],
      referrals: [],
      fetchedAt: Date.now(),
      errors,
    };
  }
}

// --- Cache Helper ---

async function getPatientContext(
  patientFhirId: string,
  providerId: string,
  userId: string,
  log: (level: "log" | "warn" | "error", ...args: unknown[]) => void
): Promise<CachedPatientContext> {
  const cacheKey = `${userId}:${patientFhirId}`;
  const cached = patientContextCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    log("log", "Using cached patient context", {
      patientFhirId,
      cacheAge: `${Math.round((Date.now() - cached.fetchedAt) / 1000)}s`,
    });
    return cached;
  }

  log("log", "Fetching fresh patient context", { patientFhirId });
  const startTime = Date.now();
  const context = isLocalBackend()
    ? await fetchLocalPatientContext(patientFhirId)
    : await fetchPatientContext(patientFhirId, providerId);
  const elapsed = Date.now() - startTime;

  log("log", `Patient context fetched in ${elapsed}ms`, {
    medications: context.medications.length,
    conditions: context.conditions.length,
    encounters: context.encounters.length,
    allergies: context.allergies.length,
    vitals: context.vitals.length,
    errors: context.errors,
  });

  patientContextCache.set(cacheKey, context);
  evictStaleEntries();
  return context;
}

// --- System Prompt Builder ---

function buildSystemPrompt(ctx: CachedPatientContext): string {
  const { patient } = ctx;

  let prompt = `You are a clinical assistant integrated into an Electronic Health Record (EHR) system. Below is the complete medical record for the current patient. Answer questions about this patient based ONLY on the data provided. If the data does not contain information to answer a question, say so clearly. Format your responses with clear headers and bullet points when listing multiple items. Do not use HTML tags.

## Patient Demographics
- Name: ${patient?.name || "Unknown"}
- Date of Birth: ${patient?.dob || "Unknown"}
- Sex: ${patient?.sex || "Unknown"}
- MRN: ${patient?.mrn || "Unknown"}
`;

  // Medications
  if (ctx.medications.length > 0) {
    prompt += `\n## Medications (${ctx.medications.length})\n`;
    for (const med of ctx.medications) {
      const parts = [med.name, med.dose, med.route, med.frequency].filter(Boolean);
      prompt += `- ${parts.join(" ")} — status: ${med.status}`;
      if (med.authoredOn) prompt += `, prescribed: ${med.authoredOn}`;
      if (med.dosageText) prompt += ` (${med.dosageText})`;
      prompt += "\n";
    }
  } else {
    prompt += "\n## Medications\nNo medications on file.\n";
  }

  // Allergies
  if (ctx.allergies.length > 0) {
    prompt += `\n## Allergies (${ctx.allergies.length})\n`;
    for (const a of ctx.allergies) {
      prompt += `- ${a.substance} (${a.category || "unknown category"}) — ${a.clinicalStatus}, criticality: ${a.criticality || "unknown"}`;
      if (a.reaction) prompt += `, reaction: ${a.reaction}`;
      if (a.severity) prompt += ` (${a.severity})`;
      prompt += "\n";
    }
  } else {
    prompt += "\n## Allergies\nNo allergies on file.\n";
  }

  // Conditions / Problem List
  if (ctx.conditions.length > 0) {
    prompt += `\n## Conditions / Problem List (${ctx.conditions.length})\n`;
    for (const c of ctx.conditions) {
      prompt += `- ${c.name} — ${c.clinicalStatus}`;
      if (c.coding?.code) prompt += ` (ICD-10: ${c.coding.code})`;
      if (c.severity) prompt += `, severity: ${c.severity}`;
      if (c.onsetDate) prompt += `, onset: ${c.onsetDate}`;
      prompt += "\n";
    }
  } else {
    prompt += "\n## Conditions / Problem List\nNo conditions on file.\n";
  }

  // Vitals
  if (ctx.vitals.length > 0) {
    prompt += `\n## Vitals (${ctx.vitals.length} readings)\n`;
    for (const v of ctx.vitals) {
      if (v.systolic !== undefined && v.diastolic !== undefined) {
        prompt += `- ${v.name}: ${v.systolic}/${v.diastolic} mmHg — ${v.effectiveDateTime}\n`;
      } else if (v.value !== undefined) {
        prompt += `- ${v.name}: ${v.value} ${v.unit || ""} — ${v.effectiveDateTime}\n`;
      }
    }
  } else {
    prompt += "\n## Vitals\nNo vitals on file.\n";
  }

  // Encounters + Clinical Notes
  if (ctx.encounters.length > 0) {
    prompt += `\n## Encounters (${ctx.encounters.length})\n`;
    for (const e of ctx.encounters) {
      prompt += `- ${e.date} — ${e.classDisplay} (${e.status})`;
      if (e.noteText) {
        const truncated = e.noteText.length > 500 ? e.noteText.slice(0, 500) + "..." : e.noteText;
        prompt += `\n  Note: ${truncated}`;
      }
      prompt += "\n";
    }
  } else {
    prompt += "\n## Encounters\nNo encounters on file.\n";
  }

  // Lab Orders
  if (ctx.labOrders.length > 0) {
    prompt += `\n## Lab Orders (${ctx.labOrders.length})\n`;
    for (const lab of ctx.labOrders) {
      prompt += `- ${lab.testName} — ${lab.status}, priority: ${lab.priority}`;
      if (lab.authoredOn) prompt += `, ordered: ${lab.authoredOn}`;
      prompt += "\n";
    }
  } else {
    prompt += "\n## Lab Orders\nNo lab orders on file.\n";
  }

  // Imaging Orders
  if (ctx.imagingOrders.length > 0) {
    prompt += `\n## Imaging Orders (${ctx.imagingOrders.length})\n`;
    for (const img of ctx.imagingOrders) {
      prompt += `- ${img.studyName} — ${img.status}, priority: ${img.priority}`;
      if (img.authoredOn) prompt += `, ordered: ${img.authoredOn}`;
      prompt += "\n";
    }
  } else {
    prompt += "\n## Imaging Orders\nNo imaging orders on file.\n";
  }

  // Procedures
  if (ctx.procedures.length > 0) {
    prompt += `\n## Procedures / Surgical History (${ctx.procedures.length})\n`;
    for (const p of ctx.procedures) {
      prompt += `- ${p.name} — ${p.status}`;
      if (p.performedDate) prompt += `, performed: ${p.performedDate}`;
      if (p.outcome) prompt += `, outcome: ${p.outcome}`;
      prompt += "\n";
    }
  } else {
    prompt += "\n## Procedures / Surgical History\nNo procedures on file.\n";
  }

  // Family History
  if (ctx.familyHistory.length > 0) {
    prompt += `\n## Family History (${ctx.familyHistory.length} members)\n`;
    for (const fh of ctx.familyHistory) {
      prompt += `- ${fh.name} (${fh.relationshipDisplay})`;
      if (fh.deceased) prompt += " — deceased";
      if (fh.deceasedAge) prompt += ` at age ${fh.deceasedAge}`;
      if (fh.conditions.length > 0) {
        const condList = fh.conditions.map((c) => {
          let s = c.name;
          if (c.onsetAge) s += ` (onset age ${c.onsetAge})`;
          return s;
        });
        prompt += `: ${condList.join(", ")}`;
      }
      prompt += "\n";
    }
  } else {
    prompt += "\n## Family History\nNo family history on file.\n";
  }

  // Social History
  if (ctx.socialHistory.length > 0) {
    prompt += `\n## Social History (${ctx.socialHistory.length})\n`;
    for (const sh of ctx.socialHistory) {
      prompt += `- ${sh.name}: ${sh.value || "not specified"}`;
      if (sh.effectiveDate) prompt += ` (as of ${sh.effectiveDate})`;
      prompt += "\n";
    }
  } else {
    prompt += "\n## Social History\nNo social history on file.\n";
  }

  // Goals of Care
  if (ctx.goals.length > 0) {
    prompt += `\n## Goals of Care (${ctx.goals.length})\n`;
    for (const g of ctx.goals) {
      prompt += `- ${g.name} — ${g.lifecycleStatus}`;
      if (g.startDate) prompt += `, started: ${g.startDate}`;
      if (g.note) prompt += ` — ${g.note}`;
      prompt += "\n";
    }
  } else {
    prompt += "\n## Goals of Care\nNo goals on file.\n";
  }

  // Care Team
  if (ctx.careTeam.length > 0) {
    prompt += `\n## Care Team (${ctx.careTeam.length})\n`;
    for (const ct of ctx.careTeam) {
      prompt += `- ${ct.name} — ${ct.role} (${ct.status})\n`;
    }
  } else {
    prompt += "\n## Care Team\nNo care team members on file.\n";
  }

  // Referrals
  if (ctx.referrals.length > 0) {
    prompt += `\n## Referrals (${ctx.referrals.length})\n`;
    for (const r of ctx.referrals) {
      prompt += `- ${r.referralType} — ${r.status}, priority: ${r.priority}`;
      if (r.referredTo) prompt += `, referred to: ${r.referredTo}`;
      if (r.reason) prompt += `, reason: ${r.reason}`;
      prompt += "\n";
    }
  } else {
    prompt += "\n## Referrals\nNo referrals on file.\n";
  }

  // Tasks
  if (ctx.tasks.length > 0) {
    prompt += `\n## Tasks (${ctx.tasks.length})\n`;
    for (const t of ctx.tasks) {
      prompt += `- ${t.description} — ${t.status}, priority: ${t.priority}`;
      if (t.dueDate) prompt += `, due: ${t.dueDate}`;
      prompt += "\n";
    }
  } else {
    prompt += "\n## Tasks\nNo tasks on file.\n";
  }

  // Appointments
  if (ctx.appointments.length > 0) {
    prompt += `\n## Appointments (${ctx.appointments.length})\n`;
    for (const a of ctx.appointments) {
      prompt += `- ${a.description || "Appointment"} — ${a.status}`;
      if (a.start) prompt += `, ${a.start}`;
      if (a.end) prompt += ` to ${a.end}`;
      if (a.appointmentType) prompt += ` (${a.appointmentType})`;
      prompt += "\n";
    }
  } else {
    prompt += "\n## Appointments\nNo appointments on file.\n";
  }

  // Messages
  if (ctx.messages.length > 0) {
    prompt += `\n## Patient Messages (${ctx.messages.length} threads)\n`;
    for (const thread of ctx.messages) {
      prompt += `- Thread: "${thread.topic || "Untitled"}" (${thread.messages.length} messages)\n`;
      for (const msg of thread.messages.slice(-3)) {
        const text = msg.text.length > 200 ? msg.text.slice(0, 200) + "..." : msg.text;
        prompt += `  - [${msg.senderType}] ${msg.sentAt}: ${text}\n`;
      }
    }
  } else {
    prompt += "\n## Patient Messages\nNo messages on file.\n";
  }

  // Note any fetch errors
  if (ctx.errors.length > 0) {
    prompt += `\n## Data Loading Notes\nThe following data sections could not be loaded and may be incomplete: ${ctx.errors.join(", ")}.\n`;
  }

  return prompt;
}

// --- POST Handler ---

export async function POST(request: NextRequest) {
  const authResult = await requireAuth()
  if (!isSession(authResult)) return authResult

  const requestId = crypto.randomUUID().slice(0, 8);
  const log = (level: "log" | "warn" | "error", ...args: unknown[]) =>
    console[level](`[ai-assistant][${requestId}]`, ...args);

  try {
    const project = process.env.GOOGLE_CLOUD_PROJECT;
    const location = process.env.GOOGLE_CLOUD_LOCATION || "us-central1";

    if (!project) {
      log("warn", "Google Cloud project not configured");
      return NextResponse.json(
        { error: "AI assistant not configured — missing GOOGLE_CLOUD_PROJECT" },
        { status: 500 }
      );
    }

    const providerId = process.env.PHENOML_FHIR_PROVIDER_ID;
    if (!isLocalBackend() && !providerId) {
      log("warn", "FHIR provider not configured");
      return NextResponse.json(
        { error: "FHIR provider not configured" },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { patientFhirId, message, conversationHistory } = body as {
      patientFhirId: string;
      message: string;
      conversationHistory: AIAssistantMessage[];
    };

    if (!patientFhirId) {
      return NextResponse.json({ error: "patientFhirId is required" }, { status: 400 });
    }
    if (!message?.trim()) {
      return NextResponse.json({ error: "message is required" }, { status: 400 });
    }

    log("log", "AI request", {
      patientFhirId,
      messageLength: message.length,
      historyLength: conversationHistory?.length || 0,
    });

    // 1. Get patient context (cached or fresh)
    const patientContext = await getPatientContext(patientFhirId, providerId || "", authResult.user.id, log);

    // 2. Build system prompt
    const systemPrompt = buildSystemPrompt(patientContext);

    // 3. Initialize Vertex AI and model
    const vertexAI = new VertexAI({ project, location });
    const model = vertexAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      systemInstruction: { role: "system" as any, parts: [{ text: systemPrompt }] },
    });

    // 4. Build conversation contents for multi-turn
    const contents = (conversationHistory || []).map((msg) => ({
      role: msg.role,
      parts: [{ text: msg.content }],
    }));
    contents.push({ role: "user", parts: [{ text: message }] });

    // 5. Call Gemini
    const startTime = Date.now();
    let responseText: string;

    try {
      const result = await model.generateContent({ contents });
      const elapsed = Date.now() - startTime;
      responseText = result.response?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      log("log", `Gemini response in ${elapsed}ms`, { responseLength: responseText.length });
    } catch (aiError) {
      const elapsed = Date.now() - startTime;
      log("error", `Gemini API error after ${elapsed}ms:`, {
        message: aiError instanceof Error ? aiError.message : String(aiError),
      });
      return NextResponse.json({ error: "Failed to get AI response" }, { status: 502 });
    }

    if (!responseText) {
      log("warn", "Empty response from Gemini");
      return NextResponse.json({ error: "AI returned an empty response" }, { status: 502 });
    }

    return NextResponse.json({ response: responseText });
  } catch (error) {
    log("error", "Unhandled exception:", {
      name: error instanceof Error ? error.name : "unknown",
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
