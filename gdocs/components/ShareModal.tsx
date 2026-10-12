"use client";

import { useState } from "react";
import { UserPlus, Search, Check, Shield } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useAuth, useUser } from "@clerk/nextjs";

interface ShareModalProps {
  documentId: string;
  isOpen: boolean;
  onClose: () => void;
  collaborators?: any[];
  userToken?: string | null;
}

export function ShareModal({
  documentId,
  isOpen,
  onClose,
  collaborators = [],
  userToken,
}: ShareModalProps) {
  const { getToken } = useAuth();
  const { user } = useUser();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"VIEWER" | "COMMENTER" | "EDITOR">("EDITOR");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error";
    text: string;
    inviteUrl?: string;
    previewUrl?: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsSubmitting(true);
    setStatusMessage(null);
    setCopied(false);

    try {
      const token = userToken || (await getToken());
      const res = await apiFetch("/api/invitations", {
        method: "POST",
        token,
        devUser: user ? { id: user.id, email: user?.primaryEmailAddress?.emailAddress || "", name: user.fullName || "" } : undefined,
        body: JSON.stringify({
          documentId,
          email: email.trim(),
          role,
        }),
      });

      setStatusMessage({
        type: "success",
        text: res.message || "Invitation successfully created!",
        inviteUrl: res.inviteUrl,
        previewUrl: res.emailDelivery?.previewUrl,
      });
      setEmail("");
    } catch (err: any) {
      setStatusMessage({
        type: "error",
        text: err.message || "Failed to send invitation. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl border border-slate-100">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center space-x-2">
            <UserPlus className="h-5 w-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-slate-900">Share Document</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-lg font-bold"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleInvite} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Invite by Email
            </label>
            <div className="flex gap-2">
              <input
                type="email"
                placeholder="colleague@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <select
                value={role}
                onChange={(e: any) => setRole(e.target.value)}
                className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 focus:border-blue-500 focus:outline-none"
              >
                <option value="VIEWER">Viewer</option>
                <option value="COMMENTER">Commenter</option>
                <option value="EDITOR">Editor</option>
              </select>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              If the user does not have an account yet, they will receive an invite email with signup & instant collaboration access.
            </p>
          </div>

          {statusMessage && (
            <div
              className={`p-3.5 rounded-xl text-xs space-y-2 ${
                statusMessage.type === "success"
                  ? "bg-green-50 text-green-800 border border-green-200"
                  : "bg-red-50 text-red-800 border border-red-200"
              }`}
            >
              <p className="font-medium">{statusMessage.text}</p>
              {statusMessage.inviteUrl && (
                <div className="pt-1">
                  <p className="text-[11px] font-semibold text-slate-700 mb-1">Direct Invitation Link:</p>
                  <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg p-1.5 shadow-2xs">
                    <input
                      type="text"
                      readOnly
                      value={statusMessage.inviteUrl}
                      className="flex-1 text-[11px] text-slate-600 bg-transparent px-1 focus:outline-none truncate font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => copyToClipboard(statusMessage.inviteUrl!)}
                      className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-[11px] font-semibold transition shrink-0"
                    >
                      {copied ? "Copied!" : "Copy Link"}
                    </button>
                  </div>
                </div>
              )}
              {statusMessage.previewUrl && (
                <div className="pt-1">
                  <a
                    href={statusMessage.previewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-blue-700 underline font-medium hover:text-blue-900 inline-block"
                  >
                    View Ethereal test inbox email preview ↗
                  </a>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Done
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting ? "Sending..." : "Send Invite"}
            </button>
          </div>
        </form>

        {collaborators.length > 0 && (
          <div className="mt-6 border-t border-slate-100 pt-4">
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              People with access
            </h4>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {collaborators.map((c) => (
                <div key={c.id} className="flex items-center justify-between text-sm py-1">
                  <div className="flex items-center space-x-2">
                    <div className="h-7 w-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs uppercase">
                      {c.user?.name ? c.user.name[0] : c.user?.email?.[0] || "U"}
                    </div>
                    <div>
                      <p className="font-medium text-slate-800 text-xs">{c.user?.name || c.user?.email}</p>
                      <p className="text-[11px] text-slate-400">{c.user?.email}</p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                    {c.role}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
