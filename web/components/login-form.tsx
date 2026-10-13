"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { safeRedirectPath } from "@/lib/auth-redirect";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const { error } = await createClient().auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      router.replace(safeRedirectPath(new URLSearchParams(window.location.search).get("redirect"), "/dashboard")); router.refresh();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Unable to sign in."); }
    finally { setBusy(false); }
  }

  async function signInWithGoogle() {
    setBusy(true); setError("");
    try {
      const next = safeRedirectPath(new URLSearchParams(window.location.search).get("redirect"), "/onboarding");
      const { error } = await createClient().auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` } });
      if (error) throw error;
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Unable to start Google sign-in."); setBusy(false); }
  }

  return <div className="auth-form">
    <div className="mb-7 flex h-12 w-12 items-center justify-center rounded-2xl border border-lime-300/20 bg-lime-300/10 text-lime-300"><LockKeyhole className="h-5 w-5" /></div>
    <p className="eyebrow">Welcome back</p>
    <h1 className="mt-3 text-4xl font-semibold tracking-[-.045em]">Sign in to Shroud</h1>
    <p className="mt-3 text-sm leading-6 text-muted-foreground">Your workspace, projects, and secrets are waiting.</p>
    <button type="button" onClick={signInWithGoogle} disabled={busy} className="auth-google mt-9"><GoogleIcon /> Continue with Google</button>
    <div className="my-7 flex items-center gap-4 text-xs uppercase tracking-[.18em] text-muted-foreground"><span className="h-px flex-1 bg-border" /> or use email <span className="h-px flex-1 bg-border" /></div>
    <form onSubmit={signIn} className="space-y-5">
      <label className="auth-label">Email address<input className="auth-input" type="email" autoComplete="email" placeholder="you@company.com" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
      <label className="auth-label"><span className="flex items-center justify-between">Password <Link href="/auth/forgot-password" className="font-normal text-lime-300 hover:underline">Forgot password?</Link></span><input className="auth-input" type="password" autoComplete="current-password" placeholder="Enter your password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
      {error && <p role="alert" className="rounded-xl border border-red-400/25 bg-red-400/10 px-4 py-3 text-sm text-red-300">{error}</p>}
      <button type="submit" disabled={busy} className="btn-accent w-full">{busy ? "Connecting…" : "Sign in with email"}<ArrowRight className="h-4 w-4" /></button>
    </form>
    <p className="mt-8 text-center text-sm text-muted-foreground">New to Shroud? <Link href="/auth/sign-up" onClick={(event) => { const next = safeRedirectPath(new URLSearchParams(window.location.search).get("redirect"), ""); if (next) { event.preventDefault(); router.push("/auth/sign-up?redirect=" + encodeURIComponent(next)); } }} className="font-semibold text-foreground hover:text-lime-300">Create an account</Link></p>
  </div>;
}

function GoogleIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.35 12.27c0-.71-.06-1.39-.18-2.04H12v3.86h5.22a4.46 4.46 0 0 1-1.94 2.93v2.43h3.14c1.84-1.69 2.93-4.18 2.93-7.18Z" /><path fill="#34A853" d="M12 21.75c2.63 0 4.84-.87 6.45-2.35l-3.14-2.43c-.87.58-1.98.93-3.31.93-2.54 0-4.69-1.72-5.46-4.03H3.3v2.51A9.74 9.74 0 0 0 12 21.75Z" /><path fill="#FBBC05" d="M6.54 13.87a5.86 5.86 0 0 1 0-3.74V7.62H3.3a9.75 9.75 0 0 0 0 8.76l3.24-2.51Z" /><path fill="#EA4335" d="M12 6.1c1.43 0 2.71.49 3.72 1.46l2.79-2.79C16.84 3.1 14.63 2.25 12 2.25a9.74 9.74 0 0 0-8.7 5.37l3.24 2.51C7.31 7.82 9.46 6.1 12 6.1Z" /></svg>;
}
