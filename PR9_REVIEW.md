# PR #9 Code Review: Patient case library, admin tools, clinician workflow, and auth hardening

**Branch:** `better-patient-library` → `main`
**Size:** ~5,500 lines added across 53 files

---

## Critical Security Issues

1. **Any authenticated user can assign patients to any other user** (`app/api/user/patients/route.ts:61-77`) — The POST endpoint now accepts a `userId` parameter to assign patients to other users, but there's **no role check**. Any logged-in user can assign patients to any other user by passing their ID. This should require admin role.

2. **Onboarding check removed from middleware** (`middleware.ts:35-53`) — The entire onboarding enforcement was deleted from middleware and moved to `app/page.tsx` only. This means **all API routes and other pages are now accessible to users who haven't completed onboarding**. Routes like `/admin`, `/api/case-library`, etc. are unprotected. The onboarding check should remain in middleware or be applied consistently.

3. **No password max length check** (`app/register/actions.ts:22`) — Validates `min(8)` but no maximum. Bcrypt truncates at 72 bytes; sending a multi-MB string causes CPU-intensive hashing (DoS vector).

4. **Admin routes only check `role === "admin"` from JWT** — The role is set at sign-in and refreshed only on `trigger === "update"`. If an admin is demoted via `/api/user/role`, their JWT still contains `role: "admin"` until it expires or they re-authenticate. Consider checking the DB on sensitive admin operations.

## Authorization & Access Control Issues

5. **`/api/patient-tags` PUT has no input sanitization on tag values** (`app/api/patient-tags/route.ts:74-88`) — Tag `values` from the request body are inserted directly into the database. While Prisma parameterizes queries (no SQL injection), there's no validation on tag length or content. An attacker could insert arbitrarily large strings.

6. **`/api/case-library/duplicate` has no rate limiting** — Patient cloning triggers many FHIR API calls (fetching + creating resources). An admin could inadvertently or maliciously trigger hundreds of clones with no throttle.

7. **`/api/user/list` exposes email, role, and institution for admins but no pagination** — If the user list grows, this endpoint returns everything in one response with no limit.

## Architecture Issues

8. **Mega route handler with `view` query param** (`app/api/case-library/route.ts`, 326 lines) — This single GET handler serves 5 different views (`users`, `user-patients`, `assignments`, `patient-encounters`, `recent-activity`). Should be split into separate route files for maintainability and testability.

9. **N+1 FHIR queries** (`app/api/case-library/route.ts`) — The `recent-activity` view fetches all patient assignments, then calls `fetchPatientEncounters()` for each unique patient individually, then `fetchPatientName()` for each. Similarly, the `users` view fetches encounters for every patient of every user. This will not scale.

10. **Encounter cloning is sequential** (`lib/services/fhir-clone-service.ts:239-274`) — When cloning a patient's encounters, each encounter and its ClinicalImpressions are cloned sequentially with `for...of` loops. For patients with many encounters, this will be very slow.

## Code Quality

11. **Debug logging left in production code** (`app/api/patient-tags/route.ts:50,53,81,89`) — Multiple `console.log` statements like `"[patient-tags] PUT called"`, `"[patient-tags] PUT body:"` should be removed before merging.

12. **`formatDateTime` in `case-status.ts`** — This is a utility function that doesn't belong in a constants file. It also hardcodes `America/New_York` timezone.

13. **Provider duplication persists** (`auth.config.ts` + `auth.ts`) — Same issue from PR #8: Google and Credentials providers are defined in both files.

## Data Integrity

14. **Patient tag replacement is not transactional** (`app/api/patient-tags/route.ts:71-88`) — The delete + create for each category is not wrapped in a `prisma.$transaction()`. If the create fails after the delete, tags are lost.

15. **No validation that `clinicianIds` in assign endpoint are actual clinicians** (`app/api/case-library/assign/route.ts:40`) — The assignment endpoint doesn't verify that target users exist, are onboarded, or have appropriate roles.

## UX / Frontend

16. **Large component files** — `CaseLibraryPanel.tsx` (617 lines) and `PatientLibrary.tsx` (587 lines) would benefit from decomposition.

---

## Summary

| Severity | Count | Key Items |
|----------|-------|-----------|
| **Critical** | 3 | Missing authz on patient assignment, onboarding bypass, no password max |
| **High** | 3 | JWT role staleness, no rate limit on cloning, tag replacement not transactional |
| **Medium** | 5 | N+1 queries, mega route handler, debug logs, no input limits on tags, no clinician validation |
| **Low** | 4 | Code organization, hardcoded timezone, provider duplication, large components |

**Recommendation:** This PR should **not be merged** until at minimum:
1. The patient assignment POST endpoint gets an admin role check for assigning to other users
2. The onboarding enforcement is restored for all routes (not just `page.tsx`)
3. Debug `console.log` statements are removed

Given the PR's size (53 files, ~5,500 lines), also consider splitting into smaller, reviewable chunks.
