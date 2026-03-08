---
date: 2026-03-08T12:00:00-06:00
git_commit: b89134679c91234e71f4f9bd71942fa017ca643b
branch: patient-names
repository: pineapplej
topic: "Patient Duplication Name Generation and Duplicate Patient Detection"
tags: [research, codebase, patient, duplication, faker, dedup, fhir]
status: complete
last_updated: 2026-03-08
last_updated_by: claude
last_updated_note: "Added decisions on DOB randomization, dedup criteria (name+DOB exact match), and resolution (flag+delete)"
---

# Research: Patient Duplication Name Generation and Duplicate Patient Detection

**Date**: 2026-03-08
**Git Commit**: b89134679c91234e71f4f9bd71942fa017ca643b
**Branch**: patient-names
**Repository**: pineapplej

## Research Question

When duplicating a patient, the cloned patient should not have the same name as the source (to avoid confusion). The system should generate fake names concordant with the patient's gender/sex, following the pattern in `xprimarycare/api` (`Case#duplicate`). Additionally, the system needs functionality to flag and resolve duplicate patients.

## Summary

The current codebase has a fully implemented patient duplication system that clones FHIR resources but **copies the patient name verbatim** — there is no name generation or de-duplication logic. Patient data lives entirely in an external FHIR server (Medplum via PhenoML SDK); the local Prisma/PostgreSQL database only stores a `patientFhirId` reference. There is no `@faker-js/faker` dependency and no duplicate patient detection mechanism anywhere in the codebase.

## Detailed Findings

### 1. Current Patient Duplication Flow

The duplication pipeline has three layers:

**UI Dialog** — [DuplicatePatientDialog.tsx](components/dialogs/DuplicatePatientDialog.tsx)
- Presents a checklist of 14 cloneable resource types (all selected by default)
- POSTs to `/api/case-library/duplicate` with `sourcePatientFhirId` and `resourceTypes[]`
- Shows results: new patient FHIR ID, cloned resource counts, and any errors

**API Route** — [app/api/case-library/duplicate/route.ts](app/api/case-library/duplicate/route.ts)
- Admin-only endpoint (role check at line 11)
- Validates inputs, delegates to `clonePatient()` service

**Clone Service** — [lib/services/fhir-clone-service.ts](lib/services/fhir-clone-service.ts)
- `clonePatient()` (lines 136-290): The core logic
  1. Fetches source Patient from FHIR (line 146-150)
  2. Deep-copies with `JSON.parse(JSON.stringify(...))`, deletes `id` and `meta` (lines 153-155)
  3. **Creates the new Patient in FHIR with the SAME name** (lines 157-159) — no name modification
  4. Clones normal resource types in parallel (lines 170-221)
  5. Special-cases encounters with `ClinicalImpression` cloning (lines 224-283)

### 2. How Patient Names Are Stored and Mapped

