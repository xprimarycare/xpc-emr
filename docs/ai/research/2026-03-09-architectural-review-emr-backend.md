---
date: 2026-03-09T07:25:58Z
git_commit: 4cf8b4a50cda1134bff51df1cd1bd806829ddade
branch: tabs-settings-clean-up
repository: pineapplej
topic: "Architectural Review of Dual-Backend EMR Implementation"
tags: [research, codebase, architecture, emr-backend, clinical-routes, fhir-services, code-review]
status: complete
last_updated: 2026-03-09
last_updated_by: claude
---

# Research: Architectural Review of Dual-Backend EMR Implementation

**Date**: 2026-03-09T07:25:58Z
**Git Commit**: 4cf8b4a50cda1134bff51df1cd1bd806829ddade
**Branch**: tabs-settings-clean-up
**Repository**: pineapplej

## Research Question

What is the current state of the dual-backend EMR architecture (local PostgreSQL vs. Medplum FHIR), and what architectural issues exist that need to be addressed?

## Summary

The `tabs-settings-clean-up` branch (4 commits on top of `main`) introduces a local PostgreSQL backend as an alternative to Medplum FHIR. The implementation spans 120 changed files with ~48K lines added. The architecture consists of three layers: clinical API routes (19 files, local-only Prisma CRUD), FHIR service layer (18 files, client-side branching via `isLocalBackendClient()`), and a runtime toggle mechanism (DB → process.env → client). The implementation is functional but has critical issues around backend guard safety, runtime toggle reliability, code duplication, and incomplete separation patterns.

## Detailed Findings

### 1. Backend Toggle Mechanism

The toggle flows through four stages:

