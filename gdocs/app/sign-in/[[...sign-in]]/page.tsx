import { SignIn } from "@clerk/nextjs";
import { Suspense } from "react";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <Suspense fallback={<div className="text-slate-400 text-sm">Loading sign in...</div>}>
        <SignIn />
      </Suspense>
    </div>
  );
}
