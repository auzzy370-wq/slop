"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");

  return (
    <div className="slop-grid-bg flex min-h-[100dvh] items-center justify-center px-4 pb-24">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[var(--slop-panel)] p-6">
        <h1 className="font-display text-3xl font-bold">
          Reset password
        </h1>
        <p className="mt-2 text-sm text-white/55">
          When Supabase Auth is connected, a reset link is emailed securely. In
          demo mode we only validate the address.
        </p>
        <form
          className="mt-6 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!email.includes("@")) {
              toast.error("Enter a valid email");
              return;
            }
            toast.success("If an account exists, a reset email would be sent.");
          }}
        >
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Button type="submit" className="w-full">
            Send reset link
          </Button>
        </form>
        <Link href="/auth/sign-in" className="mt-4 inline-block text-sm text-[var(--slop-violet)]">
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
