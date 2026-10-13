"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, UserPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { safeRedirectPath } from "@/lib/auth-redirect";

export function SignUpForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function signUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    if (password !== repeat) { setError("Passwords do not match."); return; }
    setBusy(true);
    try {
      const next = safeRedirectPath(new URLSearchParams(window.location.search).get("redirect"), "/onboarding");
      const { data, error } = await createClient().auth.signUp({
        email: email.trim(), password,
        options: { data: { full_name: name.trim() }, emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
      });
      if (error) throw error;
      router.replace(data.session ? next : "/auth/sign-up-success"); router.refresh();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Unable to create account."); }
    finally { setBusy(false); }
  }

  return <div className="auth-form">
    <div className="mb-7 flex h-12 w-12 items-center justify-center rounded-2xl border border-lime-300/20 bg-lime-300/10 text-lime-300"><UserPlus className="h-5 w-5" /></div>
    <p className="eyebrow">Start building</p>
    <h1 className="mt-3 text-4xl font-semibold tracking-[-.045em]">Create your workspace</h1>
    <p className="mt-3 text-sm leading-6 text-muted-foreground">One account for your dashboard, CLI tokens, and team secrets.</p>
    <form onSubmit={signUp} className="mt-9 space-y-5">
      <label className="auth-label">Full name<input className="auth-input" type="text" autoComplete="name" placeholder="Your name" value={name} onChange={(event) => setName(event.target.value)} required /></label>
      <label className="auth-label">Email address<input className="auth-input" type="email" autoComplete="email" placeholder="you@company.com" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
      <label className="auth-label">Password<input className="auth-input" type="password" autoComplete="new-password" placeholder="At least 8 characters" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
      <label className="auth-label">Confirm password<input className="auth-input" type="password" autoComplete="new-password" placeholder="Repeat your password" minLength={8} value={repeat} onChange={(event) => setRepeat(event.target.value)} required /></label>
      {error && <p role="alert" className="rounded-xl border border-red-400/25 bg-red-400/10 px-4 py-3 text-sm text-red-300">{error}</p>}
      <button type="submit" disabled={busy} className="btn-accent w-full">{busy ? "Creating account…" : "Create account"}<ArrowRight className="h-4 w-4" /></button>
    </form>
    <p className="mt-8 text-center text-sm text-muted-foreground">Already have an account? <Link href="/login" className="font-semibold text-foreground hover:text-lime-300">Sign in</Link></p>
  </div>;
}
