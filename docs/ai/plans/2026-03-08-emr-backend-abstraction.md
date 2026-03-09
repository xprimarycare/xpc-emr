# EMR Backend Abstraction — Implementation Plan

## Overview

Detach from Medplum/PhenoML and introduce a local PostgreSQL clinical database as an alternative EMR backend. The app will support a global `EMR_BACKEND` toggle (`local` or `medplum`) so the entire instance uses one backend at a time, with the Medplum path preserved as a fallback.

## Current State Analysis

- **Two-tier data**: PostgreSQL (Prisma) for auth/users; Medplum (via PhenoML SDK) for all clinical data
- **Single entry point**: `lib/phenoml/client.ts` — throws at module-load time if env vars missing (24 files import it)
- **Three-tier service pattern**: UI → `lib/services/fhir-*-service.ts` (client-side) → `app/api/fhir/*/route.ts` (server-side) → `phenomlClient`
- **App types already decoupled**: `lib/types/*.ts` have zero FHIR imports — bidirectional mapper in `fhir-mapper.ts` bridges the gap
- **19 FHIR API routes**, **18 FHIR service files**, **2 PhenoML-specific routes** (lang2fhir, construe/semantic)

### Key Discoveries:
- `lib/phenoml/client.ts:3-11` — Module-level throws crash the entire Next.js worker if PhenoML env vars are absent. Must be made conditional before anything else.
- `lib/services/fhir-clone-service.ts:2` — Only service that imports `phenomlClient` directly (bypasses API routes). Also reads `PHENOML_FHIR_PROVIDER_ID` at module load (line 5).
- `app/api/fhir/patient/route.ts` DELETE — cascades into Prisma (`userPatient.deleteMany`, `patientTag.deleteMany`), so patient deletion in local mode must replicate this.
- `app/api/ai-assistant/chat/route.ts:114-151` — fires 17 parallel `phenomlClient.fhir.search` calls with 5-min cache. In local mode, this becomes a few Prisma queries.
- `app/api/case-library/route.ts` — Mixed Prisma + phenomlClient usage at module level.
- `lib/context/SidebarContext.tsx` — Already gracefully handles patients without `fhirId` by falling back to `mockVariables`.
- 7 services use `construe/semantic` for code resolution (allergy, condition, care-team, family-history, goal, procedure, social-history). In local mode, this will hit the catalog table.
- 2 services use `lang2fhir` for NLP parsing (medication, referral). In local mode, replaced by own AI resolver.

## Desired End State

- `EMR_BACKEND=local` runs the app entirely against a separate clinical PostgreSQL database
- `EMR_BACKEND=medplum` (or unset) runs the app against Medplum via PhenoML SDK exactly as today
- Clinical DB is portable — can be dumped/restored independently via `CLINICAL_DATABASE_URL`
- All `fhirId` references replaced with local DB IDs; `fhirPractitionerId` replaced with `xpcId`
- No FHIR mapping needed in local mode — API routes return app types directly
- A `catalog` table provides orderable items (CBC, CMP, etc.) for AI code resolution

### Verification:
- App starts and functions with `EMR_BACKEND=local` and no PhenoML env vars set
- App starts and functions with `EMR_BACKEND=medplum` with PhenoML env vars set
- All CRUD operations work in both modes for all 17 resource types
- Patient clone/duplicate works in local mode
- AI assistant queries local DB in local mode
- Case library works in both modes

## What We're NOT Doing

- Migrating existing Medplum data to local DB (starting fresh)
- Building a settings UI for the toggle (env var only for now)
- Implementing FHIR import/export
- Multi-tenant support (one backend per instance)
- Replacing the AI assistant's Gemini model or chart review functionality
- Changing the auth system (NextAuth stays as-is)

## Implementation Approach

The service layer is the natural toggle point. Each service currently calls `fetch('/api/fhir/...')` and maps FHIR→App types. In local mode, it calls `fetch('/api/clinical/...')` and gets app types directly (no mapping).

```
# Medplum mode (existing):
UI → service → /api/fhir/* → phenomlClient → Medplum
                              ↓
                         fhir-mapper.ts (FHIR→App)

# Local mode (new):
UI → service → /api/clinical/* → prisma (clinical DB)
                                  ↓
                             direct App types (no mapping)
```

---

## Phase 1: Foundation — Toggle, Conditional Client, Clinical DB Connection

### Overview
Make the app runnable without PhenoML env vars by conditionalizing the client import, add the `EMR_BACKEND` toggle infrastructure, and set up the second Prisma client for the clinical database.

### Changes Required:

#### 1. Make PhenoML client conditional
**File**: `lib/phenoml/client.ts`
**Changes**: Replace module-level throws with lazy initialization. Export a getter that throws only when accessed in medplum mode.

```typescript
import { PhenoMLClient } from "phenoml";

let _client: PhenoMLClient | null = null;

export function getPhenomlClient(): PhenoMLClient {
  if (!_client) {
    const username = process.env.PHENOML_USERNAME;
    const password = process.env.PHENOML_PASSWORD;
    const baseUrl = process.env.PHENOML_BASE_URL;

    if (!username || !password || !baseUrl) {
      throw new Error(
        "PhenoML environment variables (PHENOML_USERNAME, PHENOML_PASSWORD, PHENOML_BASE_URL) are required when EMR_BACKEND=medplum"
      );
    }

    _client = new PhenoMLClient({ username, password, baseUrl });
  }
  return _client;
}

// Keep backward compat during migration — lazy proxy
// TODO: Remove after all imports are updated to use getPhenomlClient()
export const phenomlClient = new Proxy({} as PhenoMLClient, {
  get(_target, prop) {
    return (getPhenomlClient() as any)[prop];
  },
});
```

