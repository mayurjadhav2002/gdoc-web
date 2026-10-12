# Submission Manifest

This document outlines all deliverables and components included in this submission.

| Deliverable | File / Resource | Description | Status |
| :--- | :--- | :--- | :--- |
| **Source Code** | Entire Repo (`/gdocs`, `/backend`) | Full-stack collaborative editor codebase (Next.js 16 + Express + TypeScript) | ✅ Included |
| **README & Setup** | [`README.md`](file:///Users/mayur/Desktop/assessment/README.md) | Local environment setup, dependencies, database migration, and run instructions | ✅ Included |
| **Architecture Note** | [`ARCHITECTURE.md`](file:///Users/mayur/Desktop/assessment/ARCHITECTURE.md) | System overview, data models, real-time collaboration pipeline, RBAC, and storage | ✅ Included |
| **AI Workflow Note** | [`AI_WORKFLOW.md`](file:///Users/mayur/Desktop/assessment/AI_WORKFLOW.md) | How AI pair-programming and verification were utilized during development | ✅ Included |
| **Submission Manifest** | [`SUBMISSION.md`](file:///Users/mayur/Desktop/assessment/SUBMISSION.md) | Exact itemized list of what is included in this submission | ✅ Included |
| **Live Product URL** | [`SUBMISSION_OVERVIEW.md`](file:///Users/mayur/Desktop/assessment/SUBMISSION_OVERVIEW.md) | Deployed application link / local testing guide | ✅ Included |
| **Walkthrough Video** | [`WALKTHROUGH.txt`](file:///Users/mayur/Desktop/assessment/WALKTHROUGH.txt) | Walkthrough demo video URL and feature walkthrough timestamps | ✅ Included |
| **Demo & Screenshots** | [`SUBMISSION_OVERVIEW.md`](file:///Users/mayur/Desktop/assessment/SUBMISSION_OVERVIEW.md) | Key interface screenshots and step-by-step feature highlights | ✅ Included |

---

## Included Features Checklist

- [x] **Document Management**: Create, rename, delete, auto-save, and reopen documents.
- [x] **Collaborative Rich-Text Editing**: TipTap editor with full formatting options (headings, lists, quotes, tables, code blocks, text styling).
- [x] **Real-Time Presence**: Live cursors (`LiveCursors`), typing indicators, and user avatars stack with online status dots.
- [x] **Live Comments & Discussions**: Inline selection comments (`FloatingToolbar`, `FloatingComposer`) and anchored sidebar threads (`AnchoredThreads`, `CommentsOverlay`).
- [x] **Document Title Synchronization**: Instant peer-to-peer title sync via Liveblocks room broadcast events.
- [x] **Permission Levels (RBAC)**: `OWNER`, `EDITOR`, `COMMENTER`, and `VIEWER` roles enforced on the client and backend.
- [x] **Collaboration & Invitations**: Email invitations via Resend (with Ethereal preview fallback) and 1-click direct invite links.
- [x] **File Import**: Convert `.docx`, `.md`, and `.txt` files directly into editable documents or append to drafts.
- [x] **File Export**: Export documents to `.pdf`, `.docx`, and `.md` formats.
- [x] **Attachment Drawer**: Upload attachments to Supabase Storage with real-time percentage progress indicators.
- [x] **Folder Organization**: Create folders, organize documents, filter, search, and sort.
