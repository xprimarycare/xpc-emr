---
date: 2026-03-04T02:59:16Z
git_commit: 47c78345fac3b31bb0d028c4538436012abbcbdc
branch: patient-case-library
repository: pineapplej
topic: "Clinician waiting room workflow — how assigned patients surface after sign-in"
tags: [research, codebase, case-library, patient-list, waiting-room, assignment]
status: complete
last_updated: 2026-03-04
last_updated_by: claude
---

# Research: Clinician Waiting Room Workflow

**Date**: 2026-03-04T02:59:16Z
**Git Commit**: 47c78345fac3b31bb0d028c4538436012abbcbdc
**Branch**: patient-case-library
**Repository**: pineapplej

## Research Question

What's missing is the ability to see which patients are available for me to see (as in "waiting room"). I imagine that being displayed in the left panel using the library icon. The workflow should be: I sign in, then I go to patient list and see which patients are ready to be "seen."

## Summary

Today there are **two separate left panels** for browsing patients, controlled by different TopBar icons:

1. **PatientListPanel** (`Users` icon) — Shows **all** FHIR patients from Medplum (up to 200). No awareness of assignments, statuses, or waiting room. This is a raw FHIR browser.

2. **CaseLibraryPanel** (`BookOpen` icon) — Shows **only assigned patients** for the current clinician, organized by status tabs: Waiting Room / In Progress / Completed. This is where the waiting room workflow lives.

The clinician waiting room workflow **already exists** inside the CaseLibraryPanel, but it requires clicking the `BookOpen` icon (not the `Users` icon). The `Users` icon opens an unfiltered FHIR patient list with no assignment awareness.

## Detailed Findings

### The Two Left Panels

| Dimension | PatientListPanel (Users icon) | CaseLibraryPanel (BookOpen icon) |
|---|---|---|
| **Data source** | `GET /api/fhir/patient` (all Medplum patients) | `GET /api/case-library?view=user-patients&userId=<id>` (DB assignments + FHIR enrichment) |
| **Patient scope** | All FHIR patients, up to 200 | Only patients assigned to the current user |
| **Status awareness** | None | Filters by waiting_room / in_progress / completed tabs |
| **Auto-status transition** | None | Clicking a waiting_room patient auto-advances to in_progress |
| **Width** | w-60 (240px) | w-72 (288px) |

### Panel Switching Mechanism

Three TopBar buttons control the left panel (`components/layout/TopBar.tsx:46-65`):
- `Menu` icon → `'sidebar'` (patient tab tree)
- `Users` icon → `'patientList'` (all FHIR patients)
- `BookOpen` icon → `'caseLibrary'` (assigned cases with status tabs)

Toggle logic in `lib/context/EditorContext.tsx:62-64`: clicking the active button collapses the panel to `null`; clicking a different button switches to that mode. All three panel components are mounted unconditionally in `app/page.tsx:13-15` and each returns `null` when not the active mode.

### CaseLibraryPanel — Clinician Experience (the "waiting room")

**File**: `components/panels/CaseLibraryPanel.tsx`

**Initial state for clinician** (lines 63-67):
- View: `{ type: 'user-patients', userId: user.id, userName: 'My Cases' }`
- Status tab: `CaseStatus.WAITING_ROOM` (selected by default)

**What the clinician sees**:
- Header: "My Cases" (line 536)
- Three status tabs: "Waiting Room" | "In Progress" | "Completed" (lines 347-371)
- Count badges on each tab showing number of patients in each status (lines 362-365)
- Patient list filtered to the active tab (lines 158-160)

**Data fetch**: `GET /api/case-library?view=user-patients&userId=<id>` (line 106). Returns array of `{ patientFhirId, patientName, signedEncounterCount, status, assignedBy, encounterFhirId }`. Patient names are fetched live from FHIR per request (not stored in DB).

