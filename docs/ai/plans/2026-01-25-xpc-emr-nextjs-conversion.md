# XPC EMR to Next.js Conversion Implementation Plan

## Overview

Convert the standalone HTML-based XPC EMR document editor (`xpc-emr-simple.html`, ~7000 lines) into a Next.js application with React components, TypeScript types, and mock data for the pineapplej project.

## Current State Analysis

### Source File: `xpc-emr-simple.html`
A single-file EMR (Electronic Medical Records) document editor with:
- Multi-patient management via tabs
- Hierarchical document pages (Pages/Encounters/Tasks sections)
- Google Docs-style rich text editor with contentEditable
- Variable system with @-mention autocomplete
- Orders panel for labs/referrals/prescriptions
- Right sidebar with panel switching

### Target Project: `pineapplej`
A freshly initialized Next.js project with:
- Next.js 16.1.4, React 19.2.3
- TypeScript with strict mode
- Tailwind CSS v4 configured via PostCSS
- shadcn/ui integration (components.json configured)
- Existing Button component in `components/ui/button.tsx`
- lucide-react for icons
- Path alias: `@/*` maps to root

### Key Files to Modify:
- `app/page.tsx` - Replace boilerplate with EMR app
- `app/layout.tsx` - Add context providers
- `app/globals.css` - Add EMR-specific styles

## Desired End State

A functional Next.js EMR application where:
1. Users can view/switch between patient tabs in the header
2. Left sidebar shows collapsible Pages/Encounters/Tasks sections
3. Clicking a tab loads its content in the main editor
4. Editor has a sticky patient summary header + rich text area
5. Right sidebar toggles with Orders/Variables/Templates panels
6. @-mention autocomplete works for inserting variables
7. Orders can be entered and displayed

### Verification:
- `npm run build` completes without errors
- `npm run dev` starts the dev server
- UI matches the original HTML layout and functionality

## What We're NOT Doing

- Drag-and-drop tab reordering
- Timeline view
- Analytics view (Screenings, Biomarkers, HEDIS, etc.)
- AI query panel
- Context menu actions (star, duplicate, delete)
- Keyboard shortcuts
- Selection toolbar (create variable from selection)
- Templates editing/creation
- Data persistence (all in-memory)

## Implementation Approach

Build incrementally in 6 phases:
1. Types & Data Layer - TypeScript interfaces + mock data
2. State Management - React Contexts for patient/editor/sidebar state
3. Layout Shell - Main app structure with sidebars
4. Editor Components - Rich text editor + variable autocomplete
5. Panel Components - Orders and Variables panels
6. Integration & Styling - Wire everything together, polish CSS

---

## Phase 1: Types & Data Layer

### Overview
Define TypeScript interfaces matching the HTML's data structures and create mock data.

### Changes Required:

#### 1. Create Type Definitions

**File**: `lib/types/patient.ts`
- Patient interface: id, name, mrn, dob, sex, avatar
- PatientData interface: tabs, summary, variables

**File**: `lib/types/tab.ts`
- Tab interface: id, name, content, parentId, isSubtab, expanded, starred, isVisit, isTask, visitDate
- TabSection type: 'pages' | 'encounters' | 'tasks'

**File**: `lib/types/variable.ts`
- Variable interface: content, isPinned?, icon?
- VariableMap type: Record<string, Variable | string>

**File**: `lib/types/order.ts`
- OrderType: 'labs' | 'referral' | 'rx' | 'schedule'
- Order interface: id, type, text, icon

**File**: `lib/types/index.ts`
- Re-export all types

#### 2. Create Mock Data

**File**: `lib/data/mock-patients.ts`
- SAMPLE_TABS: Array of 14 tabs (12 regular pages + 2 encounters)
- SAMPLE_VARIABLES: meds, careteam, allergies with HTML content
- SAMPLE_PATIENT: John Doe patient object
- SAMPLE_PATIENT_DATA: Combined patient data

**File**: `lib/data/index.ts`
- Re-export all data

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles without errors: `npx tsc --noEmit`
- [ ] Lint passes: `npm run lint`

#### Manual Verification:
- [ ] Types can be imported in other files
- [ ] Mock data structure matches original HTML's data model

---

## Phase 2: State Management (Context)

### Overview
Create React Contexts to manage patient state, editor state, and sidebar state.

### Changes Required:

#### 1. Patient Context
**File**: `lib/context/PatientContext.tsx`
- State: patients array, activePatientId, patientData Map
- Actions: setActivePatient, addPatient, removePatient, updatePatientData
- Helper: getActivePatientData