#### 2. Backend toggle utility
**File**: `lib/emr-backend.ts` (new)
**Changes**: Central utility for checking which backend is active.

```typescript
export type EmrBackend = "local" | "medplum";

export function getEmrBackend(): EmrBackend {
  const backend = process.env.EMR_BACKEND?.toLowerCase();
  if (backend === "local") return "local";
  return "medplum"; // default to medplum for backward compat
}

export function isLocalBackend(): boolean {
  return getEmrBackend() === "local";
}

export function isMedplumBackend(): boolean {
  return getEmrBackend() === "medplum";
}
```

#### 3. Clinical Prisma schema + client
**File**: `prisma/clinical/schema.prisma` (new)
**Changes**: Separate Prisma schema pointing to `CLINICAL_DATABASE_URL`. Start with just the `Patient` model to validate the setup. Full schema comes in Phase 2.

```prisma
generator client {
  provider = "prisma-client"
  output   = "../../app/generated/prisma-clinical"
}

datasource db {
  provider = "postgresql"
  url      = env("CLINICAL_DATABASE_URL")
}

// Placeholder — full schema in Phase 2
model Patient {
  id        String   @id @default(cuid())
  name      String
  mrn       String   @default("")
  dob       String   @default("")
  sex       String   @default("")
  avatar    String?
  summary   String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("patients")
}
```

**File**: `lib/prisma-clinical.ts` (new)
**Changes**: Singleton client for clinical DB, mirroring existing `lib/prisma.ts` pattern.

```typescript
import { PrismaClient } from "@/app/generated/prisma-clinical";

const globalForPrisma = globalThis as unknown as {
  prismaClinical: PrismaClient | undefined;
};

export const prismaClinical =
  globalForPrisma.prismaClinical ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prismaClinical = prismaClinical;
}
```

#### 4. Environment setup
**File**: `.env.example` (update)
**Changes**: Add new env vars.

```
# EMR Backend Toggle — "local" or "medplum" (default: medplum)
EMR_BACKEND=local

# Clinical Database (required when EMR_BACKEND=local)
CLINICAL_DATABASE_URL=postgresql://user:password@localhost:5432/pineapplej_clinical
```

#### 5. Make fhir-clone-service conditional
**File**: `lib/services/fhir-clone-service.ts`
**Changes**: Replace top-level `import { phenomlClient }` with dynamic `getPhenomlClient()` calls inside functions. Replace `process.env.PHENOML_FHIR_PROVIDER_ID` read at line 5 with a function-scoped read.

### Success Criteria:

#### Automated Verification:
- [ ] App starts with `EMR_BACKEND=local` and NO PhenoML env vars — no crash
- [ ] App starts with `EMR_BACKEND=medplum` and PhenoML env vars — works as before
- [ ] `npx prisma generate --schema=prisma/clinical/schema.prisma` succeeds
- [ ] `npx prisma migrate dev --schema=prisma/clinical/schema.prisma` creates the clinical DB
- [ ] TypeScript compiles: `npm run typecheck`
- [ ] Existing tests pass

#### Manual Verification:
- [ ] Navigate the app with `EMR_BACKEND=local` — pages load without errors (clinical data will be empty)
- [ ] Navigate the app with `EMR_BACKEND=medplum` — existing functionality unchanged

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 2.

---

## Phase 2: Clinical Database Schema

### Overview
Define the full clinical database schema based on the existing app types in `lib/types/*.ts`. ~19 Prisma models plus a `Catalog` table for orderable items.

### Changes Required:

#### 1. Full clinical schema
**File**: `prisma/clinical/schema.prisma`
**Changes**: Replace placeholder with full schema. Design decisions:
- `coding` fields stored as 3 flat columns: `codingSystem`, `codingCode`, `codingDisplay` (nullable)
- All IDs are `cuid()` strings
- `patientId` FK on all patient-scoped resources
- Nested arrays (family conditions, messages) get their own tables
- No FHIR-isms — simple relational tables matching app types

