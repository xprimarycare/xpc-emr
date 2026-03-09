---
date: 2026-03-08T00:00:00-08:00
git_commit: 709205e305a00b1c4e8c7fd3d150347abaa9179f
branch: new-db
repository: pineapplej
topic: "EMR Backend Abstraction - Medplum/PhenoML Detachment Research"
tags: [research, codebase, medplum, phenoml, fhir, database, emr-backend, architecture]
status: complete
last_updated: 2026-03-08
last_updated_by: claude
last_updated_note: "Added user decisions and architectural implications for backend abstraction"
---

# Research: EMR Backend Abstraction — Medplum/PhenoML Detachment

**Date**: 2026-03-08
**Git Commit**: 709205e305a00b1c4e8c7fd3d150347abaa9179f
**Branch**: new-db
**Repository**: pineapplej

## Research Question

How is Medplum/PhenoML currently integrated into the app, and what would be required to detach from it, replace it with a custom database, and support pluggable EMR backends?

## Summary

The app has a **two-tier data architecture**:
1. **PostgreSQL (Prisma)** — stores users, OAuth accounts, patient assignments (`UserPatient`), patient tags, impersonation logs
2. **Medplum (via PhenoML SDK)** — stores ALL clinical data: patients, encounters, medications, conditions, allergies, vitals, labs, imaging, referrals, procedures, family history, social history, goals, care teams, tasks, appointments, communications

All Medplum access flows through a single client at `lib/phenoml/client.ts`, proxied by 19 Next.js API routes in `app/api/fhir/`. The app already has its own type system (`lib/types/`) fully decoupled from FHIR — a mapper layer (`lib/phenoml/fhir-mapper.ts`) bridges between FHIR bundles and app types bidirectionally.

## Detailed Findings

### Current Data Flow Architecture

```
UI Component (handleSaveToMedplum)
    → lib/services/fhir-*-service.ts   (client-side fetch + FHIR→App mapping)
        → app/api/fhir/*/route.ts      (server-side, auth + phenomlClient calls)
            → lib/phenoml/client.ts    (PhenoML SDK singleton)
                → Medplum FHIR Server
```

### Single Entry Point: PhenoML Client

[client.ts](lib/phenoml/client.ts) — Instantiates `PhenoMLClient` from `phenoml` npm package (^3.1.0). Throws at module-load time if env vars are missing. All 19 FHIR API routes and `fhir-clone-service.ts` import this singleton.

Environment variables:
- `PHENOML_USERNAME` — PhenoML credential
- `PHENOML_PASSWORD` — PhenoML credential
- `PHENOML_BASE_URL` — PhenoML API URL
- `PHENOML_FHIR_PROVIDER_ID` — Target FHIR workspace/provider ID

### FHIR Mapper (Bidirectional)

[fhir-mapper.ts](lib/phenoml/fhir-mapper.ts) — ~1,630 lines. Defines bidirectional mapping functions for every FHIR resource type used:

| App Type | FHIR Resource | Mapper Functions |
|---|---|---|
| Patient | FhirPatient | `mapFhirPatientToAppPatient`, `mapAppPatientToFhirPatient` |
| Medication | FhirMedicationRequest | `mapFhirMedRequestToAppMedication`, `mapAppMedicationToFhirMedRequest` |
| Allergy | FhirAllergyIntolerance | `mapFhirAllergyToAppAllergy`, `mapAppAllergyToFhirAllergy` |
| Condition | FhirCondition | `mapFhirConditionToAppCondition`, `mapAppConditionToFhirCondition` |
| Procedure | FhirProcedure | `mapFhirProcedureToAppProcedure`, `mapAppProcedureToFhirProcedure` |
| FamilyHistory | FhirFamilyMemberHistory | `mapFhirFamilyHistoryToApp`, `mapAppFamilyHistoryToFhir` |
| Vital | FhirObservation | `mapFhirObservationToAppVital`, `mapAppVitalToFhirObservation` |
| SocialHistory | FhirSocialHistoryObservation | `mapFhirSocialHistoryToApp`, `mapAppSocialHistoryToFhir` |
| Encounter | FhirEncounter + FhirClinicalImpression | `mapFhirEncounterToApp`, mapper helpers |
| Lab | FhirServiceRequest | `mapFhirServiceRequestToAppLab`, `mapAppLabToFhirServiceRequest` |
| Imaging | FhirServiceRequest | `mapFhirServiceRequestToAppImaging`, `mapAppImagingToFhirServiceRequest` |
| Referral | FhirServiceRequest | `mapFhirServiceRequestToAppReferral`, `mapAppReferralToFhirServiceRequest` |
| Task | FhirTask | `mapFhirTaskToApp`, `mapAppTaskToFhir` |
| Appointment | FhirAppointment | `mapFhirAppointmentToApp`, `mapAppAppointmentToFhir` |
| Communication | FhirCommunication | `mapFhirCommunicationToApp`, `mapAppCommunicationToFhir` |
| CareTeam | FhirCareTeam | `mapFhirCareTeamToApp`, `mapAppCareTeamToFhir` |
| Goal | FhirGoal | `mapFhirGoalToApp`, `mapAppGoalToFhir` |

