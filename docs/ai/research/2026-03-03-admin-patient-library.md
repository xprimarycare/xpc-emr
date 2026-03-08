---
date: 2026-03-03T12:00:00-06:00
git_commit: 19fe240a649949ddeebf687601341bc6d83db25f
branch: patient-case-library
repository: patient-case-library
topic: "Admin Patient Library — Codebase Research for New Feature"
tags: [research, codebase, admin, patient-library, case-library, skill-builder-mockup]
status: complete
last_updated: 2026-03-03
last_updated_by: Claude
---

# Research: Admin Patient Library

**Date**: 2026-03-03T12:00:00-06:00
**Git Commit**: 19fe240a649949ddeebf687601341bc6d83db25f
**Branch**: patient-case-library
**Repository**: patient-case-library

## Research Question

The user wants to build a **Patient Library** page for admin users, modeled after the `skill_builder.html` mockup from an older project. The focus is on understanding:
1. What the skill_builder.html mockup contains (as a reference design)
2. What admin infrastructure already exists in the codebase
3. What patient/case models and APIs are available
4. What UI patterns exist that can be reused

Patient **Creation** will be handled in a separate project.

## Summary

The codebase is a Next.js 16 App Router application (XPC EMR) using Tailwind v4 + shadcn/ui, Prisma v7 + PostgreSQL, and a FHIR backend (Medplum via PhenoML SDK). Admin pages already exist at `/admin` (user management) and `/admin/assignments` (case assignment). Patient data is stored in FHIR; the local database tracks user-patient assignments via the `UserPatient` model. A rich set of UI patterns for tables, tabs, filters, search, and cards already exists in the codebase.

## Detailed Findings

### 1. Skill Builder Mockup Analysis (Reference Design)

The `skill_builder.html` file is a standalone HTML mockup with the following structure:

**Layout:**
- Fixed left sidebar (w-64, bg-gray-900) with navigation links
- Main content area (ml-64) with header bar and centered max-w-7xl content
- Header has user avatar + dropdown in top-right

**Two Main Tabs:**
1. **CREATE CASE** — A 3-step wizard (Create → Review → Assign) with:
   - Progress stepper bar at top
   - Step 1 (Create): Learning objective input + patient description textarea + AI assist toggles + mic buttons
   - Step 2 (Review): Editable textarea fields for objective and patient info
   - Step 3 (Assign): Clinician table with checkboxes, search, assignment notes, and "Assign Case" button

2. **CASE LIBRARY** (the relevant tab for Patient Library) — Contains:
   - **Global search box** with search suggestions (pills) in an indigo-50 background header
   - **Filter/Tags/Actions row**: Filter toggle button, inline filter tag chips (removable), "Assign Selected" primary action button
   - **Collapsible filter sidebar** (w-72, toggleable): Checkbox filters for Conditions, Competencies, Contexts; search within filters; saved filter sets; Apply button
   - **Main content table**: Checkbox column, Case name + description, Condition badge, Competency badge, Context badge, Actions column with "Assign" button per row
   - Three sample case rows with colored badge pills (blue for conditions, green for competencies, purple for contexts)

**Also includes a hidden "original case library" section** with:
- Sub-tabs: Conditions / Competencies / Contexts
- Specialty filter pill buttons (All, Cardiology, Dermatology, etc.)
- Condition card grid (4-column) with selectable cards (click to toggle selection with checkmark overlay)
- Load more / infinite scroll functionality
- "Review Cases" button that activates when cards are selected

**Styling patterns from mockup:**
- `.dashboard-card`: white bg, rounded-lg, shadow-sm, p-6, mb-6
- `.tab-button`: bottom-border active indicator, indigo-600 active color
- `.input-field`: border gray-200, rounded-lg, p-3, indigo focus ring
- `.primary-button`: bg-indigo-600, white text, rounded, hover:bg-indigo-700
- `.condition-card.selected`: bg-indigo-100, border-indigo-600, 2px border, translateY(-2px), checkmark overlay badge

### 2. Existing Admin Infrastructure

