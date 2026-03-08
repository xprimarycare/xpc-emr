---
date: "2026-03-01T23:10:44Z"
git_commit: 699279e9e7826a5af84629c18d5708cf8f4efcd6
branch: googleauth
repository: pineapplej
topic: "Google OAuth Login with PostgreSQL and Docker Compose"
tags: [research, codebase, authentication, google-oauth, postgresql, docker, user-management]
status: complete
last_updated: "2026-03-01"
last_updated_by: claude
---

# Research: Google OAuth Login with PostgreSQL and Docker Compose

**Date**: 2026-03-01T23:10:44Z
**Git Commit**: 699279e9e7826a5af84629c18d5708cf8f4efcd6
**Branch**: googleauth
**Repository**: pineapplej

## Research Question

We want to create login for user via Google email, store user details in PostgreSQL 17.4 (via Docker Compose), and create a Google app in GCP to support Google login.

## Summary

The pineapplej project is a **Next.js 16 (App Router)** EMR application using TypeScript and React 19. It currently has **no authentication**, **no database**, and **no Docker configuration**. All data is handled via external FHIR APIs (PhenoML/Medplum). The application loads directly into the EMR interface with no login gate. Adding Google OAuth + PostgreSQL will be an entirely net-new implementation.

## Detailed Findings

### Current Authentication State

There is **zero authentication** in the codebase:

- No `next-auth`, `passport`, JWT, session, or OAuth packages in `package.json`
- No `/api/auth/*` routes exist
- No `middleware.ts` file exists (no route protection)
- No login page or component exists
- The app root at `app/page.tsx` renders the EMR interface directly
- The root layout at `app/layout.tsx` wraps the app in 3 context providers (`PatientProvider`, `EditorProvider`, `SidebarProvider`) — none related to auth

The only "identity" concept is a static practitioner defined via environment variables:
- `NEXT_PUBLIC_FHIR_PRACTITIONER_ID` — hardcoded FHIR ID
- `NEXT_PUBLIC_PRACTITIONER_NAME` — hardcoded display name

### Current Database State

There is **no database** in the project:

- No ORM (Prisma, Drizzle, Sequelize, TypeORM, Knex) in dependencies
- No `pg`, `mysql2`, `better-sqlite3`, or any database driver
- No database connection strings in environment variables
- All persistence is delegated to the external Medplum FHIR server via PhenoML SDK
- In-app state is ephemeral React state (resets on reload)
- One in-memory `Map` exists as a cache in `app/api/ai-assistant/chat/route.ts:66-67`

### Current Docker State

**No Docker configuration exists:**
- No `Dockerfile` or `docker-compose.yml`
- No `.dockerignore`

### Current Environment Variables

Defined in `.env.local.example`:

| Variable | Purpose |
|---|---|
| `PHENOML_USERNAME` | PhenoML SDK credential |
| `PHENOML_PASSWORD` | PhenoML SDK credential |
| `PHENOML_BASE_URL` | PhenoML API URL |
| `PHENOML_FHIR_PROVIDER_ID` | FHIR provider ID |
| `NEXT_PUBLIC_FHIR_PRACTITIONER_ID` | Practitioner FHIR ID (client-side) |
| `CHART_REVIEW_API_URL` | Chart Review API URL |
| `CHART_REVIEW_API_SECRET` | Chart Review API key |
| `NEXT_PUBLIC_PRACTITIONER_NAME` | Practitioner display name (client-side) |
| `GOOGLE_CLOUD_PROJECT` | GCP project for Vertex AI |
| `GOOGLE_CLOUD_LOCATION` | GCP region for Vertex AI |

### Existing GCP Integration

The project already uses Google Cloud:
- `@google-cloud/vertexai` package for AI assistant (Gemini 2.5 Flash)
- `GOOGLE_CLOUD_PROJECT` and `GOOGLE_CLOUD_LOCATION` env vars configured
- This means a GCP project already exists, which can be reused for Google OAuth

### Project Structure Relevant to Implementation

```
app/
├── layout.tsx          # Root layout — auth provider would wrap here
├── page.tsx            # Main EMR page — needs auth protection
├── api/                # API routes — need auth middleware
│   ├── ai-assistant/
│   ├── chart-review/
│   └── fhir/           # 15+ FHIR resource endpoints
lib/
├── context/            # React contexts — auth context would live here
├── types/              # TypeScript types — user type would go here
├── services/           # Service modules
components/             # UI components — login page components needed
```

## Code References

- `package.json` — Dependencies (no auth/DB packages)
- `app/layout.tsx:23-43` — Root layout with context providers
- `app/page.tsx:7-19` — Root page (no auth gate)
- `lib/phenoml/client.ts:13-17` — PhenoML client (service credentials pattern)
- `app/api/ai-assistant/chat/route.ts:447-449` — GCP project/location usage
- `.env.local.example` — All current environment variables

## Architecture Documentation

### Current Patterns

1. **API Routes**: Next.js Route Handlers in `app/api/*/route.ts` — each exports HTTP method functions (`GET`, `POST`, `PUT`, `DELETE`)
2. **Service Layer**: Thin service modules in `lib/services/` wrap PhenoML SDK calls
3. **Context Providers**: React Context in `lib/context/` for shared state (`PatientContext`, `EditorContext`, `SidebarContext`)
4. **Environment Config**: Server-only secrets in `process.env`, client-side values prefixed with `NEXT_PUBLIC_`
5. **Type Definitions**: One file per domain in `lib/types/`

### Implications for New Features

- Auth provider should wrap at the `app/layout.tsx` level, outside existing providers
- A `middleware.ts` at the project root is needed to protect routes
- New API routes will follow the existing `app/api/` pattern
- New types go in `lib/types/`, new context in `lib/context/`
- The existing `GOOGLE_CLOUD_PROJECT` suggests a GCP project is already set up

## Related Research

No prior research documents exist. The `docs/ai/` directory was created for this research.

## Open Questions

1. Should the existing `GOOGLE_CLOUD_PROJECT` GCP project be reused for OAuth credentials, or should a separate project be created?
2. What user information beyond Google email should be stored (name, avatar, role)?
3. Should existing API routes be protected, or only new ones?
4. Is there a need for role-based access control (admin vs. regular user)?
5. Should the practitioner identity (`NEXT_PUBLIC_PRACTITIONER_NAME`, `NEXT_PUBLIC_FHIR_PRACTITIONER_ID`) be linked to the authenticated user?
