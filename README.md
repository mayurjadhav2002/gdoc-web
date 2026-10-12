# Google Docs Collaborative Editor

A production-ready collaborative document editor inspired by Google Docs, built with **Next.js 16 (Turbopack)**, **Node.js / Express**, **TipTap**, **Liveblocks**, **Prisma ORM**, and **PostgreSQL**.

---

## Architecture Overview

![System Architecture](./screenshots/Architecture-ss.png)

For an in-depth breakdown of the data schemas, real-time collaboration pipeline, RBAC model, and export engines, see [`ARCHITECTURE.md`](./ARCHITECTURE.md).

---

## Features

- **Multiplayer Document Editing**: Simultaneous real-time editing powered by Liveblocks and Yjs CRDTs.
- **Live Presence & Cursors**: Live multiplayer cursors with collaborator name badges and dynamic color palettes.
- **Inline Selection Comments**: Highlight text to open floating comment composers and anchored discussion threads.
- **Real-Time Title Sync**: Synchronized title renaming across all connected peers.
- **Role-Based Collaboration (RBAC)**: Grant permissions (`OWNER`, `EDITOR`, `COMMENTER`, `VIEWER`) with fine-grained access control.
- **Invitation Management**: Email invites with Resend, Ethereal preview fallback, and 1-click invite link copying.
- **File Import & Export**:
  - Import `.docx`, `.md`, and `.txt` files directly into editable documents.
  - Export documents to **PDF**, **DOCX**, and **Markdown** formats.
- **Document Attachments**: Upload attachments to Supabase Storage with real-time percentage progress bars.
- **Folders, Search & Organization**: Organize documents in folders, search by title, and sort.

---

## Prerequisites

- **Node.js**: `v20.x` or higher
- **npm** or **pnpm**
- **PostgreSQL**: Supabase or local instance

---

## Local Setup & Quick Start

### 1. Clone & Install Dependencies

```bash
# Clone the repository
git clone https://github.com/mayurjadhav2002/gdoc-web.git
cd gdoc-web

# Install frontend dependencies
cd gdocs
npm install

# Install backend dependencies
cd ../backend
npm install
```

### 2. Configure Environment Variables

Create `.env` files in both `gdocs` and `backend` using the provided `.env.example` templates:

#### `gdocs/.env`

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key
NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY=your_liveblocks_public_key
NEXT_PUBLIC_API_URL=http://localhost:8000
```

#### `backend/.env`

```env
BACKEND_PORT=8000
FRONTEND_URL=http://localhost:3000
DATABASE_URL="your_postgresql_database_url"
DIRECT_URL="your_postgresql_direct_url"
LIVEBLOCKS_SECRET_KEY=your_liveblocks_secret_key
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
SUPABASE_BUCKET=attachments
RESEND_API_KEY=your_resend_api_key
RESEND_FROM_EMAIL=onboarding@resend.dev
```

### 3. Database Migration

Generate the Prisma client:

```bash
cd backend
npx prisma generate
```

### 4. Run the Development Servers

Open two terminal windows:

```bash
# Terminal 1 - Backend API (runs on http://localhost:8000)
cd backend
npm run dev

# Terminal 2 - Frontend App (runs on http://localhost:3000)
cd gdocs
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) in your browser.

---

## Running Tests

To run the backend integration test suite:

```bash
cd backend
npm run test
```

To verify the Next.js production build:

```bash
cd gdocs
npm run build
```

---

## Documentation & Deliverables

- **[Architecture Note (`ARCHITECTURE.md`)](./ARCHITECTURE.md)** - Detailed system architecture, data flow diagrams, CRDT conflict resolution, RBAC rules, and storage breakdown.
- **[AI Workflow Note (`AI_WORKFLOW.md`)](./AI_WORKFLOW.md)** - How AI pair programming was used for architecture, bug isolation, and iterative feature delivery.
- **[Submission Overview (`SUBMISSION_OVERVIEW.md`)](./SUBMISSION_OVERVIEW.md)** - Complete submission review written in human conversational tone with testing notes and links.
- **[Submission Manifest (`SUBMISSION.md`)](./SUBMISSION.md)** - Itemized checklist of all deliverables, code modules, and requirements.
- **[Walkthrough Video Guide (`WALKTHROUGH.txt`)](./WALKTHROUGH.txt)** - Walkthrough video URL and feature tour timestamps.
