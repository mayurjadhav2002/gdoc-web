"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { CheckCircle2, XCircle, ArrowRight, Loader2, FileText } from "lucide-react";
import { useAuth, useUser } from "@clerk/nextjs";

import { Suspense } from "react";

function InviteAcceptContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams?.get("token");
  const { getToken } = useAuth();
  const { user } = useUser();

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Verifying your invitation credentials...");
  const [documentId, setDocumentId] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("No invitation token provided in the link.");
      return;
    }

    async function acceptInvite() {
      try {
        const authToken = await getToken();
        setMessage("Accepting invitation & granting document permissions...");
        const res = await apiFetch(`/api/invitations/${token}/accept`, {
          method: "POST",
          token: authToken,
          devUser: user
            ? { id: user.id, email: user?.primaryEmailAddress?.emailAddress || "", name: user.fullName || "" }
            : { id: "dev_editor", email: "collaborator@example.com" },
        });

        setStatus("success");
        setMessage("Invitation accepted! You have been granted access to collaborate.");
        setDocumentId(res.documentId);

        // Auto-redirect after brief confirmation
        if (res.documentId) {
          setTimeout(() => {
            router.push(`/documents/${res.documentId}`);
          }, 1500);
        }
      } catch (err: any) {
        setStatus("error");
        setMessage(err.message || "Failed to accept invitation. The invite may have expired or already been accepted.");
      }
    }

    if (user !== undefined) {
      acceptInvite();
    }
  }, [token, user]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl border border-slate-100 text-center">
        {status === "loading" && (
          <div className="py-8">
            <Loader2 className="h-12 w-12 text-blue-600 animate-spin mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-slate-800">Joining Document</h2>
            <p className="text-xs text-slate-500 mt-1">{message}</p>
          </div>
        )}

        {status === "success" && (
          <div className="py-6">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-900">Welcome to the Document!</h2>
            <p className="text-sm text-slate-600 mt-2 mb-6">{message}</p>
            {documentId && (
              <button
                onClick={() => router.push(`/documents/${documentId}`)}
                className="inline-flex items-center space-x-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition"
              >
                <span>Open Document</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        )}

        {status === "error" && (
          <div className="py-6">
            <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-900">Invitation Error</h2>
            <p className="text-sm text-slate-600 mt-2 mb-6">{message}</p>
            <button
              onClick={() => router.push("/")}
              className="rounded-xl border border-slate-300 px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              Go to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function InviteAcceptPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-400">Verifying invitation...</div>}>
      <InviteAcceptContent />
    </Suspense>
  );
}
