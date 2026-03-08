---
date: 2026-03-02T03:14:27Z
git_commit: 699279e9e7826a5af84629c18d5708cf8f4efcd6
branch: refresh-functionality
repository: xpc-emr
topic: "Refresh functionality for Labs tab and Variables panel"
tags: [research, codebase, labs, variables, refresh, fhir, data-fetching]
status: complete
last_updated: 2026-03-02
last_updated_by: claude
---

# Research: Refresh Functionality for Labs Tab and Variables Panel

**Date**: 2026-03-02T03:14:27Z
**Git Commit**: 699279e
**Branch**: refresh-functionality
**Repository**: xpc-emr

## Research Question

How do the Labs tab and Variables panel currently fetch and display data, and what refresh mechanisms exist? The goal is to understand where a refresh button would fit for:
1. Labs tab — to reload lab orders after placing a new CBC order
2. Variables panel — to re-fetch all FHIR variables with current page state

## Summary

The codebase uses **no third-party data-fetching libraries** (no SWR, no React Query). All data fetching is done with native `fetch()` triggered from `useEffect` hooks on patient change. The **Variables panel already has a refresh button** that calls `refreshVariables()` from `SidebarContext`. The **Labs tab has no refresh mechanism** — data is only fetched once when the tab mounts with a given `activePatient.fhirId`, and there is no way to re-trigger the fetch without switching patients.

## Detailed Findings

### 1. Labs Tab — Current Implementation

#### Component Location
- Main component: `components/patient/LabsTab.tsx`
- Parent/mount point: `components/layout/EditorContainer.tsx:71`
- Service layer: `lib/services/fhir-lab-service.ts`
- API route: `app/api/fhir/service-request/route.ts`
- Types: `lib/types/lab.ts`
- FHIR mapper: `lib/phenoml/fhir-mapper.ts:827-894`

#### Data Fetching (LabsTab.tsx:29-50)

Data is fetched via a `useEffect` that depends on `[activePatient?.fhirId, isFhirPatient]`:

```typescript
useEffect(() => {
  if (!isFhirPatient || !activePatient?.fhirId) {
    setLabOrders([]);
    return;
  }
  let cancelled = false;
  setStatus('loading');
  setError(null);
  searchFhirLabOrders(activePatient.fhirId).then((result) => {
    if (cancelled) return;
    if (result.error) { setError(result.error); setStatus('error'); }
    else { setLabOrders(result.labOrders); setStatus('idle'); }
  });
  return () => { cancelled = true; };
}, [activePatient?.fhirId, isFhirPatient]);
```

Key facts:
- Fires on mount and when `activePatient.fhirId` changes
- Uses a `cancelled` flag to prevent stale updates
- No re-fetch mechanism — data loads once per patient selection
- All state is local React `useState` (no context/store for lab data)
- When editing a lab order, optimistic update is applied locally; no re-fetch after save

#### State Variables (LabsTab.tsx:22-26)

| State | Type | Purpose |
|---|---|---|
| `labOrders` | `AppLabOrder[]` | All fetched lab orders |
| `status` | `SaveStatus` | `'idle' \| 'loading' \| 'saving' \| 'success' \| 'error'` |
| `error` | `string \| null` | Error message |
| `editingId` | `string \| null` | Row being edited |
| `editForm` | `Partial<AppLabOrder>` | Pending edit changes |

#### Data Flow

```
LabsTab useEffect fires
  → searchFhirLabOrders(fhirId)                  [fhir-lab-service.ts:183]
    → fetch("/api/fhir/service-request?patient=") [client-side]
      → phenomlClient.fhir.search("ServiceRequest") [service-request/route.ts]
        → Medplum FHIR server
  → mapFhirBundleToLabOrders(bundle)              [fhir-mapper.ts:881]
  → setLabOrders(result.labOrders)
```

#### Filtering (LabsTab.tsx:53-59)

- "Pending" = `status === 'draft'` or `status === 'active'`
- "Lab Results" = `status === 'completed'`
- Toggle is in `PageMetadataBar`, state owned by `EditorContainer`

#### Current Refresh Gap

There is **no way to refresh lab data** without:
- Switching to a different patient and back
- Navigating away from the Labs tab and returning (which unmounts/remounts the component, triggering a fresh useEffect)

After placing a CBC order via the AI assistant, the Labs tab will not show the new order until the component re-mounts.

---

### 2. Variables Panel — Current Implementation

#### Component Location
- Main component: `components/panels/VariablesPanel.tsx`
- Parent/mount: `components/layout/RightSidebar.tsx:158`
- State management: `lib/context/SidebarContext.tsx`
- Data builder: `lib/variable-formatters.ts`
- Types: `lib/types/variable.ts`
- Mock data: `lib/data/mock-variables.ts`