**Status tabs** are defined at line 54:
```ts
const STATUS_TABS: CaseStatusValue[] = [CaseStatus.WAITING_ROOM, CaseStatus.IN_PROGRESS, CaseStatus.COMPLETED];
```

Filtering is done in a single-pass `useMemo` at lines 152-162 that both counts patients per status and filters the list by the active tab.

**Clicking a waiting room patient** (lines 200-219, 383-396):
1. `handlePatientClick` fires `PATCH /api/user/patients` with `{ patientFhirId, status: 'in_progress' }` (line 204-208)
2. Local state is optimistically updated (lines 210-214)
3. Navigation proceeds to `patient-encounters` view to show the patient's encounters

### PatientListPanel — No Assignment Awareness

**File**: `components/panels/PatientListPanel.tsx`

Fetches all patients from `GET /api/fhir/patient` (no filters). The `listFhirPatients()` function at `lib/services/fhir-patient-service.ts:17-54` calls the FHIR patient endpoint with `_count=200` and no user, assignment, or status filters. There is no concept of assignments, waiting room, or status in this component. Filtering is purely client-side text matching on patient names (lines 33-37).

### Assignment Creation (Admin Side)

**File**: `app/api/case-library/assign/route.ts`

Admin POSTs to `/api/case-library/assign` with `{ patientFhirId, clinicianIds[], encounterFhirId?, includeNoteText }`. For each clinician:
- If `encounterFhirId` provided: clones the Encounter + ClinicalImpressions via FHIR
- Creates/updates `UserPatient` row with `status: "waiting_room"` (line 58)

### Status Transition Rules

**File**: `app/api/user/patients/route.ts:126-129`

Only two transitions are valid:
- `waiting_room` → `in_progress` (auto on patient click)
- `in_progress` → `completed`

Enforced atomically via `prisma.userPatient.updateMany` with a `WHERE status = <required_current>` clause (lines 140-147).

### Reset on Panel Open

Each time the CaseLibraryPanel opens (lines 84-93), it resets the view back to `user-patients` for the current clinician with "Waiting Room" as the default tab. This means a clinician always lands on their waiting room when opening the BookOpen panel.

## Code References

- `components/layout/TopBar.tsx:46-65` — Three left-panel toggle buttons
- `lib/context/EditorContext.tsx:6,33,62-64` — LeftPanelMode type, initial state, toggle function
- `app/page.tsx:13-15` — All three panels mounted unconditionally
- `components/panels/PatientListPanel.tsx` — All-FHIR patient browser (no assignment awareness)
- `components/panels/CaseLibraryPanel.tsx:54,63-67,152-162,200-219,347-371` — Clinician case library with status tabs
- `app/api/case-library/route.ts:103-137` — user-patients view handler
- `app/api/case-library/assign/route.ts:38-87` — Assignment creation (admin)
- `app/api/user/patients/route.ts:106-163` — Atomic status transition (clinician)
- `lib/constants/case-status.ts` — Status constants, badges, tab labels

## Architecture Documentation

The left panel is a mutually-exclusive slot controlled by `leftPanelMode` in EditorContext. Three components (`LeftSidebar`, `PatientListPanel`, `CaseLibraryPanel`) are always mounted but self-gate their rendering based on the mode value. The `PatientListPanel` is a FHIR-only browser with no internal state persistence. The `CaseLibraryPanel` is a multi-view navigator backed by the `UserPatient` DB table, enriched with FHIR data at query time.

## Related Research

- `docs/ai/research/2026-03-03-patient-case-assignment-workflow.md` — Full assignment workflow implementation plan

## Open Questions

- The `Users` icon (`PatientListPanel`) and `BookOpen` icon (`CaseLibraryPanel`) serve overlapping but different purposes. There is currently no mechanism in `PatientListPanel` to surface assignment status or filter by "waiting room."
- There is no auto-redirect or default panel selection after login — the user must manually click the `BookOpen` icon to see their waiting room cases.
