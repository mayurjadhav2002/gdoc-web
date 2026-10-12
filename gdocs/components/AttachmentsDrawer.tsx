"use client";

import { useState, useEffect, useRef } from "react";
import {
  Paperclip,
  Upload,
  Download,
  Trash2,
  FileText,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useAuth, useUser } from "@clerk/nextjs";

interface AttachmentsDrawerProps {
  documentId: string;
  isOpen: boolean;
  onClose: () => void;
  userToken?: string | null;
  canEdit?: boolean;
}

interface UploadingState {
  name: string;
  size: number;
  progress: number;
  statusText: string;
}

function formatBytes(bytes: number) {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function AttachmentsDrawer({
  documentId,
  isOpen,
  onClose,
  userToken,
  canEdit = true,
}: AttachmentsDrawerProps) {
  const { getToken } = useAuth();
  const { user } = useUser();
  const [attachments, setAttachments] = useState<any[]>([]);
  const [uploadingState, setUploadingState] = useState<UploadingState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const progressTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadAttachments();
    }
    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    };
  }, [isOpen, documentId]);

  const loadAttachments = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const token = userToken || (await getToken());
      const res = await apiFetch(`/api/files/attachments/${documentId}`, {
        token,
        devUser: user
          ? { id: user.id, email: user?.primaryEmailAddress?.emailAddress || "", name: user.fullName || "" }
          : undefined,
      });
      setAttachments(res.attachments || []);
    } catch (e: any) {
      console.error("Failed to load attachments:", e);
      setErrorMessage("Failed to load attachments.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      setErrorMessage("File exceeds the 15MB limit. Please choose a smaller file.");
      e.target.value = "";
      return;
    }

    setErrorMessage(null);
    setUploadingState({
      name: file.name,
      size: file.size,
      progress: 15,
      statusText: "Uploading to Supabase Storage...",
    });

    // Simulate progressive upload buffer
    progressTimerRef.current = setInterval(() => {
      setUploadingState((prev) => {
        if (!prev) return null;
        if (prev.progress >= 88) {
          return { ...prev, statusText: "Processing and registering attachment..." };
        }
        return {
          ...prev,
          progress: prev.progress + Math.floor(Math.random() * 12 + 6),
        };
      });
    }, 280);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("documentId", documentId);

    try {
      const token = userToken || (await getToken());
      const res = await apiFetch("/api/files/attachment", {
        method: "POST",
        body: formData,
        token,
        devUser: user
          ? { id: user.id, email: user?.primaryEmailAddress?.emailAddress || "", name: user.fullName || "" }
          : undefined,
      });

      if (progressTimerRef.current) clearInterval(progressTimerRef.current);

      if (res.attachment) {
        setUploadingState({
          name: file.name,
          size: file.size,
          progress: 100,
          statusText: "Upload complete!",
        });

        setTimeout(() => {
          setAttachments((prev) => [res.attachment, ...prev]);
          setUploadingState(null);
        }, 500);
      }
    } catch (err: any) {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
      console.error("Upload failed:", err);
      setUploadingState(null);
      setErrorMessage(err?.message || "Failed to upload file to storage.");
    } finally {
      e.target.value = "";
    }
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    if (!confirm("Are you sure you want to remove this attachment?")) return;

    setDeletingId(attachmentId);
    try {
      const token = userToken || (await getToken());
      await apiFetch(`/api/files/attachments/${attachmentId}`, {
        method: "DELETE",
        token,
        devUser: user
          ? { id: user.id, email: user?.primaryEmailAddress?.emailAddress || "", name: user.fullName || "" }
          : undefined,
      });
      setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
    } catch (err: any) {
      console.error("Failed to delete attachment:", err);
      alert(err?.message || "Failed to delete attachment");
    } finally {
      setDeletingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-88 bg-white shadow-2xl border-l border-slate-200 flex flex-col animate-in slide-in-from-right duration-200">
      {/* Drawer Header */}
      <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
        <div className="flex items-center space-x-2">
          <Paperclip className="h-5 w-5 text-blue-600" />
          <h3 className="font-semibold text-slate-800 text-sm">Document Attachments</h3>
          {attachments.length > 0 && (
            <span className="text-[11px] font-semibold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
              {attachments.length}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-700 text-lg leading-none p-1 rounded-md hover:bg-slate-200/60 transition"
          title="Close drawer"
        >
          ×
        </button>
      </div>

      <div className="p-4 flex-1 overflow-y-auto space-y-4">
        {/* Error notification banner */}
        {errorMessage && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-2.5 text-xs text-red-700 animate-in fade-in">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium">{errorMessage}</p>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-red-400 hover:text-red-700 text-xs font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {/* Upload Dropzone */}
        {canEdit && (
          <div>
            <label
              className={`relative flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-5 cursor-pointer transition text-center ${
                uploadingState
                  ? "border-blue-400 bg-blue-50/60 pointer-events-none"
                  : "border-slate-300 hover:border-blue-500 hover:bg-blue-50/30 bg-slate-50/40"
              }`}
            >
              {uploadingState ? (
                <div className="flex flex-col items-center space-y-2 py-1">
                  <Loader2 className="h-7 w-7 text-blue-600 animate-spin" />
                  <span className="text-xs font-semibold text-blue-900">Uploading file...</span>
                  <span className="text-[11px] text-blue-600 font-medium">Please wait a moment</span>
                </div>
              ) : (
                <>
                  <div className="p-2.5 bg-blue-50 rounded-full mb-2 text-blue-600 shadow-2xs">
                    <Upload className="h-5 w-5" />
                  </div>
                  <span className="text-xs font-semibold text-slate-800">Upload Attachment</span>
                  <span className="text-[11px] text-slate-400 mt-0.5">
                    Images, PDFs, documents up to 15MB
                  </span>
                  <span className="mt-2 text-[10px] text-blue-600 font-medium hover:underline">
                    Browse files
                  </span>
                </>
              )}
              <input
                type="file"
                className="hidden"
                disabled={!!uploadingState}
                onChange={handleFileUpload}
              />
            </label>
          </div>
        )}

        {/* Live Upload Progress Card */}
        {uploadingState && (
          <div className="p-3.5 bg-blue-50/90 border border-blue-200 rounded-xl shadow-xs space-y-2.5 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center space-x-2 truncate pr-2">
                <Loader2 className="h-4 w-4 text-blue-600 animate-spin shrink-0" />
                <span className="font-semibold text-slate-800 truncate" title={uploadingState.name}>
                  {uploadingState.name}
                </span>
              </div>
              <span className="text-[11px] font-bold text-blue-700 shrink-0">
                {uploadingState.progress}%
              </span>
            </div>

            {/* Animated Progress Bar */}
            <div className="w-full bg-blue-200/80 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-blue-600 h-1.5 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${uploadingState.progress}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span className="flex items-center space-x-1">
                <span>{uploadingState.statusText}</span>
              </span>
              <span>{formatBytes(uploadingState.size)}</span>
            </div>
          </div>
        )}

        {/* Existing Attachments Section */}
        <div>
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 px-1">
            Files ({attachments.length})
          </h4>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400 space-y-2">
              <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
              <p className="text-xs">Loading attachments...</p>
            </div>
          ) : attachments.length === 0 && !uploadingState ? (
            <div className="text-center py-10 px-4 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
              <FileText className="h-8 w-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-600">No attachments attached</p>
              <p className="text-[11px] text-slate-400 mt-1">
                Upload files above to store and share them directly within this document.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {attachments.map((att) => (
                <div
                  key={att.id}
                  className="p-3 border border-slate-200/80 rounded-xl flex items-center justify-between bg-white hover:border-slate-300 hover:shadow-xs transition group"
                >
                  <div className="flex items-center space-x-3 overflow-hidden mr-2">
                    <div className="p-2 bg-slate-100 rounded-lg text-slate-500 shrink-0 group-hover:bg-blue-50 group-hover:text-blue-600 transition">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="overflow-hidden">
                      <p
                        className="text-xs font-semibold text-slate-800 truncate"
                        title={att.fileName}
                      >
                        {att.fileName}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {formatBytes(att.fileSize)} • {new Date(att.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1 shrink-0">
                    <a
                      href={att.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                      title="Open attachment"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                    <a
                      href={att.fileUrl}
                      download={att.fileName}
                      className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                      title="Download attachment"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </a>
                    {canEdit && (
                      <button
                        onClick={() => handleDeleteAttachment(att.id)}
                        disabled={deletingId === att.id}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-50"
                        title="Delete attachment"
                      >
                        {deletingId === att.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-red-500" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