#### Data Fetching (SidebarContext.tsx:57-84)

Variables are fetched via a `useEffect` in `SidebarContext` when a patient becomes active:

```typescript
useEffect(() => {
  if (!activePatientId || !activePatient?.fhirId) return;
  if (variablesByPatient[activePatientId]) return; // Skip if already fetched
  fetchVariablesForPatient(activePatientId, activePatient.fhirId);
}, [activePatientId, activePatient?.fhirId, variablesByPatient, fetchVariablesForPatient]);
```

The `fetchVariablesForPatient` function (SidebarContext.tsx:57-70) calls `buildPatientVariables()` which fetches **15 FHIR resource types in parallel** via `Promise.all()`.

#### The 15 FHIR Resources Fetched (variable-formatters.ts:288-320)

| Variable Key | FHIR Resource | Service Function |
|---|---|---|
| `patient_info` | Patient | (from passed-in patient object) |
| `medications` | MedicationRequest | `searchFhirMedications` |
| `allergies` | AllergyIntolerance | `searchFhirAllergies` |
| `conditions` | Condition | `searchFhirConditions` |
| `vitals` | Observation | `searchFhirVitals` |
| `care_team` | CareTeam | `searchFhirCareTeamMembers` |
| `goals_of_care` | Goal | `searchFhirGoals` |
| `labs` | ServiceRequest (lab) | `searchFhirLabOrders` |
| `imaging` | ServiceRequest (imaging) | `searchFhirImagingOrders` |
| `surgical_history` | Procedure | `searchFhirProcedures` |
| `family_history` | FamilyMemberHistory | `searchFhirFamilyHistories` |
| `social_history` | Observation (social) | `searchFhirSocialHistories` |
| `referrals` | ServiceRequest (referral) | `searchFhirReferrals` |
| `tasks` | Task | `searchFhirTasks` |
| `encounters` | Encounter | `searchFhirEncounters` |
| `appointments` | Appointment | `searchFhirAppointmentsByPatient` |

Each call has a `.catch()` returning an empty array — one failure does not block others.

#### Existing Refresh Button (VariablesPanel.tsx:159-180)

The Variables panel **already has a refresh button**:

```tsx
{(lastRefreshed || variablesLoading) && (
  <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b text-xs text-gray-500">
    <span>
      {variablesLoading ? <Loader2 className="animate-spin" /> : `Updated ${formatTimeAgo(lastRefreshed)}`}
    </span>
    <button onClick={refreshVariables} disabled={variablesLoading} title="Refresh from FHIR">
      <RefreshCw size={12} className={variablesLoading ? 'animate-spin' : ''} />
    </button>
  </div>
)}
```

The `refreshVariables` function (SidebarContext.tsx:87-90):

```typescript
const refreshVariables = useCallback(() => {
  if (!activePatientId || !activePatient?.fhirId) return;
  fetchVariablesForPatient(activePatientId, activePatient.fhirId);
}, [activePatientId, activePatient?.fhirId, fetchVariablesForPatient]);
```

This bypasses the cache guard (`if (variablesByPatient[activePatientId]) return`) and always re-fetches all 15 resource types.

#### Caching Behavior

- `variablesByPatient` in SidebarContext is a `Record<string, Record<string, Variable>>` keyed by patient ID
- Initial fetch is skipped if variables already exist for that patient (line 81)
- `refreshVariables` bypasses this guard
- User-created variables (non-auto-generated) are preserved across refreshes (SidebarContext.tsx:62-65)
- The refresh bar shows "Updated Xm ago" using `lastRefreshedAt` timestamps on each variable

#### Current Refresh Behavior

The refresh button **already exists and works** for the Variables panel. When clicked, it:
1. Sets `variablesLoading = true`
2. Re-fetches all 15 FHIR resource types in parallel
3. Formats results to HTML
4. Merges auto-generated variables with user-created variables
5. Updates `variablesByPatient[activePatientId]`
6. Sets `variablesLoading = false`

The refresh bar only renders after the initial load (when `lastRefreshed` is set), showing the RefreshCw icon from Lucide.

---

### 3. Data Fetching Patterns Used Across Clinical Tabs

#### Universal Pattern (all tabs)

Every clinical tab follows the same fetch pattern:
1. Local `useState` for data + status
2. `useEffect` on `[activePatient?.fhirId]` triggers fetch
3. `cancelled` flag prevents stale updates
4. Service function calls `fetch()` to Next.js API route
5. API route calls `phenomlClient.fhir.search()` → Medplum

#### Post-Write Re-fetch Pattern

Some tabs re-fetch after a "Sync to Medplum" write:

| Component | Re-fetch after sync |
|---|---|
| `AllergiesTab.tsx:178-180` | `searchFhirAllergies` |
| `MedicalHistoryTab.tsx:177-179` | `searchFhirConditions` |
| `GoalsOfCareTab.tsx:172-174` | `searchFhirGoals` |
| `CareTeamTab.tsx:173-175` | `searchFhirCareTeamMembers` |
| `SurgicalHistoryTab.tsx:175-177` | `searchFhirProcedures` |
| `SocialHistoryTab.tsx:180-182` | `searchFhirSocialHistories` |
| `FamilyHistoryTab.tsx:280-281` | `searchFhirFamilyHistories` |

#### Optimistic Update Pattern (without re-fetch)

Other tabs use optimistic local updates after save (PUT):

| Component | Pattern |
|---|---|
| `LabsTab.tsx:76-93` | Update local state, rollback on failure |
| `VitalsTab.tsx:168-184` | Update local state, rollback on failure |
| `MedicationsTab.tsx:64-81` | Update local state, rollback on failure |
| `ImagingTab.tsx:76-94` | Update local state, rollback on failure |

These tabs **never re-fetch** — they only update local state optimistically.

---

### 4. Component Hierarchy

```
app/page.tsx
├── LeftSidebar
│   ├── PatientListPanel (patient selection)
│   ├── PatientTabList (tab navigation)
│   └── PatientSearch
├── EditorContainer (center)
│   ├── PageMetadataBar (toolbar with Pending/Results toggle for Labs)
│   └── SplitTabLayout
│       ├── [Clinical Tab Component] (left panel)
│       │   ├── LabsTab
│       │   ├── VitalsTab
│       │   ├── MedicationsTab
│       │   └── ...
│       └── NoteEditor (right panel)
└── RightSidebar (R panel)
    ├── VariablesPanel ← has refresh button
    ├── AIPanel
    ├── ChatPanel
    ├── OrdersPanel
    └── ...
```

## Code References

- `components/patient/LabsTab.tsx:29-50` — Lab data fetch useEffect
- `components/patient/LabsTab.tsx:22-26` — Lab state variables
- `components/patient/LabsTab.tsx:53-59` — Pending/results filtering
- `components/layout/EditorContainer.tsx:45-83` — Tab routing and lab view state
- `components/patient/PageMetadataBar.tsx:66-88` — Pending/Results toggle buttons
- `lib/services/fhir-lab-service.ts:183-213` — `searchFhirLabOrders` function
- `app/api/fhir/service-request/route.ts:5-43` — ServiceRequest GET handler
- `lib/phenoml/fhir-mapper.ts:827-894` — Lab FHIR mapping functions
- `components/panels/VariablesPanel.tsx:59` — Variables panel context consumption
- `components/panels/VariablesPanel.tsx:159-180` — Existing refresh button UI
- `lib/context/SidebarContext.tsx:77-90` — Variable fetch trigger + refreshVariables
- `lib/variable-formatters.ts:281-356` — buildPatientVariables (15 parallel fetches)
- `lib/context/SidebarContext.tsx:57-70` — fetchVariablesForPatient with user var merge

## Architecture Documentation

### Data Fetching Architecture

```
[Browser] ─── fetch() ───► [Next.js API Route] ─── phenomlClient ───► [PhenoML SDK] ───► [Medplum FHIR Server]
                                                        ▲
                                                        │
                                                   lib/phenoml/client.ts (singleton)
                                                   env: PHENOML_USERNAME, PHENOML_PASSWORD,
                                                        PHENOML_BASE_URL, PHENOML_FHIR_PROVIDER_ID
```

### State Management
- **No global store** (no Redux/Zustand/Jotai)
- Clinical tabs: local React `useState` (data discarded on unmount)
- Variables: `SidebarContext` with per-patient cache (`variablesByPatient`)
- Patient info: `PatientContext` with `activePatient` and `fhirId`
- No HTTP-level caching, no service workers, no IndexedDB

### Existing Refresh Pattern (Variables)
The only refresh pattern in the codebase: `refreshVariables` in `SidebarContext` bypasses the cache guard and re-fetches all FHIR data. The UI shows a RefreshCw icon with "Updated Xm ago" text.

## Related Research

- `docs/ai/research/2026-03-01-google-oauth-postgres-setup.md` — OAuth/database setup (not directly related)

## Open Questions (Resolved)

1. **Should the Labs tab refresh also update the Variables panel's `labs` variable automatically (or vice versa)?**
   → Open to either. Initial thought is no, but fine if it's not too burdensome. Will skip for now, can revisit.
2. **Should other clinical tabs (Vitals, Medications, etc.) also get refresh buttons?**
   → Yes, all clinical page tabs should have refresh buttons.
3. **Should there be a global "refresh all" mechanism vs. per-tab refresh?**
   → Good idea, but placement TBD. Start with per-tab refresh first.