Also references PhenoML-specific FHIR extension URLs (e.g., `http://phenoml.com/fhir/StructureDefinition/encounter-signature`).

### FHIR API Routes (19 files)

All in `app/api/fhir/` — each imports `phenomlClient` and calls `phenomlClient.fhir.search/create/upsert/delete`:

`allergy`, `appointment`, `care-team`, `clinical-impression`, `communication`, `condition`, `encounter`, `family-history`, `goal`, `medication`, `observation`, `patient`, `procedure`, `referral`, `service-request`, `social-history`, `task`

Plus two PhenoML-specific AI routes:
- `lang2fhir/route.ts` — `phenomlClient.lang2Fhir.create()` (NLP→FHIR)
- `construe/semantic/route.ts` — `phenomlClient.construe.semanticSearchEmbeddingBased()` (semantic search)

### Service Layer (18 files)

All in `lib/services/fhir-*-service.ts` — client-side functions that:
1. Call `fetch('/api/fhir/...')` to the API routes above
2. Apply `fhir-mapper.ts` functions to convert FHIR bundles → app types
3. Return structured result objects with error handling

Plus `fhir-clone-service.ts` which imports `phenomlClient` directly for patient duplication.

### App Type Definitions (17 files)

All in `lib/types/` — these are the **app-internal representations** fully decoupled from FHIR. Each file defines interfaces for one domain concept (e.g., `Medication`, `Allergy`, `Condition`). No FHIR imports in these files.

### FHIR Type Definitions

[fhir.ts](lib/types/fhir.ts) — Hand-rolled FHIR interfaces (40+ types). No `@medplum/fhirtypes` dependency. Includes bundle types, resource types, and shared primitives.

### UI Components with Medplum Sync

~20+ components in `components/patient/` and `components/panels/` contain `handleSaveToMedplum` or `handleSyncToMedplum` functions. These call service layer functions and are the UI-level integration point.

### Existing PostgreSQL Schema (Prisma)

[schema.prisma](prisma/schema.prisma) — 5 models, none storing clinical data:
- `User` — auth + profile + `fhirPractitionerId`
- `Account` — OAuth accounts
- `UserPatient` — patient assignment join table (references `patientFhirId`, `encounterFhirId`)
- `PatientTag` — tags on patients (references `patientFhirId`)
- `ImpersonationLog` — admin impersonation audit trail

### Cross-Cutting FHIR Dependencies

- **`fhirPractitionerId`** on `User` model — links user to FHIR Practitioner resource
- **`patientFhirId`** on `UserPatient` and `PatientTag` — references FHIR Patient IDs
- **`encounterFhirId`** on `UserPatient` — references FHIR Encounter IDs
- **Session token** carries `fhirPractitionerId` via NextAuth callbacks in `auth.ts`
- **Variable formatters** (`lib/variable-formatters.ts`) fire 15 parallel FHIR service calls to assemble template variables
- **AI assistant** (`app/api/ai-assistant/chat/route.ts`) fires 17 parallel FHIR searches + caches with 5-min TTL

