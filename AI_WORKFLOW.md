# AI-Assisted Engineering Workflow

This document explains how AI tools were integrated into the development process to plan, implement, debug, and verify features across the full stack.

---

## 1. Collaborative Development Philosophy

Rather than treating AI as a generic code generator, the workflow was structured around a **plan-execute-verify** loop:

1. **Requirements Analysis**: Breaking down user stories (collaborative editing, live cursors, comments, invitations, file exports) into architectural goals and data requirements.
2. **Impact Analysis**: Inspecting existing components, Prisma schemas, and API contracts before modifying code to prevent regressions.
3. **Targeted Implementation**: Writing modular, reusable components and focused service functions.
4. **Automated Verification**: Validating frontend builds (`next build`), type checks (`tsc`), API integration tests, and live endpoint checks.

---

## 2. Key Problem Areas & AI Solutions

### 1. Collaborative Comments with User Attribution
- **Challenge**: Liveblocks comments rendered authors as `"Anonymous"` when identity resolvers were missing.
- **Solution**: Implemented `resolveUsers` and `resolveMentionSuggestions` in `<LiveblocksProvider>` connected to a dedicated `/api/liveblocks-auth/resolve-users` endpoint that formats collaborator names and avatars.

### 2. Resend Sandbox Constraints & Fallback Architecture
- **Challenge**: In development, Resend accounts restricted outbound emails to unverified recipient domains.
- **Solution**: Designed an intelligent fallback mailer that captures Resend 403 sandbox errors, boots an Ethereal/Nodemailer preview inbox, and surfaces a 1-click shareable invitation URL directly in the UI.

### 3. Canvas-Relative Live Cursors
- **Challenge**: Default viewport-relative cursors misalign when collaborators resize browser windows or scroll through long documents.
- **Solution**: Implemented a coordinate normalization layer in `LiveCursors.tsx` that computes mouse offsets relative to the document container bounding box.

### 4. Zero-Latency Document Title Synchronization
- **Challenge**: The document title is stored outside the ProseMirror editor AST. Syncing it only on database blur left peer tabs out of sync during active typing.
- **Solution**: Leveraged Liveblocks room events (`useBroadcastEvent` / `useEventListener`) to broadcast title keystrokes in real time while persisting to PostgreSQL on blur.

### 5. Multi-Format Document Exporting
- **Challenge**: Exporting rich text to PDF, DOCX, and Markdown requires parsing arbitrary TipTap ProseMirror JSON trees.
- **Solution**: Built AST traversal engines for `pdfkit`, `docx`, and Markdown that map ProseMirror nodes (`heading`, `bulletList`, `blockquote`, `codeBlock`) to their native format counterparts.

---

## 3. Verification & Quality Assurance

- **Build Integrity**: Clean Turbopack builds verified via `npm run build` on Next.js 16.
- **Backend API Integration**: Vitest suite executing integration tests across document creation, folder structuring, file conversion, and invitation flows.
- **Direct HTTP Validation**: Tested `/api/files/export` via automated Node scripts to verify binary payloads, Content-Type headers, and Content-Disposition attachments.