#### 2. Editor Context
**File**: `lib/context/EditorContext.tsx`
- State: activeTabId, collapsedSections Set, searchQuery
- Actions: setActiveTab, toggleSection, setSearchQuery

#### 3. Sidebar Context
**File**: `lib/context/SidebarContext.tsx`
- State: leftSidebarCollapsed, rightSidebarCollapsed, activePanel, orders
- Actions: toggleLeftSidebar, toggleRightSidebar, setActivePanel, addOrder, removeOrder

#### 4. Export Contexts
**File**: `lib/context/index.ts`

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles: `npx tsc --noEmit`
- [ ] Lint passes: `npm run lint`

#### Manual Verification:
- [ ] Contexts can be imported and used in components

---

## Phase 3: Layout Shell

### Overview
Create the main app layout with top bar, left sidebar, editor container, and right sidebar.

### Changes Required:

#### 1. Top Bar Component
**File**: `components/layout/TopBar.tsx`
- Menu toggle button (toggles left sidebar)
- PatientTabList component
- Search input
- Panel toggle button (toggles right sidebar)

#### 2. Patient Tab Components
**File**: `components/patient/PatientTab.tsx`
- Individual patient tab with avatar, name, age/sex
- Active state styling
- Close button (only if multiple patients)

**File**: `components/patient/PatientTabList.tsx`
- Container for patient tabs
- Add patient button

**File**: `components/patient/index.ts`

#### 3. Left Sidebar
**File**: `components/layout/LeftSidebar.tsx`
- Collapsible with transition
- Contains SidebarSection components for Pages, Encounters, Tasks

#### 4. Right Sidebar
**File**: `components/layout/RightSidebar.tsx`
- Collapsible with transition
- Panel tabs (Orders/Variables/Templates icons)
- Renders active panel component

#### 5. Editor Container
**File**: `components/layout/EditorContainer.tsx`
- PatientSummaryHeader
- RichTextEditor in scrollable area

#### 6. Layout Index
**File**: `components/layout/index.ts`

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles: `npx tsc --noEmit`
- [ ] Lint passes: `npm run lint`

#### Manual Verification:
- [ ] Components render without errors

---

## Phase 4: Editor Components

### Overview
Create the patient summary header, rich text editor, and variable autocomplete.

### Changes Required:

#### 1. Patient Summary Header
**File**: `components/editor/PatientSummaryHeader.tsx`
- Sticky positioned div
- ContentEditable for one-liner text
- Syncs with patient data on change
- Note: Uses contentEditable with trusted internal content only (not user-submitted HTML)

#### 2. Rich Text Editor with Variable Autocomplete
**File**: `components/editor/RichTextEditor.tsx`
- ContentEditable div
- Loads content when tab changes
- Saves content on input
- Detects @-mention pattern for autocomplete
- Note: Content is internal mock data only (not user-submitted HTML)

#### 3. Variable Autocomplete
**File**: `components/editor/VariableAutocomplete.tsx`
- Positioned dropdown
- Keyboard navigation (up/down/enter/tab/escape)
- Filters variables by query
- Inserts content on selection

#### 4. Editor Index
**File**: `components/editor/index.ts`

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles: `npx tsc --noEmit`
- [ ] Lint passes: `npm run lint`

#### Manual Verification:
- [ ] Editor shows content when switching tabs
- [ ] @-mention triggers autocomplete dropdown
- [ ] Selecting a variable inserts its content

---

## Phase 5: Sidebar & Panel Components

### Overview
Create the sidebar section components and right panel components (Orders, Variables, Templates).

### Changes Required:

#### 1. Sidebar Section
**File**: `components/sidebar/SidebarSection.tsx`
- Collapsible section with icon, title, add button, chevron
- Maps over tabs to render TabItem components

#### 2. Tab Item
**File**: `components/sidebar/TabItem.tsx`
- Icon based on type (file, calendar, check)
- Name with truncation
- Visit date badge for encounters
- Active state styling

#### 3. Sidebar Index
**File**: `components/sidebar/index.ts`

#### 4. Orders Panel
**File**: `components/panels/OrdersPanel.tsx`
- Textarea for command input
- Parse commands: order/labs, refer, rx, schedule
- Display pending orders with confirm/cancel buttons
- Empty state

#### 5. Variables Panel
**File**: `components/panels/VariablesPanel.tsx`
- List of variables with name and preview
- Pin button (visual only for MVP)
- Insert button
- Add Variable button