### PhenoML-Specific Features Beyond Basic FHIR CRUD

1. **lang2fhir** — Natural language to FHIR conversion (`phenomlClient.lang2Fhir.create()`)
2. **Construe semantic search** — Embedding-based semantic search (`phenomlClient.construe.semanticSearchEmbeddingBased()`)
3. **PhenoML extension URLs** — Custom FHIR extensions in fhir-mapper.ts (e.g., encounter signatures, care team PCP user ID)
4. **Provider ID** — `PHENOML_FHIR_PROVIDER_ID` scopes all operations to a workspace

## Code References

- `lib/phenoml/client.ts` — Single PhenoML/Medplum entry point
- `lib/phenoml/fhir-mapper.ts` — Bidirectional FHIR↔App mapper (~1,630 lines)
- `lib/types/fhir.ts` — Hand-rolled FHIR type definitions
- `lib/types/*.ts` — App-internal type definitions (17 files)
- `lib/services/fhir-*-service.ts` — Client-side FHIR service layer (18 files)
- `app/api/fhir/*/route.ts` — Server-side FHIR API routes (19 files)
- `prisma/schema.prisma` — Current PostgreSQL schema
- `lib/variable-formatters.ts` — Parallel FHIR fetch for template variables
- `app/api/ai-assistant/chat/route.ts` — AI assistant with 17 parallel FHIR queries
- `auth.ts` — Session carries `fhirPractitionerId`

## Architecture Documentation

### Key Architectural Properties

1. **Clean separation exists**: App types in `lib/types/` are already decoupled from FHIR. The mapper in `fhir-mapper.ts` is the only bridge.
2. **Single client entry point**: All Medplum access goes through `lib/phenoml/client.ts` — there is no scattered direct Medplum usage.
3. **Three-tier pattern**: UI → Service → API Route → PhenoML. The service layer is client-side; the API routes are server-side.
4. **Foreign keys reference FHIR IDs**: `UserPatient.patientFhirId`, `PatientTag.patientFhirId`, `User.fhirPractitionerId` all store Medplum resource IDs.
5. **No `@medplum/*` packages**: The app uses only the `phenoml` npm package — Medplum is abstracted behind PhenoML.

## Related Research

- [2026-03-01-google-oauth-postgres-setup.md](docs/ai/research/2026-03-01-google-oauth-postgres-setup.md) — PostgreSQL setup context
- [2026-03-03-admin-patient-library.md](docs/ai/research/2026-03-03-admin-patient-library.md) — Patient library architecture
- [2026-03-08-patient-duplication-names-dedup.md](docs/ai/research/2026-03-08-patient-duplication-names-dedup.md) — Patient cloning via FHIR

## Follow-up: User Decisions (2026-03-08)

### Decision Summary

| Question | Decision |
|---|---|
| DB architecture | **Separate clinical DB** from auth DB — portable, can copy/paste to another customer |
| Data migration | **Starting fresh** — no Medplum data migration needed |
| Toggle mechanism | **Runtime toggle (Option B)** in settings UI, but OK with env var (Option A) if significantly easier |
| PhenoML AI features | **Build own version** — use AI to resolve natural language to own DB entries (e.g., "order CBC" → local CBC record) |
| Practitioner IDs | **Replace with XPC-ID** — own ID system instead of FHIR Practitioner IDs |
| Patient identity | **Local DB IDs** instead of FHIR IDs in `UserPatient` and `PatientTag` |
| Clinical data scope | **Everything local** — encounters, clinical impressions, all resources |
| AI assistant | **Yes** — will query local DB instead of FHIR |
| Rollout strategy | **Big switch** — but keep Medplum functional as a toggleable fallback |

### Architectural Implications

**1. Two separate PostgreSQL databases (or schemas):**
- **Auth DB** (existing): `users`, `accounts`, `user_patients`, `patient_tags`, `impersonation_logs`
- **Clinical DB** (new): All clinical tables — patients, encounters, medications, conditions, allergies, vitals, labs, imaging, referrals, procedures, family_history, social_history, goals, care_teams, tasks, appointments, communications, clinical_impressions
- Clinical DB is portable — can be exported and given to another customer instance