1. **DB storage**: `AppConfig` model in main Prisma schema stores `key="EMR_BACKEND"`, `value="local"|"medplum"` in the `app_config` table ([prisma/schema.prisma:91-97](prisma/schema.prisma#L91-L97)).

2. **Server startup**: `instrumentation.ts` calls `loadEmrBackendFromDb()` which reads the DB and writes to `process.env.EMR_BACKEND` and `process.env.NEXT_PUBLIC_EMR_BACKEND` ([lib/app-config.ts:28-34](lib/app-config.ts#L28-L34)).

3. **Build-time client exposure**: `next.config.ts` inlines `NEXT_PUBLIC_EMR_BACKEND` into the client bundle at build time ([next.config.ts:5-7](next.config.ts#L5-L7)).

4. **Runtime reads**: `lib/emr-backend.ts` provides synchronous functions — `isLocalBackend()` for server, `isLocalBackendClient()` for client/isomorphic ([lib/emr-backend.ts:1-31](lib/emr-backend.ts#L1-L31)).

The admin settings API (`PUT /api/admin/settings`) mutates `process.env` at runtime ([app/api/admin/settings/route.ts:51](app/api/admin/settings/route.ts#L51)), but this only affects the current server process and has no effect on `NEXT_PUBLIC_*` vars which are baked at build time.

### 2. Clinical API Routes (19 files)

All routes under `app/api/clinical/` import `prismaClinical` unconditionally and perform direct Prisma CRUD against the clinical database. They are **local-backend-only** — no `isLocalBackend()` guard exists in any route.

**Standard CRUD pattern** (used by 12 routes: allergy, appointment, care-team, condition, encounter, imaging, lab, medication, procedure, referral, social-history, task, vital):

- **GET**: `?patient={id}` → `requirePatientAccess` → `findMany({ where: { patientId } })` → `{ items, total }`
- **POST**: body with `patientId` → `requirePatientAccess` → `pick(body, FIELDS)` → `create({ data })` → `{ id }`
- **PUT**: body with `id` → `findUnique` for ownership → `requirePatientAccess` → `pick(body, FIELDS.filter(f => f !== "patientId"))` → `update({ where: { id } })` → full updated record
- **DELETE**: `?id={id}` → `findUnique` for ownership → `requirePatientAccess` → `delete({ where: { id } })` → `{ success: true }`

**Auth chain** (uniform across all standard routes):
```
requireAuth() → isSession() guard → requirePatientAccess(session, patientId)
```
`requirePatientAccess` at [lib/clinical-auth.ts:14](lib/clinical-auth.ts#L14) grants admin immediate access, otherwise queries `UserPatient` using `getPatientIdField()` to select the correct column (`patientLocalId` or `patientFhirId`).

**Field allowlisting** via `pick()` at [lib/pick.ts:5](lib/pick.ts#L5): every standard route declares a `const RESOURCE_FIELDS = [...] as const` tuple and passes it to `pick(body, FIELDS)` before Prisma writes.

**Routes with non-standard patterns:**

| Route | Deviations |
|---|---|
| `patient` | Two GET modes (single by `?id=` vs. list); list scoping for non-admins via `UserPatient` join; soft-delete (`deletedAt`); uses both `prismaClinical` and `prisma` (auth DB) |
| `communication` | Manages `Thread` + `Message` models through a single endpoint; POST dispatches by payload shape; no `pick()` usage |
| `family-history` | Nested `FamilyHistoryCondition[]` relation handling; PUT uses `$transaction` to delete+recreate conditions |
| `goal` | No `pick()` — manual field mapping; reshapes flat coding columns into nested `{ coding: { system, code, display } }` in GET |
| `clone` | Admin-only; POST-only; full `$transaction` with 17 relation includes; `stripMeta()` helper for ID/metadata removal; encounter ID remapping |
| `catalog` | GET-only; no patient scope; no `requirePatientAccess` |

**Missing DELETE handlers**: encounter, vital, task, medication (4 routes).

### 3. FHIR Service Layer (18 files)

Every service file in `lib/services/fhir-*-service.ts` uses `isLocalBackendClient()` as an early-return branch at the top of each function. The local branch calls `/api/clinical/*` and maps response items with `{ ...item, fhirId: item.id }`. The FHIR branch calls `/api/fhir/*` and passes responses through `fhir-mapper.ts` transformations.

**Response shape differences:**
- Local: `data.items[]` with synthetic `fhirId: item.id`
- FHIR: typed bundle cast → `mapFhirBundleTo*()` function → app type arrays

**Stub functions in local mode (3):**
- `parseMedicationText` → returns `{ resource: null }` ([fhir-medication-service.ts:85](lib/services/fhir-medication-service.ts#L85))
- `parseReferralText` → returns `{ resource: null }` ([fhir-referral-service.ts:147](lib/services/fhir-referral-service.ts#L147))
- `cloneEncounter` → returns `{ error: "not supported" }` ([fhir-clone-service.ts:80](lib/services/fhir-clone-service.ts#L80))

**Encounter service** has the most complex branching: FHIR branch fetches two resource types (`Encounter` + `ClinicalImpression`) in parallel and merges them; local branch gets a pre-merged single response.

### 4. Clinical Prisma Schema

`prisma/clinical/schema.prisma` defines 21 models (including `FamilyHistoryCondition`, `Message`, `Thread`, `Tab`, and `Catalog`) pointing to `CLINICAL_DATABASE_URL`. All date-like fields (date, endDate, authoredOn, effectiveDateTime, etc.) are stored as `String` rather than `DateTime`. All IDs use `cuid()`. All patient-scoped models cascade-delete from Patient, except Vital and Task which use `SetNull` on `encounterId`.

The generated Prisma client (~40K+ lines) is committed to the repo at `app/generated/prisma-clinical/`.

### 5. Supporting Utilities

| Module | Location | Purpose |
|---|---|---|
| `emr-backend.ts` | [lib/emr-backend.ts](lib/emr-backend.ts) | Backend detection functions (server + client) |
| `app-config.ts` | [lib/app-config.ts](lib/app-config.ts) | DB-backed config CRUD + startup loader |
| `clinical-auth.ts` | [lib/clinical-auth.ts](lib/clinical-auth.ts) | `requirePatientAccess` guard |
| `patient-id.ts` | [lib/patient-id.ts](lib/patient-id.ts) | Backend-aware patient ID field resolution |
| `prisma-clinical.ts` | [lib/prisma-clinical.ts](lib/prisma-clinical.ts) | Lazy Proxy-based Prisma client singleton |
| `pick.ts` | [lib/pick.ts](lib/pick.ts) | Field allowlist utility |
| `logger.ts` | [lib/logger.ts](lib/logger.ts) | Structured JSON logger |

### 6. Mixed-Backend Integration Points

Several files outside the clinical route/service layer have their own backend branching:

- `app/api/case-library/route.ts` — inline `isLocalBackend()` branching for `fetchPatientEncounters` and `fetchPatientInfo`; defines a local `getClinicalPatientId` function not shared with `patient-id.ts`
- `app/api/patient-tags/route.ts` — writes `patientFhirId: ""` (empty string) in local mode instead of `null`, which will conflict with unique constraints
- `app/api/ai-assistant/chat/route.ts` — 17 parallel FHIR searches; local branching status unclear from this research

## Code References

- `lib/emr-backend.ts` — Backend toggle utility (server + client)
- `lib/app-config.ts` — AppConfig CRUD + `loadEmrBackendFromDb()`
- `lib/clinical-auth.ts` — `requirePatientAccess` authorization guard
- `lib/patient-id.ts` — `getPatientIdField()` / `getPatientIdValue()`
- `lib/prisma-clinical.ts` — Lazy Proxy clinical Prisma client
- `lib/pick.ts` — Field allowlist utility
- `lib/logger.ts` — Structured JSON logger
- `instrumentation.ts` — Next.js startup hook
- `next.config.ts` — Client-side env var exposure
- `app/api/admin/settings/route.ts` — Admin config API
- `app/api/clinical/*/route.ts` — 19 clinical API route files
- `lib/services/fhir-*-service.ts` — 18 FHIR service files with backend branching
- `prisma/clinical/schema.prisma` — Clinical DB schema (21 models)
- `prisma/schema.prisma` — Main DB schema (AppConfig, UserPatient, PatientTag)

## Architecture Documentation

### Current Data Flow

```
# Medplum mode:
UI → fhir-*-service.ts (isLocalBackendClient()=false)
   → /api/fhir/* → phenomlClient → Medplum FHIR
   → fhir-mapper.ts (FHIR→App types)

# Local mode:
UI → fhir-*-service.ts (isLocalBackendClient()=true)
   → /api/clinical/* → prismaClinical → PostgreSQL
   → direct App types (no mapping)
```

### Key Architectural Properties

1. **Service layer is the toggle point**: `isLocalBackendClient()` branches at the top of every service function
2. **Clinical routes are local-only**: no backend guard; crash in Medplum mode if accessed
3. **FHIR routes are Medplum-only**: untouched from the original implementation
4. **Auth is backend-aware**: `requirePatientAccess` queries the correct `UserPatient` column via `getPatientIdField()`
5. **Clinical Prisma client is lazy**: Proxy-based initialization defers until first actual DB call
6. **12 of 19 clinical routes are structurally identical**: same CRUD pattern with only model name and field tuple differing

### Identified Architectural Issues

| # | Severity | Issue |
|---|---|---|
| 1 | Critical | Clinical routes crash in Medplum mode — no `isLocalBackend()` guard |
| 2 | Critical | Runtime toggle mutates `process.env` — broken in serverless; `NEXT_PUBLIC_*` is build-time only |
| 3 | Critical | No request body validation (no Zod schemas) |
| 4 | Important | 12+ routes follow identical CRUD pattern — massive duplication (~2K lines) |
| 5 | Important | Missing DELETE handlers on 4 routes (encounter, vital, task, medication) |
| 6 | Important | `instrumentation.ts` can crash startup if DB unreachable |
| 7 | Important | `any` types in FHIR service local branches |
| 8 | Important | `patientFhirId: ""` in patient-tags causes unique constraint violations |
| 9 | Important | All date fields stored as `String` instead of `DateTime` |
| 10 | Suggestion | Generated Prisma client committed to repo (~40K lines) |
| 11 | Suggestion | No pagination on list endpoints |
| 12 | Suggestion | `pick()` return type loses type information (`Record<string, unknown>`) |
| 13 | Suggestion | `case-library/route.ts` defines local `getClinicalPatientId` that duplicates `patient-id.ts` logic |

## Related Research

- [2026-03-08-emr-backend-abstraction.md](docs/ai/research/2026-03-08-emr-backend-abstraction.md) — Original research for the EMR backend abstraction
- [2026-03-08-emr-backend-abstraction.md (plan)](docs/ai/plans/2026-03-08-emr-backend-abstraction.md) — Implementation plan that was executed

## Open Questions

1. Should the generated Prisma client be added to `.gitignore` and generated in CI?
2. Should `String` date fields be migrated to `DateTime` now or deferred?
3. Is the runtime toggle via admin UI a requirement, or is deploy-time env var sufficient?
4. Should the `communication` and `goal` routes be brought into the standard pattern or are their deviations intentional?