```prisma
generator client {
  provider = "prisma-client"
  output   = "../../app/generated/prisma-clinical"
}

datasource db {
  provider = "postgresql"
  url      = env("CLINICAL_DATABASE_URL")
}

model Patient {
  id        String   @id @default(cuid())
  name      String
  mrn       String   @default("")
  dob       String   @default("")
  sex       String   @default("")
  avatar    String?
  summary   String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  encounters      Encounter[]
  medications     Medication[]
  allergies       Allergy[]
  conditions      Condition[]
  procedures      Procedure[]
  familyHistories FamilyHistory[]
  vitals          Vital[]
  socialHistories SocialHistory[]
  labOrders       LabOrder[]
  imagingOrders   ImagingOrder[]
  referrals       Referral[]
  goals           Goal[]
  careTeamMembers CareTeamMember[]
  tasks           Task[]
  appointments    Appointment[]
  threads         Thread[]
  tabs            Tab[]

  @@map("patients")
}

model Encounter {
  id           String   @id @default(cuid())
  patientId    String
  status       String   @default("planned") // planned, in-progress, finished, cancelled
  classCode    String   @default("AMB")     // AMB, IMP, EMER, VR, HH
  classDisplay String   @default("Ambulatory")
  date         String
  endDate      String?
  noteText     String   @default("")
  isSigned     Boolean  @default(false)
  signedAt     String?
  signedBy     String?
  signedById   String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  patient Patient @relation(fields: [patientId], references: [id], onDelete: Cascade)
  vitals  Vital[]
  tasks   Task[]

  @@index([patientId])
  @@map("encounters")
}

model Medication {
  id            String   @id @default(cuid())
  patientId     String
  name          String
  dose          String   @default("")
  route         String   @default("")
  frequency     String   @default("")
  status        String   @default("active") // active, cancelled, completed, stopped, draft, on-hold
  authoredOn    String?
  dosageText    String?
  codingSystem  String?
  codingCode    String?
  codingDisplay String?
  note          String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  patient Patient @relation(fields: [patientId], references: [id], onDelete: Cascade)

  @@index([patientId])
  @@map("medications")
}

model Allergy {
  id                 String   @id @default(cuid())
  patientId          String
  substance          String
  clinicalStatus     String   @default("active")       // active, inactive, resolved
  verificationStatus String   @default("unconfirmed")   // unconfirmed, presumed, confirmed, refuted
  type               String   @default("")               // allergy, intolerance
  category           String   @default("")               // food, medication, environment, biologic
  criticality        String   @default("")               // low, high, unable-to-assess
  reaction           String   @default("")
  severity           String   @default("")               // mild, moderate, severe
  recordedDate       String?
  codingSystem       String?
  codingCode         String?
  codingDisplay      String?
  note               String?
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  patient Patient @relation(fields: [patientId], references: [id], onDelete: Cascade)

  @@index([patientId])
  @@map("allergies")
}

model Condition {
  id                 String   @id @default(cuid())
  patientId          String
  name               String
  clinicalStatus     String   @default("active")
  verificationStatus String   @default("unconfirmed")
  severity           String   @default("")
  onsetDate          String   @default("")
  abatementDate      String   @default("")
  recordedDate       String?
  bodySite           String   @default("")
  codingSystem       String?
  codingCode         String?
  codingDisplay      String?
  note               String?
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  patient Patient @relation(fields: [patientId], references: [id], onDelete: Cascade)

  @@index([patientId])
  @@map("conditions")
}

model Procedure {
  id            String   @id @default(cuid())
  patientId     String
  name          String
  status        String   @default("completed")
  performedDate String   @default("")
  bodySite      String   @default("")
  outcome       String   @default("")
  codingSystem  String?
  codingCode    String?
  codingDisplay String?
  note          String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  patient Patient @relation(fields: [patientId], references: [id], onDelete: Cascade)

  @@index([patientId])
  @@map("procedures")
}

model FamilyHistory {
  id                  String   @id @default(cuid())
  patientId           String
  name                String
  relationship        String
  relationshipDisplay String   @default("")
  status              String   @default("completed") // partial, completed, entered-in-error, health-unknown
  deceased            Boolean  @default(false)
  deceasedAge         String?
  note                String?
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  patient    Patient                @relation(fields: [patientId], references: [id], onDelete: Cascade)
  conditions FamilyHistoryCondition[]

  @@index([patientId])
  @@map("family_histories")
}

model FamilyHistoryCondition {
  id               String  @id @default(cuid())
  familyHistoryId  String
  name             String
  outcome          String?
  onsetAge         String?
  contributedToDeath Boolean @default(false)
  codingSystem     String?
  codingCode       String?
  codingDisplay    String?
  note             String?

  familyHistory FamilyHistory @relation(fields: [familyHistoryId], references: [id], onDelete: Cascade)

  @@index([familyHistoryId])
  @@map("family_history_conditions")
}

model Vital {
  id                String   @id @default(cuid())
  patientId         String
  encounterId       String?
  name              String
  loincCode         String   @default("")
  loincDisplay      String   @default("")
  status            String   @default("final") // registered, preliminary, final, amended, cancelled
  effectiveDateTime String
  value             Float?
  unit              String?
  systolic          Float?
  diastolic         Float?
  note              String?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  patient   Patient    @relation(fields: [patientId], references: [id], onDelete: Cascade)
  encounter Encounter? @relation(fields: [encounterId], references: [id], onDelete: SetNull)

  @@index([patientId])
  @@index([encounterId])
  @@map("vitals")
}

model SocialHistory {
  id                String   @id @default(cuid())
  patientId         String
  name              String
  status            String   @default("final")
  value             String   @default("")
  effectiveDate     String   @default("")
  codingSystem      String?
  codingCode        String?
  codingDisplay     String?
  valueCodingSystem String?
  valueCodingCode   String?
  valueCodingDisplay String?
  note              String?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  patient Patient @relation(fields: [patientId], references: [id], onDelete: Cascade)

  @@index([patientId])
  @@map("social_histories")
}

model LabOrder {
  id           String   @id @default(cuid())
  patientId    String
  testName     String
  loincCode    String   @default("")
  loincDisplay String   @default("")
  status       String   @default("draft") // draft, active, completed, revoked
  priority     String   @default("routine") // routine, urgent, asap, stat
  authoredOn   String?
  note         String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  patient Patient @relation(fields: [patientId], references: [id], onDelete: Cascade)

  @@index([patientId])
  @@map("lab_orders")
}

model ImagingOrder {
  id           String   @id @default(cuid())
  patientId    String
  studyName    String
  loincCode    String   @default("")
  loincDisplay String   @default("")
  status       String   @default("draft")
  priority     String   @default("routine")
  authoredOn   String?
  note         String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  patient Patient @relation(fields: [patientId], references: [id], onDelete: Cascade)

  @@index([patientId])
  @@map("imaging_orders")
}

model Referral {
  id           String   @id @default(cuid())
  patientId    String
  referralType String
  status       String   @default("draft") // draft, active, completed, revoked
  priority     String   @default("routine")
  referredTo   String?
  reason       String?
  authoredOn   String?
  note         String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  patient Patient @relation(fields: [patientId], references: [id], onDelete: Cascade)

  @@index([patientId])
  @@map("referrals")
}

model Goal {
  id              String   @id @default(cuid())
  patientId       String
  name            String
  lifecycleStatus String   @default("proposed")
  expressedBy     String?
  startDate       String?
  codingSystem    String?
  codingCode      String?
  codingDisplay   String?
  note            String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  patient Patient @relation(fields: [patientId], references: [id], onDelete: Cascade)

  @@index([patientId])
  @@map("goals")
}

model CareTeamMember {
  id            String   @id @default(cuid())
  patientId     String
  name          String
  role          String   @default("")
  status        String   @default("active")
  pcpUserId     String?
  codingSystem  String?
  codingCode    String?
  codingDisplay String?
  note          String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  patient Patient @relation(fields: [patientId], references: [id], onDelete: Cascade)

  @@index([patientId])
  @@map("care_team_members")
}

model Task {
  id          String   @id @default(cuid())
  patientId   String
  encounterId String?
  status      String   @default("requested") // requested, in-progress, completed, cancelled
  intent      String   @default("order")
  priority    String   @default("routine")
  description String
  dueDate     String?
  authoredOn  String   @default("")
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  patient   Patient    @relation(fields: [patientId], references: [id], onDelete: Cascade)
  encounter Encounter? @relation(fields: [encounterId], references: [id], onDelete: SetNull)

  @@index([patientId])
  @@index([encounterId])
  @@map("tasks")
}

model Appointment {
  id              String   @id @default(cuid())
  patientId       String?
  status          String   @default("proposed")
  description     String   @default("")
  start           String
  end             String
  appointmentType String   @default("patient-visit")
  patientName     String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  patient Patient? @relation(fields: [patientId], references: [id], onDelete: Cascade)

  @@index([patientId])
  @@map("appointments")
}

model Thread {
  id         String   @id @default(cuid())
  patientId  String
  topic      String   @default("")
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  patient  Patient  @relation(fields: [patientId], references: [id], onDelete: Cascade)
  messages Message[]

  @@index([patientId])
  @@map("threads")
}

model Message {
  id         String   @id @default(cuid())
  threadId   String
  senderType String   @default("provider") // patient, provider
  senderRef  String   @default("")
  text       String
  sentAt     String
  receivedAt String?
  status     String   @default("completed")
  createdAt  DateTime @default(now())

  thread Thread @relation(fields: [threadId], references: [id], onDelete: Cascade)

  @@index([threadId])
  @@map("messages")
}

model Tab {
  id              String   @id @default(cuid())
  patientId       String
  name            String
  content         String   @default("")
  parentId        String?
  isSubtab        Boolean  @default(false)
  starred         Boolean  @default(false)
  isVisit         Boolean  @default(false)
  isTask          Boolean  @default(false)
  visitDate       String?
  section         String   @default("pages") // pages, encounters, tasks
  dividerPosition Float?
  encounterId     String?
  taskId          String?
  isSigned        Boolean  @default(false)
  signedAt        String?
  signedBy        String?
  signedById      String?
  sortOrder       Int      @default(0)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  patient Patient @relation(fields: [patientId], references: [id], onDelete: Cascade)

  @@index([patientId])
  @@map("tabs")
}

model Catalog {
  id            String   @id @default(cuid())
  category      String   // lab, imaging, medication, procedure, referral, condition, allergy
  name          String   // Human-readable name (e.g., "Complete Blood Count")
  code          String   // Standard code (LOINC, RxNorm, SNOMED, ICD-10)
  codeSystem    String   // System URL or abbreviation
  displayName   String   // Canonical display text
  aliases       String[] // Alternative names for AI matching (e.g., ["CBC", "blood count"])
  isActive      Boolean  @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@unique([category, code, codeSystem])
  @@index([category])
  @@index([name])
  @@map("catalog")
}
```

