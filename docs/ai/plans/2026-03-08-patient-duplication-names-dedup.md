# Plan: Patient Duplication Name Generation + Duplicate Detection

**Date**: 2026-03-08
**Branch**: patient-names
**Research**: [docs/ai/research/2026-03-08-patient-duplication-names-dedup.md](../research/2026-03-08-patient-duplication-names-dedup.md)
**Status**: Ready to implement

---

## Overview

Two features:

1. **Fake name + DOB on duplication** — When a patient is cloned, replace the copied name and DOB with a Faker-generated name that is concordant with the patient's gender, and a randomized DOB that preserves the same age.
2. **Duplicate patient flagging + deletion** — Admin can scan for patients that share an identical name + DOB, see them flagged in the Patient Library, and delete the unwanted copy.

---

## Feature 1: Fake Name + DOB on Duplication

### Step 1 — Install `@faker-js/faker`

```bash
npm install @faker-js/faker
```

Server-side only; no client bundle impact.

---

### Step 2 — Add name + DOB generation helpers to `lib/services/fhir-clone-service.ts`

Add two private helpers at the top of the file, after the imports:

**`generateFakePatientName(gender: string)`**

Maps FHIR `gender` → Faker sex string, generates a unique first + last name.

```ts
import { faker } from '@faker-js/faker';

function generateFakePatientName(gender: string): { given: string[]; family: string } {
  const sex =
    gender === 'male' ? 'male' :
    gender === 'female' ? 'female' :
    undefined; // neutral for 'other' / 'unknown'

  const given = [sex ? faker.person.firstName(sex) : faker.person.firstName()];
  const family = faker.person.lastName();
  return { given, family };
}
```

**`generateFakePatientDob(sourceBirthDate: string)`**

Ports the xprimarycare `dob_for_duplicate` logic to TypeScript. Computes current age from source DOB, then picks a random date within the date range that produces the same age.

```ts
function generateFakePatientDob(sourceBirthDate: string): string {
  const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const birthMs = new Date(sourceBirthDate).getTime();
  const currentAge = Math.floor((now - birthMs) / MS_PER_YEAR);

  // The same age means birth date falls in:
  //   earliest: today - (currentAge + 1) years + 1 day
  //   latest:   today - currentAge years
  const latestMs = now - currentAge * MS_PER_YEAR;
  const earliestMs = now - (currentAge + 1) * MS_PER_YEAR + 86_400_000;

  const randomMs = earliestMs + Math.random() * (latestMs - earliestMs);
  return new Date(randomMs).toISOString().split('T')[0]; // 'YYYY-MM-DD'
}
```

---

### Step 3 — Use the helpers in `clonePatient()` in `lib/services/fhir-clone-service.ts`

**Current code** (lines 152–159):
```ts
// Clone patient
const clonedPatient = JSON.parse(JSON.stringify(sourcePatient));
delete clonedPatient.id;
delete clonedPatient.meta;

const newPatient = (await phenomlClient.fhir.create(providerId, 'Patient', {
  body: clonedPatient,
})) as any;
```

**Replace with:**
```ts
// Clone patient with a generated name and DOB to avoid duplicates
const clonedPatient = JSON.parse(JSON.stringify(sourcePatient));
delete clonedPatient.id;
delete clonedPatient.meta;

const { given, family } = generateFakePatientName(sourcePatient.gender ?? 'unknown');
clonedPatient.name = [{ given, family }];

if (sourcePatient.birthDate) {
  clonedPatient.birthDate = generateFakePatientDob(sourcePatient.birthDate);
}

const newPatient = (await phenomlClient.fhir.create(providerId, 'Patient', {
  body: clonedPatient,
})) as any;
```

No changes to the rest of `clonePatient()`.

---

## Feature 2: Duplicate Patient Flagging + Deletion

### Step 4 — Add `DELETE /api/fhir/patient` to `app/api/fhir/patient/route.ts`

Appended to the existing route file. Admin-only. Deletes the FHIR patient from Medplum, then cleans up all `UserPatient` rows in Prisma for that FHIR ID (and associated `PatientTag` rows).

