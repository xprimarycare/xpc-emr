# XPC EMR - Electronic Medical Records System

A modern, intuitive Electronic Medical Records (EMR) document editor built with Next.js, React, and TypeScript. Converted from the original HTML prototype to a full-fledged Next.js application.

## 🎯 Overview

XPC EMR (Pineapple J) is a Google Docs-style medical documentation system designed for healthcare providers. It features multi-patient management, hierarchical document organization, reusable content variables, and smart templates.

## ✨ Features

### 📊 Multi-Patient Management
- **Patient Tabs** - Switch between multiple patients with visual avatar badges
- **Patient Information Form** - Create and edit patient demographics
- **Patient Summary** - Editable one-liner summary displayed across all pages
- **Age/Sex Display** - Automatic age calculation and display (e.g., "33 M")

### 📝 Document Editor
- **Rich Text Editor** - Google Docs-style contentEditable editor
- **Patient Summary Header** - Sticky header showing patient one-liner
- **Page Organization** - Hierarchical sidebar with Pages, Encounters, and Tasks sections
- **Infinite Scroll** - Seamless document editing experience

### 🗂️ Sidebar Navigation
- **Three Sections:**
  - **Pages** - Standard documentation pages
  - **Encounters** - Visit notes with date badges
  - **Tasks** - Action items and todos
- **Collapsible Sections** - Expand/collapse with smooth animations
- **Search Filter** - Real-time search across all pages
- **Hamburger Menu** - Toggle sidebar visibility

### ⭐ Page Management
- **Star Pages** - Favorite frequently accessed pages
- **Rename Pages** - Double-click to rename inline
- **Drag & Drop Reordering** - Visual drag & drop with drop indicators:
  - Drop before/after tabs
  - Create parent/child relationships
  - Blue border indicators showing drop zones
- **Context Menu** - Right-click menu with actions:
  - Add/Remove star
  - Mark as encounter
  - Mark as task
  - Add subpage
  - Delete
  - Duplicate
  - Rename
  - Choose emoji
  - Copy link

### 🔄 Section Management
- **Create New Items** - + button on each section header
- **Auto-dating** - Encounters and tasks get automatic timestamps
- **Dynamic Sections** - Items move between sections when properties change

### 🧩 Variables System
- **@-mention Autocomplete** - Type @ to insert variables
- **Predefined Variables** - Medications, care team, allergies, vitals, PMH
- **Editable Variables** - Update variable content in right panel
- **Pinned Variables** - Pin frequently used variables

### 📋 Templates
- **Reusable Templates** - SOAP notes, follow-up visits, physical exam
- **Template Library** - Browse and insert templates
- **Template Preview** - View template content before inserting

### 📦 Orders Panel
- **Order Entry** - Command-line style order input
- **Order Types** - Labs, referrals, prescriptions, scheduling
- **Smart Parsing** - Auto-detect order type from keywords
- **Order Management** - View and remove orders

### 🎨 UI/UX Features
- **Clean Design** - Minimal, distraction-free interface
- **Responsive Layout** - Top bar, left sidebar, main editor, right panel
- **Smooth Animations** - Transitions for hover states and interactions
- **Visual Feedback** - Active states, hover effects, drag indicators
- **Icon System** - Lucide React icons throughout

## 🏗️ Technical Architecture

### Tech Stack
- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Icons:** Lucide React
- **State Management:** React Context API

### Project Structure
```
├── app/
│   ├── layout.tsx          # Root layout with providers
│   ├── page.tsx            # Main EMR editor page
│   └── globals.css         # Global styles and EMR-specific CSS
├── components/
│   ├── editor/
│   │   ├── PatientSummaryHeader.tsx
│   │   ├── RichTextEditor.tsx
│   │   └── VariableAutocomplete.tsx
│   ├── layout/
│   │   ├── TopBar.tsx
│   │   ├── LeftSidebar.tsx
│   │   ├── RightSidebar.tsx
│   │   └── EditorContainer.tsx
│   ├── patient/
│   │   ├── PatientTab.tsx
│   │   ├── PatientTabList.tsx
│   │   ├── PatientInfoTab.tsx
│   │   └── NewPatientForm.tsx
│   ├── panels/
│   │   ├── OrdersPanel.tsx
│   │   ├── VariablesPanel.tsx
│   │   └── TemplatesPanel.tsx
│   └── sidebar/
│       ├── SidebarSection.tsx
│       ├── TabItem.tsx
│       └── TabContextMenu.tsx
├── lib/
│   ├── context/
│   │   ├── PatientContext.tsx
│   │   ├── EditorContext.tsx
│   │   └── SidebarContext.tsx
│   ├── data/
│   │   ├── mock-patients.ts
│   │   └── mock-variables.ts
│   └── types/
│       ├── patient.ts
│       ├── tab.ts
│       ├── variable.ts
│       └── order.ts
```

### State Management

#### PatientContext
- Multi-patient management
- Patient CRUD operations
- Tab management (add, delete, rename, reorder)
- Tab properties (star, visit, task)

#### EditorContext
- Active tab tracking
- Section collapse state
- Search query
- Tab content cache
- Left sidebar visibility

#### SidebarContext
- Right panel state
- Variables and templates
- Orders management
- Panel type switching

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm, yarn, pnpm, or bun

### Installation

```bash
# Clone the repository
git clone git@github.com:xprimarycare/xpc-emr.git
cd xpc-emr

# Install dependencies
npm install

# Run the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

### Build for Production

```bash
npm run build
npm start
```

## 📖 Usage Guide

### Creating a New Patient
1. Click the **+** button in the top bar
2. Fill in patient information form
3. Click "Save Patient"

### Adding Pages
1. Click **+** next to "Pages" section
2. Name your page
3. Start typing content

### Using Variables
1. Type **@** in the editor
2. Select from autocomplete dropdown
3. Variable content is inserted

### Reordering Pages
1. **Drag** any page in sidebar
2. **Drop** to desired position:
   - Top 25% of tab → insert before
   - Bottom 25% of tab → insert after
   - Middle 50% → make child/subtab

### Context Menu Actions
1. Hover over any page
2. Click **⋮** (three dots)
3. Select action from menu

## 🎯 Roadmap

### Completed ✅
- Multi-patient tabs
- Document editor
- Variables system
- Templates
- Orders panel
- Star pages
- Context menu
- Drag & drop reordering
- Page renaming
- Section management

### Planned 🚧
- Subtabs/hierarchical pages
- AI query panel
- Working search filter
- Selection toolbar
- Enhanced variable editing
- Keyboard shortcuts
- Timeline view
- Analytics dashboard

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License.

## 🏥 About

XPC EMR is developed by XPrimaryCare to modernize medical documentation workflows and improve clinician efficiency.

---

**Built with ❤️ using Next.js and TypeScript**
