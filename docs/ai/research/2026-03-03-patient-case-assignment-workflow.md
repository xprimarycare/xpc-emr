---
date: "2026-03-03T19:48:11+0000"
git_commit: a9dc63b5b0e917ca0a833acd70d5cb97fa3e0b7f
branch: patient-case-library
repository: pineapplej
topic: "Patient Case Assignment Workflow - Admin assigns patients to clinicians"
tags: [research, codebase, case-library, assignment, admin, user-patient, queue, duplication]
status: complete
last_updated: "2026-03-03"
last_updated_by: claude
last_updated_note: "Finalized all requirements from Round 2 clarifying questions"
---

# Research: Patient Case Assignment Workflow

**Date**: 2026-03-03T19:48:11+0000
**Git Commit**: a9dc63b5b0e917ca0a833acd70d5cb97fa3e0b7f
**Branch**: patient-case-library
**Repository**: pineapplej

## Research Question

As admin, I want to assign patients to clinicians. Workflow: patient case gets created, added to a library, patient appears in the clinician's queue/roster. The original patient case stays in its original state so it can be assigned to new clinicians or bulk-assigned (e.g., assign patient XYZ to clinicians A, B, C). Also need to duplicate a patient and build modifications to the original case.

## Summary

The application uses a dual-storage architecture: PostgreSQL (Prisma) for user identity and user-to-patient assignment records, and Medplum (FHIR R4 server) for all clinical data. The `UserPatient` join table is the sole database record linking users to patients. Currently, assignment only happens as a side effect of signing an encounter — there is no admin-initiated assignment UI, no bulk assignment, no patient duplication, and no queue/inbox distinction for unworked cases.

## User Requirements (from clarifying questions)

### Round 1
1. **Assignment model**: Clone encounter data — each clinician gets an independent copy of the encounter to work on
2. **Duplication model**: Full FHIR clone — create a new Patient resource in Medplum with copied demographics, conditions, medications, etc.
3. **UI location**: Both — quick assign in CaseLibraryPanel + dedicated /admin/assignments page for bulk operations
4. **Queue UX**: Tabs for states — "Waiting Room | In Progress | Completed" within the clinician's case library view

### Round 2
5. **Encounter clone content**: Configurable per assignment — admin chooses at assignment time whether to include the original note text or assign a blank encounter
6. **Patient clone scope**: Admin picks resources — show checkboxes letting the admin choose which FHIR resource types to include in the clone (Patient demographics, Conditions, Medications, Allergies, Care Team, Family History, Social History, Vitals, Labs)
7. **Bulk assignment direction**: Both directions — assign one patient to many clinicians, or many patients to one clinician
8. **Status trigger**: Clinician opens case — automatically moves from "Waiting Room" to "In Progress" when the clinician first opens/views the assigned case

## Detailed Findings

### Current Architecture

#### Dual Storage Model
- **PostgreSQL (Prisma)**: `User`, `Account`, `UserPatient` tables
- **Medplum (FHIR server)**: All clinical data — Patient, Encounter, ClinicalImpression, Condition, MedicationRequest, CareTeam, Allergy, etc.
- File: `prisma/schema.prisma`

#### UserPatient Table (The Assignment Record)
```prisma
model UserPatient {
  id            String   @id @default(cuid())
  userId        String
  patientFhirId String
  assignedAt    DateTime @default(now())
  user          User     @relation(...)
  @@unique([userId, patientFhirId])
  @@map("user_patients")
}
```
- Links local `userId` to external FHIR `patientFhirId`
- Unique constraint prevents duplicate assignments
- No status field (no concept of "waiting room" vs "in progress" vs "completed")
- File: `prisma/schema.prisma:51-61`

#### User & Role System
- Roles: `"user"` (displayed as "Clinician") and `"admin"`
- Role stored on `User.role` (String, default `"user"`)
- JWT-based sessions via NextAuth v5 with Google OAuth
- Admin page at `/admin` with `UserManagement` component for role changes
- Files: `auth.ts`, `auth.config.ts`, `app/admin/page.tsx`, `app/admin/UserManagement.tsx`

### Current Case Library System