```ts
// DELETE /api/fhir/patient?id=<fhirId>
export async function DELETE(request: NextRequest) {
  const authResult = await requireAuth();
  if (!isSession(authResult)) return authResult;

  if (authResult.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const fhirId = request.nextUrl.searchParams.get('id');
  if (!fhirId?.trim()) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  const providerId = process.env.PHENOML_FHIR_PROVIDER_ID;
  if (!providerId) {
    return NextResponse.json({ error: 'FHIR provider not configured' }, { status: 500 });
  }

  try {
    // Delete from FHIR
    await phenomlClient.fhir.delete(providerId, `Patient/${fhirId}`);

    // Clean up local Prisma records
    await prisma.userPatient.deleteMany({ where: { patientFhirId: fhirId } });
    await prisma.patientTag.deleteMany({ where: { patientFhirId: fhirId } });

    return NextResponse.json({ deleted: fhirId });
  } catch (error) {
    console.error('FHIR Patient delete error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete patient' },
      { status: 500 }
    );
  }
}
```

Requires importing `prisma` from `@/lib/prisma` (or wherever it is exported from in the project).

---

### Step 5 — Add `GET /api/case-library/duplicates` route

New file: `app/api/case-library/duplicates/route.ts`

Fetches all FHIR patients (up to 500), groups by `name + birthDate`, returns groups with 2+ members. Admin-only.

```ts
import { NextResponse } from 'next/server';
import { requireAuth, isSession } from '@/lib/auth-helpers';
import { phenomlClient } from '@/lib/phenoml/client';

const providerId = process.env.PHENOML_FHIR_PROVIDER_ID;

// GET /api/case-library/duplicates
// Returns groups of patients that share an identical name + birthDate
export async function GET() {
  const authResult = await requireAuth();
  if (!isSession(authResult)) return authResult;

  if (authResult.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!providerId) {
    return NextResponse.json({ error: 'FHIR provider not configured' }, { status: 500 });
  }

  try {
    const bundle = await phenomlClient.fhir.search(
      providerId,
      'Patient',
      {},
      { queryParams: { _count: '500' } }
    ) as any;

    const patients: Array<{ fhirId: string; name: string; birthDate: string; gender: string }> =
      (bundle?.entry || []).map((e: any) => {
        const r = e.resource;
        const nameEntry = r?.name?.[0];
        const given = nameEntry?.given?.join(' ') || '';
        const family = nameEntry?.family || '';
        const name = [given, family].filter(Boolean).join(' ') || 'Unknown';
        return { fhirId: r.id, name, birthDate: r?.birthDate || '', gender: r?.gender || '' };
      });

    // Group by name + birthDate key
    const groups: Record<string, typeof patients> = {};
    for (const p of patients) {
      const key = `${p.name}|${p.birthDate}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(p);
    }

    // Only return groups with 2+ patients
    const duplicates = Object.values(groups).filter((g) => g.length >= 2);

    return NextResponse.json({ duplicates });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to scan for duplicates' },
      { status: 500 }
    );
  }
}
```

---

### Step 6 — Update `PatientLibrary.tsx` for duplicate flagging + deletion

**State additions:**

```ts
const [duplicateGroups, setDuplicateGroups] = useState<Array<Array<{ fhirId: string; name: string; birthDate: string }>>>([]);
const [scanningDuplicates, setScanningDuplicates] = useState(false);
```

And a derived Set for O(1) lookup:
```ts
const duplicateFhirIds = useMemo(
  () => new Set(duplicateGroups.flat().map((p) => p.fhirId)),
  [duplicateGroups]
);
```

**`scanForDuplicates` handler:**

```ts
const scanForDuplicates = async () => {
  setScanningDuplicates(true);
  try {
    const res = await fetch('/api/case-library/duplicates');
    if (!res.ok) throw new Error('Scan failed');
    const { duplicates } = await res.json();
    setDuplicateGroups(duplicates);
  } catch (err) {
    console.error(err);
  } finally {
    setScanningDuplicates(false);
  }
};
```

**`deletePatient` handler:**

```ts
const deletePatient = async (fhirId: string) => {
  if (!confirm('Delete this patient? This cannot be undone.')) return;
  const res = await fetch(`/api/fhir/patient?id=${fhirId}`, { method: 'DELETE' });
  if (res.ok) {
    setPatients((prev) => prev.filter((p) => p.fhirId !== fhirId));
    setDuplicateGroups((prev) =>
      prev
        .map((g) => g.filter((p) => p.fhirId !== fhirId))
        .filter((g) => g.length >= 2)
    );
  }
};
```

**UI changes to the Cases tab toolbar** — add "Find Duplicates" button next to the search bar:

```tsx
<button
  onClick={scanForDuplicates}
  disabled={scanningDuplicates}
  className="flex-shrink-0 flex items-center gap-1.5 text-sm px-3 py-2 font-medium text-gray-700 border border-gray-200 hover:bg-gray-50 disabled:opacity-40 rounded-md bg-white"
