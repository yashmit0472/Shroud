"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { ArrowRight, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function sendReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const { error } = await createClient().auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin + "/auth/update-password",
      });
      if (error) throw error;
      setSent(true);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Unable to send reset email."); }
    finally { setBusy(false); }
  }

  return <div className="auth-form">
    <div className="mb-7 flex h-12 w-12 items-center justify-center rounded-2xl border border-lime-300/20 bg-lime-300/10 text-lime-300"><Mail className="h-5 w-5" /></div>
    <p className="eyebrow">Account recovery</p>
    <h1 className="mt-3 text-4xl font-semibold tracking-[-.045em]">{sent ? "Check your inbox" : "Reset your password"}</h1>
    <p className="mt-3 text-sm leading-6 text-muted-foreground">{sent ? "If this address has a Shroud account, you will receive a password reset link." : "Enter your account email and we will send a reset link."}</p>
    {!sent && <form onSubmit={sendReset} className="mt-9 space-y-5">
      <label className="auth-label">Email address<input className="auth-input" type="email" autoComplete="email" placeholder="you@company.com" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
      {error && <p role="alert" className="rounded-xl border border-red-400/25 bg-red-400/10 px-4 py-3 text-sm text-red-300">{error}</p>}
      <button type="submit" disabled={busy} className="btn-accent w-full">{busy ? "Sending..." : "Send reset email"}<ArrowRight className="h-4 w-4" /></button>
    </form>}
    <p className="mt-8 text-center text-sm text-muted-foreground"><Link href="/login" className="font-semibold text-foreground hover:text-lime-300">Back to sign in</Link></p>
  </div>;
}