**FHIR representation** — [lib/types/fhir.ts:1-7](lib/types/fhir.ts#L1-L7)
- `FhirHumanName`: `{ family?: string, given?: string[], text?: string }`
- `FhirPatient.gender`: lowercase string (`"male"`, `"female"`, `"other"`, `"unknown"`)

**App representation** — [lib/types/patient.ts:1-11](lib/types/patient.ts#L1-L11)
- `Patient.name`: single combined display string (not split into first/last)
- `Patient.sex`: capitalized string (`"Male"`, `"Female"`, etc.)

**FHIR → App mapping** — [lib/phenoml/fhir-mapper.ts:24-35](lib/phenoml/fhir-mapper.ts#L24-L35)
- `extractPatientName()`: uses `name[0].text` if available, else joins `given[]` + `family`

**App → FHIR mapping** — [lib/phenoml/fhir-mapper.ts:100-127](lib/phenoml/fhir-mapper.ts#L100-L127)
- `mapAppPatientToFhirPatient()`: splits single `name` string on whitespace — last word becomes `family`, rest become `given[]`

**Gender ↔ Sex mapping** — [lib/phenoml/fhir-mapper.ts:57-94](lib/phenoml/fhir-mapper.ts#L57-L94)
- `mapGender()`: FHIR lowercase → app capitalized (e.g., `"male"` → `"Male"`)
- `mapSexToGender()`: app capitalized → FHIR lowercase (e.g., `"Male"` → `"male"`)

### 3. Reference Implementation: xprimarycare/api `Case#duplicate`

The external reference at `xprimarycare/api/app/models/case.rb` provides the pattern to follow:

```ruby
require "faker"

def duplicate
  fname = if gender == Case.genders[:gender_male]
    Faker::Name.unique.first_name_men
  elsif gender == Case.genders[:gender_female]
    Faker::Name.unique.first_name_women
  else
    Faker::Name.unique.first_name_neutral
  end

  duplicate_template = self.class.create!(
    first_name: fname,
    last_name: Faker::Name.unique.last_name,
    gender: gender,
    sex_at_birth: sex_at_birth,
    dob: dob_for_duplicate,
    learning_objective: learning_objective,
    parent: self
  )
  # ... clone attachments, templates ...
rescue Faker::UniqueGenerator::RetryLimitExceeded
  Faker::Name.unique.clear
  retry
end
```

Key patterns:
- **Gender-concordant first names**: `first_name_men` / `first_name_women` / `first_name_neutral` based on gender
- **Random last name**: always generated fresh via `Faker::Name.unique.last_name`
- **Unique generator**: uses `Faker::Name.unique` to avoid duplicates within a session, with retry on exhaustion
- **DOB randomization**: `dob_for_duplicate` generates a random DOB that preserves the same age as the source
- **Parent tracking**: `parent: self` links the duplicate to the original case

### 4. Patient Search (Current State)

**Component** — [components/patient/PatientSearch.tsx](components/patient/PatientSearch.tsx)
- Debounced search (300ms), calls `searchFhirPatients(query)` from patient service

**Service** — [lib/services/fhir-patient-service.ts](lib/services/fhir-patient-service.ts)
- `searchFhirPatients(name)`: searches FHIR by name
- `listFhirPatients()`: lists all patients

**Admin search** — [app/admin/patients/PatientLibrary.tsx](app/admin/patients/PatientLibrary.tsx)
- Inline search input filtering patients by name

### 5. Duplicate Patient Detection (Current State)

**No duplicate detection exists.** There is:
- No pre-creation validation checking for existing patients with the same name
- No fuzzy matching or phonetic matching (Soundex, Metaphone)
- No duplicate flagging or resolution UI
- No merge/link patient functionality
- The only "existing check" is in `CaseLibraryPanel.tsx` lines 164-170 which checks if a patient tab is already open in the sidebar (UI-level only, not data-level)

### 6. Gender/Sex Fields Available for Name Generation

The FHIR `gender` field is available on every patient resource and maps to the app's `sex` field. The values used:
- FHIR: `"male"`, `"female"`, `"other"`, `"unknown"`
- App: `"Male"`, `"Female"`, `"Other"`, `"Unknown"`

This field can be used to drive gender-concordant fake name generation, directly analogous to the xprimarycare pattern.

## Code References

| File | Lines | Description |
|------|-------|-------------|
| [lib/services/fhir-clone-service.ts](lib/services/fhir-clone-service.ts) | 136-290 | `clonePatient()` — core duplication logic, copies name verbatim |
| [lib/services/fhir-clone-service.ts](lib/services/fhir-clone-service.ts) | 152-159 | Patient deep-copy and creation — where name generation should be inserted |
| [components/dialogs/DuplicatePatientDialog.tsx](components/dialogs/DuplicatePatientDialog.tsx) | 1-135 | UI dialog for duplication |
| [app/api/case-library/duplicate/route.ts](app/api/case-library/duplicate/route.ts) | 1-44 | Admin-only duplicate API route |
| [lib/phenoml/fhir-mapper.ts](lib/phenoml/fhir-mapper.ts) | 24-35 | `extractPatientName()` — FHIR name extraction |
| [lib/phenoml/fhir-mapper.ts](lib/phenoml/fhir-mapper.ts) | 57-94 | Gender/sex mapping functions |
| [lib/types/patient.ts](lib/types/patient.ts) | 1-11 | App `Patient` interface (`name`, `sex`) |
| [lib/types/fhir.ts](lib/types/fhir.ts) | 1-24 | FHIR `FhirPatient` and `FhirHumanName` types |
| [lib/services/fhir-patient-service.ts](lib/services/fhir-patient-service.ts) | — | Patient search/list service (potential dedup integration point) |
| [prisma/schema.prisma](prisma/schema.prisma) | — | Database schema (no patient demographics stored locally) |

## Architecture Documentation

### Data Architecture
- Patient demographics live exclusively in Medplum FHIR server
- Local PostgreSQL (Prisma) only stores `patientFhirId` as a reference in the `UserPatient` join table
- All patient CRUD goes through the PhenoML SDK → FHIR API

### Duplication Architecture
- Three-layer: UI dialog → API route → clone service
- Clone service does deep-copy of FHIR resources with ID/meta stripping
- Patient name is currently an exact copy (the gap this research addresses)

### Name Structure
- FHIR uses structured names: `{ given: string[], family: string, text: string }`
- App uses a flat string: `name: string`
- Name splitting uses simple whitespace logic (last word = family, rest = given)

### Key Mapping Between xprimarycare/api and pineapplej

| xprimarycare/api (Rails) | pineapplej (Next.js/FHIR) |
|---|---|
| `Case#gender` enum (`male/female/other/unknown`) | `FhirPatient.gender` (`male/female/other/unknown`) |
| `Case#first_name` / `Case#last_name` | `FhirHumanName.given[]` / `FhirHumanName.family` |
| `Faker::Name.unique.first_name_men` | Need `@faker-js/faker` equivalent: `faker.person.firstName('male')` |
| `Faker::Name.unique.last_name` | `faker.person.lastName()` |
| `Case#parent_id` → self-referential FK | No equivalent — FHIR has no built-in parent/child patient link |
| `Faker::UniqueGenerator::RetryLimitExceeded` | `@faker-js/faker` has `faker.helpers.unique()` with retry |

## Related Research

- [2026-03-03-admin-patient-library.md](docs/ai/research/2026-03-03-admin-patient-library.md) — Admin patient library UI
- [2026-03-03-patient-case-assignment-workflow.md](docs/ai/research/2026-03-03-patient-case-assignment-workflow.md) — Patient assignment workflow

## Decisions (2026-03-08)

1. **DOB randomization**: Yes — randomize DOB within the same age range as the source, matching the xprimarycare pattern.
2. **Duplicate detection criteria**: Exact match on **name AND DOB** — a patient is flagged as a duplicate if another patient has an identical name string and identical birth date.
3. **Parent tracking**: Not needed — duplicate detection is purely by name+DOB match, no explicit parent/child link required.
4. **Duplicate resolution**: **Flag + delete** — admin can flag detected duplicates and delete the unwanted one. No merge functionality needed.

## Open Questions

1. **Faker dependency**: `@faker-js/faker` must be added to `package.json`. It will be used server-side only (inside the clone service).
2. **Uniqueness check scope**: After generating a fake name+DOB, the system should verify the combination doesn't already exist in FHIR before creating the clone (to prevent the generated name itself from duplicating an existing patient).
3. **Duplicate flag storage**: Flags could be stored locally in Prisma (new `patient_duplicates` table) or computed on-the-fly by scanning FHIR for name+DOB collisions. A Prisma table is more efficient for admin review.