>
  {scanningDuplicates ? 'Scanning...' : 'Find Duplicates'}
  {duplicateGroups.length > 0 && (
    <span className="ml-1 inline-flex items-center justify-center h-4 w-4 rounded-full bg-red-500 text-white text-xs">
      {duplicateGroups.flat().length}
    </span>
  )}
</button>
```

**Dismiss banner** (shown when duplicates are found, above the table):

```tsx
{duplicateGroups.length > 0 && (
  <div className="px-6 pb-2">
    <div className="flex items-center justify-between px-3 py-2 bg-amber-50 border border-amber-200 rounded text-sm text-amber-800">
      <span>
        {duplicateGroups.flat().length} patients across {duplicateGroups.length} duplicate group{duplicateGroups.length !== 1 ? 's' : ''} detected (same name + DOB)
      </span>
      <button onClick={() => setDuplicateGroups([])} className="text-amber-600 hover:text-amber-800 ml-4">
        Dismiss
      </button>
    </div>
  </div>
)}
```

**Per-row changes in the table:**

In the `<tr>` for each patient, add a warning badge to the name cell and a delete button in the actions cell when the patient is flagged:

```tsx
{/* Name cell — add duplicate warning badge */}
<td className="px-4 py-3">
  <button onClick={() => setDrawerPatient(p)} className="text-left">
    <div className="flex items-center gap-1.5">
      <span className="text-sm font-semibold text-indigo-600 hover:text-indigo-800">
        {p.name}
      </span>
      {duplicateFhirIds.has(p.fhirId) && (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
          Duplicate
        </span>
      )}
    </div>
    <div className="text-sm text-gray-500">
      {[p.age, p.gender?.charAt(0)].filter(Boolean).join(' ')}
    </div>
  </button>
</td>

{/* Actions cell — add delete button when flagged */}
<td className="px-4 py-3 whitespace-nowrap text-center">
  <div className="inline-flex items-center gap-1">
    {/* existing Assign and Duplicate buttons */}
    ...
    {duplicateFhirIds.has(p.fhirId) && (
      <button
        onClick={() => deletePatient(p.fhirId)}
        className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
        title="Delete duplicate"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    )}
  </div>
</td>
```

Import `Trash2` from `lucide-react` (already a project dependency).

---

## File Change Summary

| File | Change |
|------|--------|
| `package.json` | Add `@faker-js/faker` |
| `lib/services/fhir-clone-service.ts` | Add `generateFakePatientName()`, `generateFakePatientDob()` helpers; use them in `clonePatient()` |
| `app/api/fhir/patient/route.ts` | Add `DELETE` handler (admin-only; deletes from FHIR + Prisma cleanup) |
| `app/api/case-library/duplicates/route.ts` | **New file** — `GET` handler; scans for name+DOB collisions |
| `app/admin/patients/PatientLibrary.tsx` | Add `duplicateGroups` state, `scanForDuplicates`, `deletePatient`, "Find Duplicates" button, warning banner, duplicate badge per row, delete button per flagged row |

---

## Implementation Order

1. Install Faker (`package.json`)
2. Add helpers + wire into `clonePatient()` (`fhir-clone-service.ts`) — self-contained, testable
3. Add DELETE endpoint (`/api/fhir/patient`)
4. Add duplicates scan endpoint (`/api/case-library/duplicates`)
5. Update `PatientLibrary.tsx` — state, handlers, UI

---

## Notes

- `faker.person.firstName('male'|'female')` replaced the deprecated `faker.name.*` API. Use `faker.person.*` throughout (Faker v8+).
- The DOB randomizer uses `Math.random()` for the offset. The xprimarycare implementation uses Ruby's `rand()` — the same statistical approach.
- The FHIR delete SDK call (`phenomlClient.fhir.delete`) needs to be verified against the PhenoML SDK API surface before Step 4 is finalized.
- The `useMemo` for `duplicateFhirIds` requires adding `useMemo` to the React import in `PatientLibrary.tsx`.