### Success Criteria:

#### Automated Verification:
- [ ] `npx prisma generate --schema=prisma/clinical/schema.prisma` succeeds
- [ ] `npx prisma migrate dev --schema=prisma/clinical/schema.prisma` creates all tables
- [ ] TypeScript compiles: `npm run typecheck`
- [ ] `npx prisma db push --schema=prisma/clinical/schema.prisma` works on a fresh database

#### Manual Verification:
- [ ] Connect to clinical DB and verify all 21 tables exist with correct columns
- [ ] Insert a test patient and verify cascade deletes work

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 3.

---

## Phase 3: Clinical API Routes

### Overview
Create new `app/api/clinical/*/route.ts` endpoints that perform direct Prisma CRUD against the clinical database. These return app types directly — no FHIR mapping needed.

### Changes Required:

#### Route inventory (19 route files)

Each clinical API route mirrors the corresponding FHIR route's HTTP methods but uses `prismaClinical` instead of `phenomlClient`. Response shapes match what the service layer expects after FHIR→App mapping.

| Route | Methods | Prisma Model | Notes |
|---|---|---|---|
| `app/api/clinical/patient/route.ts` | GET, POST, PUT, DELETE | `Patient` | DELETE cascades via Prisma `onDelete: Cascade` + auth DB cleanup |
| `app/api/clinical/encounter/route.ts` | GET, POST, PUT | `Encounter` | No separate clinical-impression — noteText stored on Encounter directly |
| `app/api/clinical/medication/route.ts` | GET, POST, PUT | `Medication` | |
| `app/api/clinical/allergy/route.ts` | GET, POST, PUT, DELETE | `Allergy` | |
| `app/api/clinical/condition/route.ts` | GET, POST, PUT, DELETE | `Condition` | |
| `app/api/clinical/procedure/route.ts` | GET, POST, PUT, DELETE | `Procedure` | |
| `app/api/clinical/family-history/route.ts` | GET, POST, PUT, DELETE | `FamilyHistory` + `FamilyHistoryCondition` | Nested create/update for conditions |
| `app/api/clinical/vital/route.ts` | GET, POST, PUT | `Vital` | Sort by `effectiveDateTime` DESC |
| `app/api/clinical/social-history/route.ts` | GET, POST, PUT, DELETE | `SocialHistory` | |
| `app/api/clinical/lab/route.ts` | GET, POST, PUT | `LabOrder` | |
| `app/api/clinical/imaging/route.ts` | GET, POST, PUT | `ImagingOrder` | |
| `app/api/clinical/referral/route.ts` | GET, POST, PUT | `Referral` | |
| `app/api/clinical/goal/route.ts` | GET, POST, PUT, DELETE | `Goal` | |
| `app/api/clinical/care-team/route.ts` | GET, POST, PUT, DELETE | `CareTeamMember` | |
| `app/api/clinical/task/route.ts` | GET, POST, PUT | `Task` | |
| `app/api/clinical/appointment/route.ts` | GET, POST, PUT, DELETE | `Appointment` | Date range filtering via `gte`/`lte` on `start` |
| `app/api/clinical/communication/route.ts` | GET, POST | `Thread` + `Message` | GET returns threads with nested messages |
| `app/api/clinical/catalog/route.ts` | GET | `Catalog` | Search by category + text (name/aliases) — replaces `construe/semantic` |
| `app/api/clinical/clone/route.ts` | POST | Multiple | Patient duplication via Prisma — replaces `fhir-clone-service.ts` direct SDK calls |

