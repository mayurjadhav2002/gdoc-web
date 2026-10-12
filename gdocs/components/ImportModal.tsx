"use client";

import { useState } from "react";
import { Upload, FileUp, Check } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useRouter } from "next/navigation";
import { useAuth, useUser } from "@clerk/nextjs";

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  folderId?: string | null;
  onImportComplete?: (newDocId: string) => void;
}

export function ImportModal({
  isOpen,
  onClose,
  folderId,
  onImportComplete,
}: ImportModalProps) {
  const router = useRouter();
  const { getToken } = useAuth();
  const { user } = useUser();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      if (!title) {
        setTitle(selected.name.replace(/\.[^/.]+$/, ""));
      }
    }
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setIsUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("createDocument", "true");
    if (title) formData.append("title", title);
    if (folderId) formData.append("folderId", folderId);

    try {
      const token = await getToken();
      const res = await apiFetch("/api/files/convert", {
        method: "POST",
        body: formData,
        token,
        devUser: user ? { id: user.id, email: user?.primaryEmailAddress?.emailAddress || "", name: user.fullName || "" } : undefined,
      });

      if (res.document?.id) {
        if (onImportComplete) {
          onImportComplete(res.document.id);
        } else {
          router.push(`/documents/${res.document.id}`);
        }
        onClose();
      }
    } catch (err: any) {
      setError(err.message || "Failed to convert file");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl border border-slate-100">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center space-x-2">
            <FileUp className="h-5 w-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-slate-900">Import File to Document</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 font-bold">
            ×
          </button>
        </div>

        <form onSubmit={handleImport} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Select .docx, .md, or .txt file
            </label>
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-lg p-6 cursor-pointer hover:border-blue-500 hover:bg-blue-50/50 transition">
              <Upload className="h-8 w-8 text-slate-400 mb-2" />
              <span className="text-xs font-semibold text-slate-700">
                {file ? file.name : "Choose a file to upload"}
              </span>
              <span className="text-[11px] text-slate-400 mt-1">
                Word (.docx), Markdown (.md), or Plain text (.txt)
              </span>
              <input
                type="file"
                accept=".docx,.md,.txt,text/plain,text/markdown"
                className="hidden"
                onChange={handleFileChange}
              />
            </label>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Document Title
            </label>
            <input
              type="text"
              placeholder="e.g. Project Roadmap"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!file || isUploading}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isUploading ? "Converting..." : "Import Document"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
