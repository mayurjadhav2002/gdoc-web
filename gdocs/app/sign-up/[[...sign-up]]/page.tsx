import { SignUp } from "@clerk/nextjs";
import { Suspense } from "react";

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <Suspense fallback={<div className="text-slate-400 text-sm">Loading sign up...</div>}>
        <SignUp />
      </Suspense>
    </div>
  );
}