#### CaseLibraryPanel Component
- Located at: `components/panels/CaseLibraryPanel.tsx`
- Opens via BookOpen icon in TopBar
- Uses a discriminated union for navigation state (`users` → `user-patients` → `patient-encounters` → `recent-activity`)
- Admins see: Users list → User's patients → Patient's signed encounters; also a "Recent" tab
- Clinicians see: My patients → Patient's signed encounters
- File: `components/panels/CaseLibraryPanel.tsx`

#### Case Library API Route
- Endpoint: `GET /api/case-library?view=...`
- Four views: `users` (admin), `user-patients`, `patient-encounters`, `recent-activity` (admin)
- Fetches FHIR data via `phenomlClient.fhir.search()` and combines with Prisma UserPatient records
- File: `app/api/case-library/route.ts`

#### How Cases Currently Get Created
1. Clinician signs an encounter note via `EncounterMetadataBar`
2. Signing writes `isSigned: true` + metadata to FHIR Encounter extension
3. After successful FHIR write, fires `POST /api/user/patients { patientFhirId }` (fire-and-forget)
4. This creates a `UserPatient` row via Prisma upsert
5. The patient now appears in the clinician's case library
- File: `components/patient/EncounterMetadataBar.tsx:182-187`

#### Patient Assignment API
- `POST /api/user/patients`: Creates UserPatient record; supports `userId` param to assign to another user
- `GET /api/user/patients`: Returns current user's assigned patient IDs
- `DELETE /api/user/patients`: Removes a UserPatient record
- File: `app/api/user/patients/route.ts`

### Encounter Data Model

#### AppEncounter Type
```typescript
interface AppEncounter {
  id: string;                 // "enc-{fhirId}"
  encounterFhirId?: string;
  noteFhirId?: string;
  status: "planned" | "in-progress" | "finished" | "cancelled";
  classCode: "AMB" | "IMP" | "EMER" | "VR" | "HH";
  classDisplay: string;
  date: string;
  noteText: string;
  patientFhirId: string;
  isSigned?: boolean;
  signedAt?: string;
  signedBy?: string;
  signedById?: string;
}
```
- Two FHIR resources per encounter: `Encounter` (metadata + signing extension) + `ClinicalImpression` (note text)
- Signing state stored as custom FHIR extension: `http://phenoml.com/fhir/StructureDefinition/encounter-signature`
- File: `lib/types/encounter.ts`

### FHIR Mapper
- Central file: `lib/phenoml/fhir-mapper.ts`
- `mapFhirBundleToEncounters()` joins Encounter + ClinicalImpression bundles (line 823)
- `mapFhirPatientToAppPatient()` converts FHIR Patient to app type (line 66)
- `mapAppEncounterToFhirEncounter()` converts app encounter back to FHIR (line 715)

### Patient Data Flow
1. Patients fetched from Medplum via `/api/fhir/patient`
2. Mapped to `PatientData` type with default tabs via `createDefaultTabs()`
3. Added to React context (`PatientContext`) — no local DB persistence for clinical data
4. Encounters fetched separately and displayed in tabs
- Files: `lib/services/fhir-patient-service.ts`, `lib/context/PatientContext.tsx`, `lib/data/default-tabs.ts`

### UI Component Map

#### Pages
- `/` — Main clinical workspace (`app/page.tsx`)
- `/login` — Login
- `/onboarding` — New user onboarding
- `/account` — User account settings
- `/admin` — Team management (admin only)

#### Panels (Right sidebar)
- `CaseLibraryPanel`, `PatientListPanel`, `AIPanel`, `ChatPanel`, `CalendarPanel`, `ChartReviewPanel`, `OrdersPanel`, `TemplatesPanel`, `VariablesPanel`, `LabPreview`, `MedicationPreview`, `ReferralPreview`

#### State Management
- React Context only (no Zustand): `PatientContext`, `SidebarContext`, `EditorContext`, `AuthContext`

## Code References

- `prisma/schema.prisma:51-61` — UserPatient model definition
- `app/api/case-library/route.ts` — Case library API with 4 views
- `app/api/user/patients/route.ts` — Patient assignment CRUD
- `components/panels/CaseLibraryPanel.tsx` — Case library panel UI
- `components/patient/EncounterMetadataBar.tsx:149-193` — Sign/unsign flow + auto-assignment
- `lib/types/encounter.ts` — AppEncounter type definition
- `lib/phenoml/fhir-mapper.ts:715-795` — FHIR encounter/signing mapper
- `lib/services/fhir-encounter-service.ts` — FHIR encounter CRUD service
- `lib/services/fhir-patient-service.ts` — FHIR patient fetch/create service
- `lib/context/PatientContext.tsx` — Patient state management
- `auth.ts` — NextAuth config with role in JWT
- `app/admin/page.tsx` — Admin page (role guard)
- `app/admin/UserManagement.tsx` — User role management UI

