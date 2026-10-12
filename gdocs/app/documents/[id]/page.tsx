"use client";

import { useEffect, useState, useCallback, useRef, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  FileText,
  Share2,
  Paperclip,
  Check,
  Cloud,
  ChevronLeft,
  ChevronDown,
  Loader2,
  Download,
  FileCode,
  MessageSquare,
} from "lucide-react";
import { useAuth, useUser } from "@clerk/nextjs";
import { useBroadcastEvent, useEventListener } from "@liveblocks/react";
import { apiFetch } from "@/lib/api";
import { TipTapEditor } from "@/components/TipTapEditor";
import { ShareModal } from "@/components/ShareModal";
import { AttachmentsDrawer } from "@/components/AttachmentsDrawer";
import { ActiveAvatars } from "@/components/ActiveAvatars";
import { CommentsOverlay } from "@/components/CommentsOverlay";
import { LiveblocksWrapper } from "@/components/LiveblocksWrapper";

interface DocumentWorkspaceProps {
  initialDocument: any;
  role: string;
  documentId: string;
}

function DocumentWorkspace({
  initialDocument,
  role,
  documentId,
}: DocumentWorkspaceProps) {
  const router = useRouter();
  const { getToken } = useAuth();
  const { user } = useUser();

  const [document, setDocument] = useState<any>(initialDocument);
  const [title, setTitle] = useState(initialDocument?.title || "Untitled Document");
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(
    initialDocument?.updatedAt ? new Date(initialDocument.updatedAt) : null
  );

  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isAttachmentsOpen, setIsAttachmentsOpen] = useState(false);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<string | null>(null);

  const exportMenuRef = useRef<HTMLDivElement>(null);
  const latestContentRef = useRef<any>(initialDocument?.content || null);

  // Liveblocks real-time title synchronization across peers
  const broadcast = useBroadcastEvent();

  useEventListener(({ event }: any) => {
    if (event?.type === "TITLE_CHANGED" && typeof event.title === "string") {
      setTitle(event.title);
    }
  });

  // Handle title edit with instant live broadcast
  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    broadcast({ type: "TITLE_CHANGED", title: newTitle });
  };

  // Close export dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        exportMenuRef.current &&
        !exportMenuRef.current.contains(event.target as Node)
      ) {
        setIsExportMenuOpen(false);
      }
    }
    if (isExportMenuOpen) {
      window.document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      window.document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isExportMenuOpen]);

  // Debounced auto-save handler for document content
  const handleContentChange = useCallback(
    async (content: any, plainText: string) => {
      latestContentRef.current = content;
      if (role === "VIEWER") return;
      setIsSaving(true);

      try {
        const token = await getToken();
        await apiFetch(`/api/documents/${documentId}`, {
          method: "PATCH",
          token,
          devUser: user
            ? {
                id: user.id,
                email: user?.primaryEmailAddress?.emailAddress || "",
                name: user.fullName || "",
              }
            : undefined,
          body: JSON.stringify({ content, plainText }),
        });
        setLastSaved(new Date());
      } catch (err) {
        console.error("Failed to auto-save document:", err);
      } finally {
        setIsSaving(false);
      }
    },
    [documentId, role, user, getToken]
  );

  // Title persistence on blur
  const handleTitleBlur = async () => {
    if (role === "VIEWER" || title === document?.title) return;
    try {
      const token = await getToken();
      await apiFetch(`/api/documents/${documentId}`, {
        method: "PATCH",
        token,
        devUser: user
          ? {
              id: user.id,
              email: user?.primaryEmailAddress?.emailAddress || "",
              name: user.fullName || "",
            }
          : undefined,
        body: JSON.stringify({ title }),
      });
      setLastSaved(new Date());
      setDocument((prev: any) => ({ ...prev, title }));
    } catch (err) {
      console.error("Failed to update title:", err);
    }
  };

  // Document export handler supporting PDF, DOCX, and Markdown
  const handleExport = async (format: "pdf" | "docx" | "md") => {
    setIsExportMenuOpen(false);
    setExportingFormat(format);
    try {
      const token = await getToken();
      const userEmail = user?.primaryEmailAddress?.emailAddress;
      const userName = user?.fullName;

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
        if (userEmail) headers["x-user-email"] = userEmail;
        if (userName) headers["x-user-name"] = userName;
      } else if (user) {
        headers["x-dev-user-id"] = user.id;
        if (userEmail) headers["x-dev-user-email"] = userEmail;
        if (userName) headers["x-dev-user-name"] = userName;
      }

      const res = await fetch("/api/files/export", {
        method: "POST",
        headers,
        body: JSON.stringify({
          documentId,
          format,
          title: title || document?.title || "Document",
          content: latestContentRef.current || document?.content,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.error || `Export failed with status ${res.status}`);
      }

      const blob = await res.blob();
      const safeTitle = (title || "Document").replace(/[/\\?%*:|"<>]/g, "_");
      const blobUrl = window.URL.createObjectURL(blob);
      const downloadLink = window.document.createElement("a");
      downloadLink.href = blobUrl;
      downloadLink.download = `${safeTitle}.${format}`;
      window.document.body.appendChild(downloadLink);
      downloadLink.click();
      window.URL.revokeObjectURL(blobUrl);
      downloadLink.remove();
    } catch (err: any) {
      console.error("Export error:", err);
      alert(err?.message || "Failed to export document.");
    } finally {
      setExportingFormat(null);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      {/* Top Navigation Header */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2.5 shadow-xs">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => router.push("/")}
            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
            title="Back to Dashboard"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white shadow-xs">
            <FileText className="h-5 w-5" />
          </div>

          <div>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={title}
                disabled={role === "VIEWER"}
                onChange={(e) => handleTitleChange(e.target.value)}
                onBlur={handleTitleBlur}
                className="rounded px-1.5 py-0.5 text-base font-semibold text-slate-800 hover:bg-slate-100 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 max-w-sm sm:max-w-md transition"
              />
              <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                {role}
              </span>
            </div>
            <div className="flex items-center space-x-1.5 text-[11px] text-slate-400 pl-1">
              {isSaving ? (
                <>
                  <Cloud className="h-3 w-3 animate-pulse text-blue-500" />
                  <span>Saving changes...</span>
                </>
              ) : (
                <>
                  <Check className="h-3 w-3 text-green-500" />
                  <span>
                    {lastSaved
                      ? `Saved at ${lastSaved.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                      : "All changes saved"}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Live presence avatars */}
          <ActiveAvatars />

          {/* Export Dropdown Menu */}
          <div className="relative" ref={exportMenuRef}>
            <button
              onClick={() => setIsExportMenuOpen((prev) => !prev)}
              disabled={!!exportingFormat}
              className="flex items-center space-x-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition shadow-2xs disabled:opacity-50"
              title="Export document"
            >
              {exportingFormat ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />
              ) : (
                <Download className="h-3.5 w-3.5 text-slate-600" />
              )}
              <span>
                {exportingFormat ? `Exporting ${exportingFormat.toUpperCase()}...` : "Export"}
              </span>
              <ChevronDown className="h-3 w-3 text-slate-400" />
            </button>

            {isExportMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-2.5 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Export Document As
                </div>

                {/* PDF Option */}
                <button
                  onClick={() => handleExport("pdf")}
                  className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition group"
                >
                  <div className="flex items-center space-x-2.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-md bg-red-50 text-red-600 group-hover:bg-red-100">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="font-semibold text-slate-800">PDF Document</div>
                      <div className="text-[10px] text-slate-400">Portable Document (.pdf)</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                    .pdf
                  </span>
                </button>

                {/* DOCX Option */}
                <button
                  onClick={() => handleExport("docx")}
                  className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition group"
                >
                  <div className="flex items-center space-x-2.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-50 text-blue-600 group-hover:bg-blue-100">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="font-semibold text-slate-800">Word Document</div>
                      <div className="text-[10px] text-slate-400">Microsoft Word (.docx)</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                    .docx
                  </span>
                </button>

                {/* Markdown Option */}
                <button
                  onClick={() => handleExport("md")}
                  className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition group"
                >
                  <div className="flex items-center space-x-2.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100">
                      <FileCode className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="font-semibold text-slate-800">Markdown</div>
                      <div className="text-[10px] text-slate-400">Formatted text (.md)</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                    .md
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* Comments button */}
          <button
            onClick={() => setIsCommentsOpen(true)}
            className="flex items-center space-x-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition shadow-2xs"
          >
            <MessageSquare className="h-3.5 w-3.5 text-blue-600" />
            <span>Comments</span>
          </button>

          {/* Attachments drawer button */}
          <button
            onClick={() => setIsAttachmentsOpen(true)}
            className="flex items-center space-x-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition shadow-2xs"
          >
            <Paperclip className="h-3.5 w-3.5 text-slate-500" />
            <span>Attachments</span>
          </button>

          {/* Share button */}
          <button
            onClick={() => setIsShareOpen(true)}
            className="flex items-center space-x-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition shadow-2xs"
          >
            <Share2 className="h-3.5 w-3.5" />
            <span>Share</span>
          </button>
        </div>
      </header>

      {/* TipTap Rich Editor */}
      <main className="flex-1">
        <TipTapEditor
          initialContent={document.content}
          rawHtml={document.content?.rawHtml}
          editable={role !== "VIEWER"}
          onContentChange={handleContentChange}
        />
      </main>

      {/* Share Modal */}
      <ShareModal
        documentId={documentId}
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        collaborators={document.collaborators}
      />

      {/* Comments & Discussion Threads Overlay */}
      <CommentsOverlay
        isOpen={isCommentsOpen}
        onClose={() => setIsCommentsOpen(false)}
      />

      {/* Attachments Drawer */}
      <AttachmentsDrawer
        documentId={documentId}
        isOpen={isAttachmentsOpen}
        onClose={() => setIsAttachmentsOpen(false)}
        canEdit={role !== "VIEWER"}
      />
    </div>
  );
}

function DocumentEditorContent() {
  const params = useParams();
  const router = useRouter();
  const { getToken } = useAuth();
  const { user } = useUser();
  const documentId = params?.id as string;

  const [document, setDocument] = useState<any>(null);
  const [role, setRole] = useState<string>("OWNER");
  const [isLoading, setIsLoading] = useState(true);

  // Fetch document
  useEffect(() => {
    if (!documentId) return;

    async function loadDoc() {
      setIsLoading(true);
      try {
        const token = await getToken();
        const userEmail = user?.primaryEmailAddress?.emailAddress;
        const res = await apiFetch(`/api/documents/${documentId}`, {
          token,
          devUser: user
            ? { id: user.id, email: userEmail || "", name: user.fullName || "" }
            : undefined,
        });

        setDocument(res.document);
        setRole(res.role || "OWNER");
      } catch (err) {
        console.error("Failed to load document:", err);
      } finally {
        setIsLoading(false);
      }
    }

    if (user !== undefined) {
      loadDoc();
    }
  }, [documentId, user, getToken]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 text-slate-500 font-medium text-sm">
        Opening document...
      </div>
    );
  }

  if (!document) {
    return (
      <div className="flex flex-col h-screen items-center justify-center bg-slate-50 gap-4">
        <p className="text-slate-600 font-medium">
          Document not found or access denied.
        </p>
        <button
          onClick={() => router.push("/")}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  return (
    <LiveblocksWrapper roomId={documentId}>
      <DocumentWorkspace
        initialDocument={document}
        role={role}
        documentId={documentId}
      />
    </LiveblocksWrapper>
  );
}

export default function DocumentEditorPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-slate-50 text-slate-400">
          Loading editor...
        </div>
      }
    >
      <DocumentEditorContent />
    </Suspense>
  );
}
