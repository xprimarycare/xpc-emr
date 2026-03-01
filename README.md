# XPC EMR - Electronic Medical Records System

A full-stack Electronic Medical Records (EMR) system built with Next.js, React, and TypeScript. Features FHIR-integrated clinical data management, AI-powered clinical assistance via Google Vertex AI, and a Google Docs-style document editor.

## Overview

XPC EMR (Pineapple J) is a modern EHR platform designed for healthcare providers. It combines multi-patient management, a hierarchical document editor, 17+ clinical data tabs with Medplum FHIR integration, and an AI assistant for clinical decision support.

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript 5
- **UI:** React 19, Tailwind CSS 4, shadcn/ui, Lucide React
- **AI:** Google Vertex AI (Gemini 2.5 Flash)
- **EHR Integration:** PhenoML SDK + Medplum FHIR server
- **State Management:** React Context API
- **Other:** react-resizable-panels, react-markdown, @floating-ui/react, @huggingface/transformers

## Features

### Clinical Tabs (FHIR-Integrated)

Each tab reads from and writes back to a Medplum FHIR server via PhenoML:

- Patient Info & Demographics
- Medical History / Surgical History
- Medications / Allergies
- Labs / Imaging / Vitals
- Care Team / Encounters / Tasks
- Referrals / Appointments
- Family History / Social History
- Goals of Care

### Document Editor

- Google Docs-style contentEditable rich text editor
- Sticky patient summary header
- Hierarchical sidebar with Pages, Encounters, and Tasks sections
- Star, rename, drag & drop reorder, and context menu actions on pages
- Collapsible sections with search filtering

### Variables & Templates

- **@-mention autocomplete** — type `@` to insert predefined variables (medications, care team, allergies, vitals, PMH)
- **#template system** — reusable SOAP notes, follow-up visits, HPI templates
- Pin/unpin favorites with visual indicators
- Full CRUD for both variables and templates

### Orders Panel

- Natural language command input (e.g., `order CBC, CMP`, `rx metformin 500mg bid`, `refer to cardiology`)
- Smart parsing to auto-detect order type
- Pending actions queue with management

### AI Assistant

- Chat interface powered by Google Gemini 2.5 Flash via Vertex AI
- Patient-context-aware responses — fetches FHIR data before answering
- Quick suggestion buttons for common queries (medications, visits, care gaps, labs)
- Message history with timestamps

### Chart Review

- External API integration for chart analysis
- Dedicated chart review panel

### Right Sidebar Panels

- Orders, Variables, Templates, AI Assistant
- Chat, Calendar, Chart Review, Patient List
- Lab, Medication, and Referral preview panels
- Collapsible with icon-only tab navigation

### Multi-Patient Management

- Patient tabs with avatar badges
- Patient search and prefill via PhenoML
- Editable patient summary displayed across all pages
- Automatic age/sex calculation

## Project Structure

```
app/
├── layout.tsx                    # Root layout with context providers
├── page.tsx                      # Main EMR editor page
├── globals.css                   # Global styles
└── api/
    ├── ai-assistant/chat/        # Vertex AI chat endpoint
    ├── chart-review/             # Chart review API
    └── fhir/                     # 21 FHIR resource API routes
        ├── patient/
        ├── medication/
        ├── encounter/
        ├── condition/
        ├── allergy/
        ├── observation/
        ├── task/
        ├── care-team/
        ├── goal/
        ├── referral/
        ├── appointment/
        ├── procedure/
        ├── social-history/
        ├── family-history/
        ├── service-request/
        ├── communication/
        ├── clinical-impression/
        ├── lang2fhir/
        └── construe/semantic/
components/
├── layout/                       # TopBar, LeftSidebar, RightSidebar, EditorContainer, SplitTabLayout
├── editor/                       # RichTextEditor, PatientSummaryHeader, VariableAutocomplete
├── patient/                      # 24+ clinical tab components (MedicationsTab, AllergiesTab, LabsTab, etc.)
├── panels/                       # 11 right sidebar panels (AIPanel, OrdersPanel, ChartReviewPanel, etc.)
├── sidebar/                      # SidebarSection, TabItem, TabContextMenu
└── ui/                           # shadcn/ui components
lib/
├── context/                      # PatientContext, EditorContext, SidebarContext
├── types/                        # 23 TypeScript type definitions (patient, fhir, medication, etc.)
├── services/                     # 15 service files (AI, chart review, 13 FHIR resource services)
├── phenoml/                      # PhenoML client + FHIR Bundle mappers
├── data/                         # Mock data and defaults
├── hooks/                        # Custom hooks (useWhisper)
├── workers/                      # Web Workers (whisper-worker)
└── utils.ts                      # Utility functions
```

## Architecture

### Data Flow

```
Clinical Tab → FHIR Service → Next.js API Route → PhenoML Client → Medplum FHIR Server
                                                                          ↓
Clinical Tab ← FHIR Mapper ← ──────────────────────────── FHIR Bundle ←──┘
```

### State Management

- **PatientContext** — multi-patient CRUD, tab management, drag & drop reordering
- **EditorContext** — active tab tracking, section collapse state, search, content cache, sidebar visibility
- **SidebarContext** — right panel state, variables/templates/orders management, chart review content

## Getting Started

### Prerequisites

- Node.js 18+
- npm, yarn, pnpm, or bun
- Google Cloud project with Vertex AI enabled (for AI assistant)
- PhenoML account with Medplum FHIR provider configured

### Installation

```bash
git clone git@github.com:xprimarycare/xpc-emr.git
cd xpc-emr
npm install
```

### Environment Variables

Copy `.env.local.example` to `.env.local` and configure:

See example file for details.

### Development

```bash
npm run dev      # Start dev server at http://localhost:3000
npm run build    # Production build
npm start        # Start production server
npm run lint     # Run ESLint
```

## License

This project is licensed under the MIT License.

## About

XPC EMR is developed by Paulius Mui and Misha Manulis to modernize medical documentation workflows and bring joy to the practice of medicine. ❤️ Primary Care
