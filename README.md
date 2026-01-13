# XPC EMR - Educational Medical Record System

A simulated Electronic Medical Record (EMR) system built with Next.js, React, TypeScript, and Tailwind CSS for educational purposes.

## Features

- **Patient Management**: Multi-patient tabs with browser-like navigation
- **Document System**: Hierarchical pages with drag-and-drop reordering
- **Rich Text Editor**: Content-editable documents with auto-save
- **Variables & Templates**: Reusable text snippets and note templates
- **Orders Panel**: Command-based order entry system
- **AI Assistant**: Mock AI chat interface for patient queries
- **Data Persistence**: LocalStorage-based with pluggable architecture

## Tech Stack

- **Framework**: Next.js 14+ with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS + shadcn/UI components
- **State Management**: TanStack Query for server state, React hooks for UI state
- **Data Layer**: Repository pattern (localStorage now, API-ready)
- **Icons**: Lucide React
- **Drag & Drop**: @dnd-kit

## Getting Started

### Prerequisites

- Node.js 18+ and npm

### Installation

```bash
# Install dependencies
npm install
```

### Development

```bash
# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build

```bash
# Build for production
npm run build

# Start production server
npm start
```

## Project Structure

```
xpc-emr-next/
├── app/                    # Next.js app router pages
├── components/
│   ├── ui/                 # shadcn/UI components
│   ├── layout/             # Layout components (TopBar, Sidebars)
│   ├── patient/            # Patient management components
│   ├── editor/             # Rich text editor components
│   ├── sidebar/            # Document navigation components
│   └── panels/             # Right sidebar panels
├── data/
│   ├── repositories/       # Data access layer (pluggable)
│   └── seed-data.ts        # Sample patient data
├── hooks/                  # TanStack Query hooks
├── lib/
│   ├── types.ts            # TypeScript domain models
│   └── utils.ts            # Utility functions
└── providers/              # React context providers
```

## Data Architecture

The application uses a **repository pattern** for data persistence:

- **Current**: `LocalStorageRepository` stores data in browser localStorage
- **Future**: Swap to `APIRepository` by changing one import
- All components use TanStack Query hooks, making them backend-agnostic

### Sample Data

The app initializes with a sample patient (John Doe) including:
- Pre-populated pages (Summary, Patient Info, Medications, etc.)
- Sample encounter notes
- Example variables (meds, care team, allergies)

## Key Features

### Patient Tabs
- Browser-like tabs for multiple patients
- Add/close/switch between patients
- Patient demographics (name, age, sex, MRN)

### Document Navigation
- Hierarchical page structure with parent/child relationships
- Drag-and-drop reordering
- Collapsible sections (Pages, Encounters, Tasks)
- Context menu actions (rename, delete, duplicate, star, etc.)
- Special page types: Encounters (visits) and Tasks

### Rich Text Editor
- Auto-saving content (1-second debounce)
- Sticky patient summary header
- Variable autocomplete (@ trigger - planned)
- Selection toolbar for creating variables (planned)

### Right Sidebar Panels

1. **Orders Panel**: Command-style order entry
   - Detects order type (labs, referrals, prescriptions, scheduling)
   - Visual categorization with icons and colors

2. **Variables Panel**: Reusable text snippets (per-patient)
   - Create, edit, delete variables
   - Pin important variables
   - Insert into documents

3. **Templates Panel**: Reusable note templates (global)
   - Create, edit, delete templates
   - Pin frequently-used templates
   - Insert into documents

4. **AI Panel**: Mock AI assistant
   - Chat interface for patient queries
   - Simulated responses (integrate real AI in production)

## Development Notes

### Adding a Backend

To add a real backend:

1. Create `APIRepository` in `data/repositories/api.ts`:
```typescript
export class APIRepository implements IEMRRepository {
  async getPatients() {
    const res = await fetch('/api/patients');
    return res.json();
  }
  // ... implement other methods
}
```

2. Update `data/repositories/index.ts`:
```typescript
import { APIRepository } from './api';
repositoryInstance = new APIRepository();
```

3. Create Next.js API routes in `app/api/`

### Custom Styling

Additional styles are in `app/globals.css`. The app uses Tailwind CSS with shadcn/UI components for consistent design.

## License

MIT - Educational purposes only

## Credits

Based on the XPC EMR HTML prototype, reimplemented as a modern React/Next.js application.