**Admin Pages:**
- `app/admin/page.tsx` — Renders `UserManagement` component; links to `/admin/assignments`; role-gated (redirects non-admins)
- `app/admin/assignments/page.tsx` — Renders `AssignmentManagement`; back-link to `/admin`

**Admin Components:**
- `app/admin/UserManagement.tsx` — Client component; lists users with inline role dropdown (user/admin); per-row save status (saving/success/error)
- `app/admin/assignments/AssignmentManagement.tsx` — Client component; two assignment modes (patient→clinicians, clinicians→patient); patient search with debounce; clinician multi-select with chips; encounter selection; assignments table with status filter + text search

**No admin layout.tsx** — admin pages render standalone (no shared sidebar/nav), just centered card-style layouts with back links.

**Access Control:**
- `app/admin/page.tsx:13` checks `session.user.role !== "admin"` and redirects
- `components/layout/TopBar.tsx` conditionally shows admin link based on role

### 3. Patient/Case Data Layer

**Prisma Models (local DB):**
- `User` — clinician identity with `role` (default "user"), `fhirPractitionerId`
- `UserPatient` — assignment join table: `userId`, `patientFhirId`, `status` (waiting_room/in_progress/completed), `assignedBy`, `encounterFhirId`, `sourceEncounterFhirId`, `sourcePatientFhirId`, `includeNoteText`

**FHIR Services (external data):**
- `lib/services/fhir-patient-service.ts` — `listFhirPatients()`, `searchFhirPatients()`, `createFhirPatient()`, `upsertFhirPatient()`
- `lib/services/fhir-encounter-service.ts` — encounter CRUD
- `lib/services/fhir-clone-service.ts` — `cloneEncounter()`, `clonePatient()` with selectable resource types

**API Routes:**
- `app/api/fhir/patient/route.ts` — GET (search), POST (create), PUT (update) FHIR patients
- `app/api/user/patients/route.ts` — GET/POST/PATCH/DELETE user-patient assignments
- `app/api/case-library/route.ts` — GET with `?view=` dispatch (users, user-patients, assignments, patient-encounters, recent-activity)
- `app/api/case-library/assign/route.ts` — POST admin assignment with encounter cloning
- `app/api/case-library/duplicate/route.ts` — POST patient duplication

**Types:**
- `lib/types/patient.ts` — `Patient` interface (id, name, mrn, dob, sex, avatar, summary, variables, fhirId)
- `lib/types/encounter.ts` — `AppEncounter` interface
- `lib/types/fhir.ts` — FHIR resource type definitions
- `lib/constants/case-status.ts` — `CaseStatus` enum, `STATUS_BADGE`, `STATUS_TAB_LABELS`, `VALID_STATUS_TRANSITIONS`

### 4. Existing UI Patterns (Reusable)

**Data Tables:**
- `AssignmentManagement.tsx:356-418` — Full table with status filter dropdown + text search, status badges, hover rows
- `CaseLibraryPanel.tsx:385-418` — Clinician patient table with clickable rows, two-line cells, truncated preview

**Tab Navigation:**
- Status tabs with counts: `CaseLibraryPanel.tsx:353-379` (pill buttons, active=bg-blue-600)
- Text-label tabs: `CaseLibraryPanel.tsx:556-577` (admin Users/Recent switcher)
- Mode switcher: `AssignmentManagement.tsx:191-212` (two-button toggle)

**Search/Filter:**
- Inline filter input: `PatientListPanel.tsx:63-76` (Search icon + input, client-side `useMemo` filter)
- Debounced search + dropdown: `PatientSearch.tsx` (300ms debounce, click-outside-close, result dropdown)
- Search + chips: `AssignmentManagement.tsx:222-272` (typeahead with selection pills)

**List/Card Patterns:**
- Scrollable list with action icons: `CaseLibraryPanel.tsx:419-483` (UserPlus, Copy per row)
- Card list with edit toggle: `MedicationsTab.tsx:131-224` (display/edit mode, status pills)
- Template library panel: `TemplatesPanel.tsx` (pinned-first sorting, border-l-4 accent)