#### 6. Templates Panel
**File**: `components/panels/TemplatesPanel.tsx`
- Empty state placeholder
- Add Template button

#### 7. Panels Index
**File**: `components/panels/index.ts`

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles: `npx tsc --noEmit`
- [ ] Lint passes: `npm run lint`

#### Manual Verification:
- [ ] Sidebar sections collapse/expand
- [ ] Clicking tab items switches the active tab
- [ ] Orders panel accepts commands and displays orders
- [ ] Variables panel shows available variables

---

## Phase 6: Integration & Styling

### Overview
Wire everything together in the main page and add EMR-specific styles.

### Changes Required:

#### 1. Update Root Layout
**File**: `app/layout.tsx`
- Wrap children with PatientProvider, EditorProvider, SidebarProvider
- Update metadata title to "XPC EMR"

#### 2. Create Main Page
**File**: `app/page.tsx`
- Full height flex container
- TopBar at top
- Flex row with LeftSidebar, EditorContainer, RightSidebar

#### 3. Add EMR Styles to globals.css
**File**: `app/globals.css` (append to existing content)
- Editor placeholder styling
- Scrollbar styling
- Variable tag styling
- Sidebar transitions

### Success Criteria:

#### Automated Verification:
- [ ] Build succeeds: `npm run build`
- [ ] Dev server starts: `npm run dev`
- [ ] Lint passes: `npm run lint`
- [ ] TypeScript compiles: `npx tsc --noEmit`

#### Manual Verification:
- [ ] Open http://localhost:3000
- [ ] Patient tabs render in header with sample patient "John Doe"
- [ ] Left sidebar shows Pages (12 items), Encounters (2 items), Tasks (0 items)
- [ ] Clicking section headers collapses/expands them
- [ ] Clicking a page tab updates the editor content
- [ ] Patient summary header is editable
- [ ] Main editor area is editable
- [ ] Typing "@" in editor shows variable autocomplete
- [ ] Selecting a variable inserts its content
- [ ] Right sidebar toggle button opens/closes sidebar
- [ ] Panel tabs switch between Orders/Variables/Templates
- [ ] Orders panel accepts command input
- [ ] Content persists when switching between tabs

---

## Testing Strategy

### Unit Tests (future):
- Context state updates
- Order parsing logic
- Variable content extraction

### Integration Tests (future):
- Full page render
- Tab switching persistence
- Variable insertion

### Manual Testing Steps:
1. Start dev server: `npm run dev`
2. Open http://localhost:3000
3. Verify patient "John Doe" appears in header
4. Click sidebar items to switch tabs
5. Type in editor and verify content saves
6. Type "@meds" and verify autocomplete appears
7. Select variable and verify content inserts
8. Open right sidebar and try each panel
9. Enter order commands (e.g., "order CBC")
10. Collapse/expand sidebar sections
11. Create new patient and verify tab switching

## Performance Considerations

- All state is in-memory (no persistence overhead)
- ContentEditable used for editor (native browser performance)
- Minimal re-renders with React Context separation

## Security Note

This implementation uses `contentEditable` and renders HTML content. Since this is an internal application with mock data (no user-submitted external content), XSS risk is minimal. For production use with external data sources, add DOMPurify sanitization.

## File Summary

### New Files to Create (~24 files):
```
lib/types/
  patient.ts
  tab.ts
  variable.ts
  order.ts
  index.ts

lib/data/
  mock-patients.ts
  index.ts

lib/context/
  PatientContext.tsx
  EditorContext.tsx
  SidebarContext.tsx
  index.ts

components/layout/
  TopBar.tsx
  LeftSidebar.tsx
  RightSidebar.tsx
  EditorContainer.tsx
  index.ts

components/patient/
  PatientTab.tsx
  PatientTabList.tsx
  index.ts

components/editor/
  PatientSummaryHeader.tsx
  RichTextEditor.tsx
  VariableAutocomplete.tsx
  index.ts

components/sidebar/
  SidebarSection.tsx
  TabItem.tsx
  index.ts

components/panels/
  OrdersPanel.tsx
  VariablesPanel.tsx
  TemplatesPanel.tsx
  index.ts
```

### Files to Modify (3 files):
```
app/layout.tsx      - Add context providers
app/page.tsx        - Replace with EMR layout
app/globals.css     - Add EMR styles
```

## References

- Source file: `xpc-emr-simple.html`
- Target project: `pineapplej` (Next.js 16, React 19, Tailwind v4)
- Existing component: `components/ui/button.tsx`
