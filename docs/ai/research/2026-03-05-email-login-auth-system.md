---
date: 2026-03-05T12:00:00-05:00
git_commit: 456f946
branch: patient-case-library
repository: xpc-emr
topic: "Email login capability and current authentication system"
tags: [research, codebase, authentication, email-login, next-auth, google-oauth]
status: complete
last_updated: 2026-03-05
last_updated_by: claude
---

# Research: Email Login Capability and Current Authentication System

**Date**: 2026-03-05
**Git Commit**: 456f946
**Branch**: patient-case-library
**Repository**: xpc-emr

## Research Question

How does the current authentication system work, and what would be needed to support email-based login as a secondary (non-prominent) option alongside Google OAuth — primarily for testing purposes?

## Summary

The app uses **NextAuth v5 (beta 30)** with **Google OAuth** as the sole authentication provider. Authentication is JWT-based (no database sessions). The `PrismaAdapter` handles user/account creation in PostgreSQL. The User model has an `email` field but **no password field** — email/password login would require a schema change. NextAuth v5 supports a `Credentials` provider out of the box, which can be added alongside the existing Google provider without disrupting the current flow.

## Detailed Findings

### 1. Auth Configuration Layer

Two config files split auth setup between Edge Runtime (middleware) and Node.js (server):

- [auth.config.ts](auth.config.ts) — Edge-safe config used by middleware. Contains only the Google provider, custom `/login` page path, JWT session strategy, and a session callback that maps token fields to `session.user`. No DB access.

- [auth.ts](auth.ts) — Full server-side config. Spreads `auth.config`, adds the `PrismaAdapter`, and defines `jwt` + `session` callbacks that fetch user data from the DB on sign-in or explicit `update` trigger. Exports `handlers`, `signIn`, `signOut`, and `auth`.

**Current providers** (auth.config.ts:9-13):
```ts
providers: [
  Google({
    clientId: process.env.AUTH_GOOGLE_ID,
    clientSecret: process.env.AUTH_GOOGLE_SECRET,
  }),
],
```

Only Google OAuth is configured. No Credentials provider exists.

### 2. Login UI

- [app/login/page.tsx](app/login/page.tsx) — Server component that redirects authenticated users to `/`. Renders a centered card with the app title "XPC EMR" and the `LoginForm`.

- [app/login/LoginForm.tsx](app/login/LoginForm.tsx) — Client component with a single "Sign in with Google" button that calls `signIn('google', { callbackUrl })`. Handles `callbackUrl` from search params with origin validation. Shows error messages for `OAuthAccountNotLinked` and generic errors.

The UI is a single-button login page — no email/password form exists.

### 3. Middleware (Route Protection)

[middleware.ts](middleware.ts) — Uses the Edge-safe `auth.config.ts` to protect all routes except `/login` and `/api/auth`. Unauthenticated page requests redirect to `/login` with a `callbackUrl` param. Unauthenticated API requests return `401 JSON`. After auth, checks `onboardingComplete` and redirects to `/onboarding` if needed.

### 4. Database Schema (User & Account)

**User model** (`prisma/schema.prisma`, table `users`):

| Field | Type | Notes |
|---|---|---|
| id | String | CUID primary key |
| name | String? | Display name |
| email | String | **@unique** — required |
| emailVerified | DateTime? | Standard NextAuth field |
| image | String? | Profile image URL |
| institution | String? | User's institution |
| npi | String? | National Provider Identifier |
| fhirPractitionerId | String? | FHIR resource ID |
| role | String | Default `"user"` |
| onboardingComplete | Boolean | Default `false` |
| createdAt | DateTime | Auto-set |
| updatedAt | DateTime | Auto-updated |

**No password or hashedPassword field exists.** Email/password login would require adding one.

**Account model** (`prisma/schema.prisma`, table `accounts`):
Standard NextAuth OAuth account model with `provider`, `providerAccountId`, token fields. Composite unique on `[provider, providerAccountId]`. Cascading delete from User.

**No Session or VerificationToken models exist** — consistent with JWT-only strategy.

### 5. Auth Helpers & Context

- [lib/auth-helpers.ts](lib/auth-helpers.ts) — Server-side `requireAuth()` returns either a `Session` or a `401 NextResponse`. Used by API routes.