**2. Clinical DB schema design:**
- Tables should mirror the existing app types in `lib/types/*.ts` (not FHIR structure)
- This means simple, flat relational tables — no FHIR bundles, no extensions, no CodeableConcepts
- Each table gets its own auto-generated ID (replacing FHIR resource IDs)
- All tables reference `patientId` (local) instead of FHIR Patient resource IDs

**3. XPC-ID system:**
- Replace `fhirPractitionerId` on `User` model with `xpcId` (or similar)
- Replace `patientFhirId` on `UserPatient` and `PatientTag` with local `patientId` FK
- Replace `encounterFhirId` on `UserPatient` with local `encounterId` FK
- Session token carries `xpcId` instead of `fhirPractitionerId`

**4. Backend toggle — two implementation paths:**

The service layer (`lib/services/`) is the natural toggle point. Each service function currently calls `fetch('/api/fhir/...')` and maps FHIR→App types. In local mode, it would call `fetch('/api/clinical/...')` and get app types directly (no mapping needed).

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

**Toggle options:**
- **Runtime (Option B)**: Store `emrBackend: 'local' | 'medplum'` in a `Settings` table or in the `User` model. API routes check this at request time. Services pass the setting to the API layer.
- **Env var (Option A)**: `EMR_BACKEND=local|medplum` env var checked at startup. Simpler but requires redeploy to switch.

**Recommendation**: Option A (env var) is significantly simpler and still allows toggling — just requires a server restart. Given that switching backends is an admin-level operation (not something users toggle mid-session), an env var is pragmatic. Can always add a settings UI later that writes to the env or a config table.

**5. Files that would change:**

| Layer | Medplum Mode | Local Mode |
|---|---|---|
| `lib/phenoml/client.ts` | Keep as-is | Not loaded |
| `lib/phenoml/fhir-mapper.ts` | Keep as-is | Not needed |
| `lib/types/fhir.ts` | Keep as-is | Not needed |
| `lib/types/*.ts` (app types) | **Shared** — used by both modes | **Shared** |
| `lib/services/fhir-*-service.ts` | Keep as-is | New `lib/services/local-*-service.ts` OR refactor existing services to call different endpoints |
| `app/api/fhir/*/route.ts` | Keep as-is | New `app/api/clinical/*/route.ts` with Prisma queries |
| `prisma/schema.prisma` | Keep as-is | Add clinical tables |
| `components/patient/*.tsx` | Rename `handleSaveToMedplum` → `handleSave` | Same functions, different backend |
| `auth.ts` | `fhirPractitionerId` | `xpcId` |
| `lib/variable-formatters.ts` | FHIR service calls | Local service calls |
| `app/api/ai-assistant/chat/route.ts` | 17 FHIR searches | Prisma queries |

**6. What gets simpler in local mode:**
- No FHIR bundle wrapping/unwrapping — queries return app types directly
- No FHIR search parameter syntax — just SQL/Prisma queries
- No rate limiting from external API
- No PhenoML extension URLs
- No FHIR CodeableConcept encoding for simple string fields
- Patient duplication becomes a simple DB copy instead of cloning FHIR resources
- AI assistant context fetch becomes a few Prisma `findMany` calls instead of 17 HTTP requests

**7. Estimated table count for clinical DB:**
Based on the 17 app types, approximately 17-20 tables:
`patients`, `encounters`, `clinical_impressions`, `medications`, `allergies`, `conditions`, `procedures`, `family_histories`, `vitals`, `social_histories`, `labs`, `imaging_orders`, `referrals`, `goals`, `care_teams`, `care_team_members`, `tasks`, `appointments`, `communications`

## Final Decisions (2026-03-08)

| Question | Decision |
|---|---|
| Clinical DB isolation | **Separate PostgreSQL database** with its own `CLINICAL_DATABASE_URL` env var — fully portable, can dump/restore independently |
| Toggle scope | **Global** — whole app instance uses one backend at a time |
| Catalog table | **Yes** — a lookup table of orderable items (CBC, CMP, etc.) that AI maps natural language against |

All open questions resolved. Ready for implementation planning.