## Architecture Documentation

### What Needs to Be Built

Based on all finalized requirements:

#### 1. Assignment with configurable encounter cloning
- Admin assigns patient X to clinician(s) A, B, C
- At assignment time, admin chooses: "Include note text" or "Blank encounter"
- For each clinician: create a `UserPatient` record (status: `waiting_room`) + clone the FHIR Encounter and ClinicalImpression (with or without note text based on admin's choice)
- The cloned encounter is unsigned and belongs to the assigned clinician
- Original patient and encounters remain untouched for future assignments

#### 2. Full patient duplication with selectable resources
- Admin selects a patient and clicks "Duplicate"
- Checklist UI lets admin pick which FHIR resources to clone: Patient demographics, Conditions, Medications, Allergies, Care Team, Family History, Social History, Vitals, Labs
- Creates a new FHIR Patient resource in Medplum with selected data copied
- The duplicate is fully independent — edits don't affect the original
- Track lineage: store `sourcePatientFhirId` on the assignment record

#### 3. Dual assignment UI
- **CaseLibraryPanel** (quick assign): "Assign" button on patient rows in admin view, opens a clinician picker dialog with multi-select + clone options
- **`/admin/assignments` page** (bulk operations): Full table view with:
  - Assign one patient → many clinicians (select patient, check clinicians)
  - Assign many patients → one clinician (check patients, select clinician)
  - Filters, search, status overview

#### 4. Clinician queue with status tabs
- Tabs: **Waiting Room** | **In Progress** | **Completed**
- "Waiting Room": Cases assigned by admin that clinician hasn't opened yet
- "In Progress": Auto-transitions when clinician first opens/views the case
- "Completed": Clinician has signed the encounter note
- Status stored on `UserPatient.status` field

### Schema Changes Needed

```prisma
model UserPatient {
  id                    String   @id @default(cuid())
  userId                String
  patientFhirId         String
  assignedAt            DateTime @default(now())
  status                String   @default("waiting_room")  // waiting_room, in_progress, completed
  assignedBy            String?  // userId of admin who made the assignment
  encounterFhirId       String?  // the cloned encounter assigned to this user
  sourceEncounterFhirId String?  // original encounter the clone was made from
  sourcePatientFhirId   String?  // if patient was duplicated, tracks the origin
  includeNoteText       Boolean  @default(true)  // whether clone included note text

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, patientFhirId])
  @@map("user_patients")
}
```

### API Changes Needed

1. **`POST /api/case-library/assign`** — Admin assigns patient to clinician(s)
   - Body: `{ patientFhirId, encounterFhirId, userIds: string[], includeNoteText: boolean }`
   - For each userId: clone encounter in FHIR, create UserPatient with status `waiting_room`

2. **`POST /api/case-library/duplicate`** — Admin duplicates a patient
   - Body: `{ patientFhirId, resourceTypes: string[] }`
   - Clones selected FHIR resources, returns new patient's FHIR ID

3. **`PATCH /api/user/patients`** — Update assignment status
   - Body: `{ patientFhirId, status }` (for auto-transition on open)

4. **Update `GET /api/case-library?view=user-patients`** — Add `status` filter param
   - `&status=waiting_room` / `in_progress` / `completed`

5. **`POST /api/case-library/bulk-assign`** — Bulk assignment
   - Body: `{ patientFhirIds: string[], userIds: string[], includeNoteText: boolean }`

## Related Research

- `docs/ai/research/2026-03-01-google-oauth-postgres-setup.md` — Auth/user system setup (tangentially related)

## Open Questions

All initial questions have been resolved through clarifying questions. Remaining considerations for implementation:

1. Should the "Completed" status be set automatically when the clinician signs their cloned encounter, or manually?
2. Should admins be able to revoke/unassign a case after assignment? What happens to the cloned encounter?
3. Rate limiting / performance: bulk assigning one patient to many clinicians triggers N FHIR clone operations — should this be queued or is synchronous acceptable?