#### Pattern for each route

Every clinical route follows this pattern:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { prismaClinical } from "@/lib/prisma-clinical";

export async function GET(request: NextRequest) {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const patientId = request.nextUrl.searchParams.get("patient");
  if (!patientId) return NextResponse.json({ error: "Missing patient" }, { status: 400 });

  const items = await prismaClinical.medication.findMany({
    where: { patientId },
    orderBy: { createdAt: "desc" },
  });

  // Return app-type-shaped response directly
  return NextResponse.json({ items, total: items.length });
}

export async function POST(request: NextRequest) {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const item = await prismaClinical.medication.create({ data: body });

  return NextResponse.json({ success: true, id: item.id });
}

export async function PUT(request: NextRequest) {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { id, ...data } = body;
  await prismaClinical.medication.update({ where: { id }, data });

  return NextResponse.json({ success: true });
}
```

#### Catalog search route (replaces construe/semantic)

```typescript
// app/api/clinical/catalog/route.ts
export async function GET(request: NextRequest) {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const text = request.nextUrl.searchParams.get("text");
  const category = request.nextUrl.searchParams.get("category");
  const limit = parseInt(request.nextUrl.searchParams.get("limit") || "10");

  if (!text) return NextResponse.json({ error: "Missing text" }, { status: 400 });

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
  });

  // Shape to match what services expect from construe
  const codes = items.map((item) => ({
    code: item.code,
    system: item.codeSystem,
    display: item.displayName,
  }));

  return NextResponse.json({ codes });
}
```

#### Clone route (replaces fhir-clone-service direct SDK calls)

```typescript
// app/api/clinical/clone/route.ts
export async function POST(request: NextRequest) {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { sourcePatientId, newName, newDob } = await request.json();

  // Copy patient
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
  });

  if (!source) return NextResponse.json({ error: "Patient not found" }, { status: 404 });

  // Create new patient with cloned data using nested creates
  // (implementation details per resource type)

  return NextResponse.json({ success: true, newPatientId: newPatient.id, clonedCounts: { ... } });
}
```

### Success Criteria:

#### Automated Verification:
- [ ] All 19 clinical route files compile: `npm run typecheck`
- [ ] Basic integration test: POST a patient, GET it back, PUT an update, verify changes
- [ ] Catalog search returns results for seeded test data

#### Manual Verification:
- [ ] Use Postman/curl to hit each clinical endpoint and verify CRUD works
- [ ] Clone endpoint duplicates a patient with all related resources

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 4.

---

## Phase 4: Service Layer Toggle

### Overview
Refactor the 18 service files in `lib/services/` to route requests to either `/api/fhir/*` or `/api/clinical/*` based on the `EMR_BACKEND` setting. The toggle is checked client-side via a shared helper.

### Changes Required:

#### 1. Client-side backend detection
**File**: `lib/emr-backend.ts` (update)
**Changes**: Add a client-safe function that reads the backend from an env var exposed via `next.config.ts`.

```typescript
// Add to existing file:

// Client-side: reads from NEXT_PUBLIC_EMR_BACKEND
export function getEmrBackendClient(): EmrBackend {
  const backend = (typeof window !== "undefined"
    ? process.env.NEXT_PUBLIC_EMR_BACKEND
    : process.env.EMR_BACKEND
  )?.toLowerCase();
  if (backend === "local") return "local";
  return "medplum";
}

export function isLocalBackendClient(): boolean {
  return getEmrBackendClient() === "local";
}
```

**File**: `next.config.ts` (update)
**Changes**: Expose `EMR_BACKEND` as `NEXT_PUBLIC_EMR_BACKEND`.

```typescript
// Add to env section:
env: {
  NEXT_PUBLIC_EMR_BACKEND: process.env.EMR_BACKEND || "medplum",
},
```

#### 2. Service layer refactoring pattern

Each service file needs minimal changes. The core pattern:

**Before** (e.g., `fhir-medication-service.ts`):
```typescript
export async function searchFhirMedications(patientFhirId: string): Promise<MedicationSearchResult> {
  const response = await fetch(`/api/fhir/medication?patient=${patientFhirId}`);
  // ... FHIR bundle mapping ...
}
```

**After**:
```typescript
import { isLocalBackendClient } from "@/lib/emr-backend";

export async function searchMedications(patientId: string): Promise<MedicationSearchResult> {
  if (isLocalBackendClient()) {
    const response = await fetch(`/api/clinical/medication?patient=${patientId}`);
    if (!response.ok) return { medications: [], total: 0, error: `Error: ${response.status}` };
    const data = await response.json();
    return { medications: data.items, total: data.total };
  }

  // Existing Medplum path (unchanged)
  const response = await fetch(`/api/fhir/medication?patient=${patientId}`);
  // ... FHIR bundle mapping ...
}
```

#### 3. Service-by-service changes

Each of the 18 FHIR service files follows the same refactoring pattern. Key differences per service:

| Service | Search result key | Create result ID key | Special handling |
|---|---|---|---|
| `fhir-patient-service.ts` | `patients` | `fhirId` → `id` | `PatientData` includes `tabs` — fetch separately or include in response |
| `fhir-encounter-service.ts` | `encounters` | `encounterFhirId` → `id` | No separate clinical-impression call in local mode |
| `fhir-medication-service.ts` | `medications` | `fhirId` → `id` | `parseMedicationText` — local mode skips lang2fhir |
| `fhir-allergy-service.ts` | `allergies` | `allergyFhirId` → `id` | `searchAllergyCodes` → calls `/api/clinical/catalog?category=allergy` |
| `fhir-condition-service.ts` | `conditions` | `conditionFhirId` → `id` | `searchDiagnosisCodes` → calls `/api/clinical/catalog?category=condition` |
| `fhir-procedure-service.ts` | `procedures` | `procedureFhirId` → `id` | `searchProcedureCodes` → calls `/api/clinical/catalog` |
| `fhir-family-history-service.ts` | `members` | `fhirId` → `id` | Nested conditions handled by API route |
| `fhir-vital-service.ts` | `vitals` | `fhirId` → `id` | |
| `fhir-social-history-service.ts` | `observations` | `observationFhirId` → `id` | `searchSocialHistoryCodes` → catalog |
| `fhir-lab-service.ts` | `labOrders` | `fhirId` → `id` | `resolveLabCodes` → catalog |
| `fhir-imaging-service.ts` | `imagingOrders` | `fhirId` → `id` | `resolveImagingCodes` → catalog |
| `fhir-referral-service.ts` | `referrals` | `fhirId` → `id` | `parseReferralText` — local mode skips lang2fhir |
| `fhir-goal-service.ts` | `goals` | `goalFhirId` → `id` | `searchGoalCodes` → catalog |
| `fhir-care-team-service.ts` | `members` | `careTeamFhirId` → `id` | `searchSpecialtyCodes` → catalog |
| `fhir-task-service.ts` | `tasks` | `fhirId` → `id` | |
| `fhir-appointment-service.ts` | `appointments` | `fhirId` → `id` | Date range query params differ |
| `fhir-communication-service.ts` | `threads` | `threadId` → `id` | Thread+message structure returned directly |
| `fhir-clone-service.ts` | N/A | N/A | Local mode calls `/api/clinical/clone` instead of direct SDK |

#### 4. Code resolution functions (construe/semantic replacement)

Services that use `construe/semantic` for code resolution need their `batch*` and `search*Codes` functions to call the catalog API in local mode:

```typescript
// Example pattern for searchDiagnosisCodes in fhir-condition-service.ts
export async function searchDiagnosisCodes(text: string): Promise<DiagnosisCodeSearchResult> {
  if (isLocalBackendClient()) {
    const response = await fetch(`/api/clinical/catalog?category=condition&text=${encodeURIComponent(text)}&limit=5`);
    if (!response.ok) return { codes: [], error: `Error: ${response.status}` };
    const data = await response.json();
    return { codes: data.codes };
  }

  // Existing construe path
  const response = await fetch(`/api/fhir/construe/semantic?codesystem=ICD10CM&text=${encodeURIComponent(text)}&limit=5`);
  // ...
}
```

#### 5. NLP parsing functions (lang2fhir replacement)

`parseMedicationText` and `parseReferralText` currently call `/api/fhir/lang2fhir`. In local mode, these can either:
- Return `null` (skip NLP parsing — user enters structured data directly)
- Call a future AI endpoint for local resolution

For now, return `null` in local mode and let the UI handle structured input:

```typescript
export async function parseMedicationText(text: string): Promise<MedicationParseResult> {
  if (isLocalBackendClient()) {
    return { resource: null }; // NLP parsing not available in local mode yet
  }
  // Existing lang2fhir path
  // ...
}
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles: `npm run typecheck`
- [ ] All existing tests pass
- [ ] Service functions return correct types in both modes

#### Manual Verification:
- [ ] With `EMR_BACKEND=local`: Create a patient, add medications/conditions/etc., view them in the UI
- [ ] With `EMR_BACKEND=medplum`: All existing functionality works unchanged
- [ ] Code resolution (e.g., searching for "CBC" in lab orders) returns catalog results in local mode

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 5.

---

## Phase 5: Cross-Cutting Updates — XPC-ID, Auth, AI Assistant, Case Library

### Overview
Replace FHIR ID references in the auth DB schema, update the session token, update the AI assistant and case library to work with local DB, and update `variable-formatters.ts`.

### Changes Required:

#### 1. Auth DB schema changes
**File**: `prisma/schema.prisma`
**Changes**:

```prisma
model User {
  // ...existing fields...
  fhirPractitionerId String?  // Keep for medplum mode
  xpcId              String?  // New — local mode practitioner ID
  // ...
}

model UserPatient {
  // ...existing fields...
  patientFhirId         String   // Keep for medplum mode
  patientLocalId        String?  // New — local mode patient ID (FK to clinical DB)
  encounterFhirId       String?  // Keep for medplum mode
  encounterLocalId      String?  // New — local mode encounter ID
  sourceEncounterFhirId String?
  sourcePatientFhirId   String?
  sourcePatientLocalId  String?  // New
  // ...

  // Update unique constraint to handle both modes
  @@unique([userId, patientFhirId])
  @@unique([userId, patientLocalId])
}

model PatientTag {
  // ...existing fields...
  patientFhirId  String   // Keep for medplum mode
  patientLocalId String?  // New — local mode patient ID
  // ...

  @@unique([patientFhirId, category, value])
  @@unique([patientLocalId, category, value])
}
```

**Design note**: Keep both `patientFhirId` and `patientLocalId` columns rather than renaming. This allows both modes to coexist in the same auth DB without data loss during toggle. Service/API code checks which field to use based on `EMR_BACKEND`.

#### 2. Auth session updates
**File**: `auth.ts`
**Changes**: Thread `xpcId` through JWT callbacks alongside `fhirPractitionerId`. The session carries whichever ID is relevant for the active backend.

```typescript
// In JWT callback:
if (isLocalBackend()) {
  token.xpcId = dbUser.xpcId;
} else {
  token.fhirPractitionerId = dbUser.fhirPractitionerId;
}

// In session callback:
if (isLocalBackend()) {
  session.user.xpcId = token.xpcId;
} else {
  session.user.fhirPractitionerId = token.fhirPractitionerId;
}
```

#### 3. Helper for patient ID field
**File**: `lib/patient-id.ts` (new)
**Changes**: Utility to abstract over `patientFhirId` vs `patientLocalId`.

```typescript
import { isLocalBackend } from "@/lib/emr-backend";

export function getPatientIdField(): "patientLocalId" | "patientFhirId" {
  return isLocalBackend() ? "patientLocalId" : "patientFhirId";
}

export function getPatientIdValue(patient: { fhirId?: string; id?: string }): string {
  return isLocalBackend() ? patient.id! : patient.fhirId!;
}
```

#### 4. Variable formatters
**File**: `lib/variable-formatters.ts`
**Changes**: `buildPatientVariables` currently fires 15 parallel FHIR service calls. In local mode, use the refactored service functions (which now call clinical API).

No code changes needed here if service functions were properly toggled in Phase 4 — the variable formatter calls service functions which already handle the toggle. Just verify the function names haven't changed.

#### 5. AI assistant
**File**: `app/api/ai-assistant/chat/route.ts`
**Changes**: Replace the 17 `phenomlClient.fhir.search` calls in `fetchPatientContext()` with calls that work in both modes.

```typescript
import { isLocalBackend } from "@/lib/emr-backend";
import { prismaClinical } from "@/lib/prisma-clinical";

async function fetchPatientContext(patientId: string) {
  if (isLocalBackend()) {
    // Single Prisma query with includes — replaces 17 HTTP calls
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
        referrals: true,
        tasks: true,
        appointments: true,
        threads: { include: { messages: true } },
        careTeamMembers: true,
        goals: true,
        imagingOrders: true,
      },
    });

    return patient; // Already in app-type shape
  }

  // Existing 17-query Medplum path (unchanged)
  // ...
}
```

#### 6. Case library
**File**: `app/api/case-library/route.ts`
**Changes**: The `fetchPatientEncounters` and `fetchPatientInfo` helpers currently call `phenomlClient` directly. In local mode, use Prisma:

```typescript
import { isLocalBackend } from "@/lib/emr-backend";

async function fetchPatientEncounters(patientId: string) {
  if (isLocalBackend()) {
    return prismaClinical.encounter.findMany({
      where: { patientId },
      orderBy: { date: "desc" },
    });
  }
  // Existing phenomlClient path...
}

async function fetchPatientInfo(patientId: string) {
  if (isLocalBackend()) {
    return prismaClinical.patient.findUnique({ where: { id: patientId } });
  }
  // Existing phenomlClient path...
}
```

Also update the `view` handlers to use `patientLocalId` or `patientFhirId` based on backend.

### Success Criteria:

#### Automated Verification:
- [ ] Auth DB migration applies: `npx prisma migrate dev`
- [ ] TypeScript compiles: `npm run typecheck`
- [ ] All tests pass

#### Manual Verification:
- [ ] Sign in with `EMR_BACKEND=local` — session works, user profile loads
- [ ] AI assistant responds using local DB context in local mode
- [ ] Case library shows patients and encounters in local mode
- [ ] Variable formatter populates template variables in local mode

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 6.

---

## Phase 6: UI Cleanup

### Overview
Rename Medplum-specific references in UI components and clean up any remaining FHIR-specific naming in user-facing code.

### Changes Required:

#### 1. Rename handler functions
**Files**: ~20+ components in `components/patient/` and `components/panels/`
**Changes**: Rename `handleSaveToMedplum` → `handleSave`, `handleSyncToMedplum` → `handleSync`, etc.

This is a straightforward find-and-replace across all component files:
- `handleSaveToMedplum` → `handleSave`
- `handleSyncToMedplum` → `handleSync`
- `saveToMedplum` → `save` (if used as prop names)
- `syncToMedplum` → `sync` (if used as prop names)

#### 2. Rename service function calls (optional, for clarity)
**Files**: All service files
**Changes**: Optionally rename exported functions to drop `Fhir` prefix:
- `searchFhirMedications` → `searchMedications`
- `createFhirMedication` → `createMedication`
- etc.

This is cosmetic and can be done incrementally. The toggle logic added in Phase 4 already handles routing.

#### 3. Update `Patient` type references
**Files**: Components that reference `patient.fhirId`
**Changes**: In local mode, components should use `patient.id` instead of `patient.fhirId`. The `Patient` type already has both fields. Components should use a helper:

```typescript
import { getPatientIdValue } from "@/lib/patient-id";

// Instead of: patient.fhirId
// Use: getPatientIdValue(patient)
```

#### 4. Clean up UI text
**Files**: Various UI components
**Changes**: Remove any user-visible "Medplum" or "FHIR" text. Change to generic "EMR" or "backend" terminology where applicable.

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles: `npm run typecheck`
- [ ] Linting passes
- [ ] All tests pass
- [ ] No remaining references to `handleSaveToMedplum` in component files

#### Manual Verification:
- [ ] Full walkthrough in local mode: create patient → add clinical data → create encounter → sign encounter → view in case library
- [ ] Full walkthrough in medplum mode: same flow, verify nothing broke
- [ ] Toggle between modes (requires restart) — both work independently

**Implementation Note**: This is the final phase. After completion, the EMR backend abstraction is complete.

---

## Testing Strategy

### Unit Tests:
- Each clinical API route: test CRUD operations with mocked Prisma
- Service layer toggle: test that correct endpoint is called based on `EMR_BACKEND`
- `getEmrBackend()` / `isLocalBackend()` utility functions
- Catalog search: test text matching logic

### Integration Tests:
- End-to-end flow in local mode: patient creation → clinical data CRUD → encounter lifecycle
- Patient clone in local mode
- AI assistant context fetch in local mode
- Case library aggregation in local mode

### Manual Testing Steps:
1. Start app with `EMR_BACKEND=local`, create a patient, add all types of clinical data
2. Create and sign an encounter
3. Test AI assistant with local patient data
4. Test case library views
5. Duplicate a patient
6. Switch to `EMR_BACKEND=medplum`, verify existing Medplum flow still works
7. Verify no PhenoML env var crashes when in local mode

## Performance Considerations

- **Local mode is faster**: No HTTP round-trips to external API, no FHIR bundle wrapping/unwrapping
- **AI assistant context**: Single Prisma query with `include` replaces 17 HTTP requests
- **Patient clone**: Single transaction replaces sequential FHIR creates
- **No rate limiting**: Local DB has no external throttling
- **Connection pooling**: Use Prisma's built-in connection pool for clinical DB

## Migration Notes

- **No data migration needed**: Starting fresh with empty clinical DB
- **Auth DB migration**: Add `xpcId`, `patientLocalId`, `encounterLocalId` columns (nullable, non-breaking)
- **Catalog seeding**: Need a seed script for common lab/imaging/medication codes (LOINC, RxNorm, SNOMED, ICD-10)
- **Rollback**: Set `EMR_BACKEND=medplum` to revert to Medplum at any time

## References

- Research: [docs/ai/research/2026-03-08-emr-backend-abstraction.md](docs/ai/research/2026-03-08-emr-backend-abstraction.md)
- Current Prisma schema: [prisma/schema.prisma](prisma/schema.prisma)
- PhenoML client: [lib/phenoml/client.ts](lib/phenoml/client.ts)
- App types: [lib/types/](lib/types/)
- FHIR mapper: [lib/phenoml/fhir-mapper.ts](lib/phenoml/fhir-mapper.ts)
- Service layer: [lib/services/](lib/services/)
- FHIR API routes: [app/api/fhir/](app/api/fhir/)