- [lib/context/AuthContext.tsx](lib/context/AuthContext.tsx) — Client-side `AuthProvider` wraps `SessionProvider` from `next-auth/react`. Exports `useAuth()` hook with `user`, `isAuthenticated`, `isLoading` fields.

### 6. API Route Handler

[app/api/auth/[...nextauth]/route.ts](app/api/auth/[...nextauth]/route.ts) — Exports `GET` and `POST` from `handlers` (from `auth.ts`). Standard NextAuth catch-all route.

### 7. Session Strategy

JWT-based. Declared in both `auth.config.ts:19` and `auth.ts:35`:
```ts
session: { strategy: "jwt" }
```
The `jwt` callback in `auth.ts:38-68` enriches the token with DB fields (`institution`, `npi`, `fhirPractitionerId`, `onboardingComplete`, `role`) on sign-in or explicit update. The `session` callback maps these token fields to `session.user`.

### 8. Package Versions

| Package | Version |
|---|---|
| next-auth | ^5.0.0-beta.30 |
| @auth/prisma-adapter | ^2.11.1 |
| @prisma/client | ^7.4.2 |

No password hashing libraries (bcrypt, argon2, etc.) are currently installed.

### 9. Environment Variables (Auth-Related)

From `.env.local.example`:
- `AUTH_SECRET` — Auth.js signing secret
- `AUTH_GOOGLE_ID` — Google OAuth client ID
- `AUTH_GOOGLE_SECRET` — Google OAuth client secret

No email/password-related env vars exist.

## Code References

- `auth.config.ts:9-13` — Google provider configuration
- `auth.ts:30-80` — NextAuth instance with PrismaAdapter and callbacks
- `app/login/LoginForm.tsx:29-36` — Google sign-in button (sole login method)
- `app/login/page.tsx:1-24` — Login page layout
- `middleware.ts:7-52` — Route protection and onboarding check
- `lib/auth-helpers.ts:9-20` — Server-side `requireAuth()` helper
- `lib/context/AuthContext.tsx:21-39` — Client-side `useAuth()` hook
- `prisma/schema.prisma:10-28` — User model (no password field)
- `prisma/schema.prisma:30-48` — Account model (OAuth accounts)

## Architecture Documentation

### Current Auth Flow
1. User visits any protected route → middleware redirects to `/login`
2. User clicks "Sign in with Google" → NextAuth Google OAuth flow
3. On first sign-in, PrismaAdapter creates User + Account records in PostgreSQL
4. JWT callback enriches token with DB fields (role, onboarding status, etc.)
5. Session callback maps token → `session.user` for both Edge and server use
6. If `onboardingComplete` is false → middleware redirects to `/onboarding`
7. Client components access session via `useAuth()` hook (wraps `useSession`)

### Key Architecture Decisions
- **Split config**: `auth.config.ts` (Edge-safe, no DB) vs `auth.ts` (full, with Prisma)
- **JWT strategy**: No database sessions; all session data in JWT token
- **PrismaAdapter**: Handles user creation/linking but not session persistence
- **No VerificationToken model**: Email verification not implemented at DB level

### What Would Be Needed for Email Login
Based on the current architecture, adding a non-prominent email login would involve:

1. **Schema**: Add `hashedPassword String?` to User model (nullable so Google-only users aren't affected)
2. **Package**: Install `bcryptjs` (or similar) for password hashing
3. **Provider**: Add NextAuth `Credentials` provider in `auth.config.ts` that validates email+password against the DB
4. **UI**: Add a small email/password form to `LoginForm.tsx` below the Google button (or behind a "Use email instead" link to keep it non-prominent)
5. **Seed/Register**: A way to create email-based test accounts (could be a seed script or a minimal registration endpoint)

The Credentials provider does **not** use the PrismaAdapter for account creation (it's a direct authorize callback), so the existing Account model stays untouched. The JWT/session callbacks would work identically since they key on `user.id`.

## Related Research
- [2026-03-01-google-oauth-postgres-setup.md](2026-03-01-google-oauth-postgres-setup.md) — Original research for adding Google OAuth + PostgreSQL to the app

## Open Questions
- Should email-login test accounts be created via a seed script, a CLI command, or a minimal `/register` page?
- Should email login be restricted to specific emails or a `NODE_ENV=development` check?
- Is email verification needed for test accounts, or is it acceptable to skip it?