**Layout Patterns:**
- Centered card container: `py-8 px-8` → `bg-white rounded-lg shadow-sm border p-8 max-w-xl mx-auto`
- Collapsible sidebar: inline CSS transition with `w-0/w-72` toggle (exists in mockup, not yet in app)
- Resizable split panel: `SplitTabLayout.tsx` (react-resizable-panels)
- Drilldown view navigation: `CaseLibraryPanel.tsx` (discriminated union view type with back button)

**Status Feedback:**
- Banner pattern: `bg-red-50 border-red-200` error / `bg-green-50` success / `bg-blue-50` saving
- Per-row inline status: saving/success/error with fixed-width container

### 5. Existing Case Library Panel (Closest Existing Feature)

`components/panels/CaseLibraryPanel.tsx` is the closest existing implementation to what the Patient Library would be. It currently:
- Lives as a left-panel in the main EMR workspace (not a standalone admin page)
- Uses a discriminated union view type for drill-down navigation (users → user-patients → encounters)
- Fetches data from `/api/case-library?view=...`
- Has admin vs clinician rendering logic based on `session?.user?.role`
- Includes status tabs (Waiting Room / In Progress / Completed) for the clinician view
- Has search input for filtering patients
- Shows per-row action buttons (Assign, Duplicate) for admin users
- Opens dialogs (`AssignCaseDialog`, `DuplicatePatientDialog`) for admin actions

## Code References

- `skill_builder.html` — Reference mockup for Patient Library design
- `app/admin/page.tsx` — Existing admin page with role gate
- `app/admin/UserManagement.tsx` — Admin user management component
- `app/admin/assignments/AssignmentManagement.tsx` — Admin assignment management
- `components/panels/CaseLibraryPanel.tsx` — Existing case library (closest feature)
- `components/panels/PatientListPanel.tsx` — FHIR patient list with filter
- `lib/services/fhir-patient-service.ts` — FHIR patient CRUD service
- `lib/services/fhir-clone-service.ts` — Patient/encounter cloning
- `app/api/case-library/route.ts` — Case library API with view dispatch
- `app/api/fhir/patient/route.ts` — FHIR patient API
- `lib/types/patient.ts` — Patient type definitions
- `lib/constants/case-status.ts` — Case status enum and badges
- `prisma/schema.prisma` — Database schema (User, Account, UserPatient models)

## Architecture Documentation

**Technology Stack:**
- Next.js 16 App Router, TypeScript (strict)
- Tailwind v4 + shadcn/ui (new-york style) + Lucide icons
- Prisma v7 + PostgreSQL (local auth/assignment data)
- PhenoML SDK → Medplum FHIR server (clinical data)
- NextAuth v5 with Google OAuth + JWT sessions

**Admin Page Pattern:**
- Server component page (`app/admin/.../page.tsx`) → imports client component
- Role gate at page level: `if (session.user.role !== "admin") redirect("/")`
- No shared admin layout — each page is standalone with back links
- Client components use direct `fetch()` to API routes

**Data Architecture:**
- Patient demographics/clinical data: FHIR server (accessed via `lib/services/fhir-*-service.ts`)
- User-patient assignments: PostgreSQL via Prisma (`UserPatient` model)
- Patients referenced by `patientFhirId` (string FK to external system)

## Related Research

- [2026-03-03-patient-case-assignment-workflow.md](2026-03-03-patient-case-assignment-workflow.md) — Documents the assignment workflow
- [2026-03-04-clinician-waiting-room-workflow.md](2026-03-04-clinician-waiting-room-workflow.md) — Documents clinician-side case workflow

## Open Questions

1. Should the Patient Library be a new admin route (`/admin/patients`) or integrated into the existing `/admin` page?
2. Should it reuse the existing `CaseLibraryPanel` component logic or be built as a new standalone component?
3. Will the Patient Library need its own API endpoint or can it reuse `/api/case-library?view=...` and `/api/fhir/patient`?
4. What filter dimensions are needed? The mockup shows Conditions, Competencies, and Contexts — do these map to existing FHIR data on patients?
5. Should the filter sidebar pattern from the mockup be implemented as a collapsible panel (like the mockup) or as a modal/drawer?
