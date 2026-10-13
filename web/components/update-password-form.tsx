"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function UpdatePasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    if (password !== repeat) { setError("Passwords do not match."); return; }
    setBusy(true);
    try {
      const { error } = await createClient().auth.updateUser({ password });
      if (error) throw error;
      router.replace("/dashboard"); router.refresh();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Unable to update password."); }
    finally { setBusy(false); }
  }

  return <div className="auth-form">
    <div className="mb-7 flex h-12 w-12 items-center justify-center rounded-2xl border border-lime-300/20 bg-lime-300/10 text-lime-300"><LockKeyhole className="h-5 w-5" /></div>
    <p className="eyebrow">Account recovery</p>
    <h1 className="mt-3 text-4xl font-semibold tracking-[-.045em]">Choose a new password</h1>
    <p className="mt-3 text-sm leading-6 text-muted-foreground">Use at least eight characters to secure your Shroud account.</p>
    <form onSubmit={save} className="mt-9 space-y-5">
      <label className="auth-label">New password<input className="auth-input" type="password" autoComplete="new-password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
      <label className="auth-label">Confirm password<input className="auth-input" type="password" autoComplete="new-password" minLength={8} value={repeat} onChange={(event) => setRepeat(event.target.value)} required /></label>
      {error && <p role="alert" className="rounded-xl border border-red-400/25 bg-red-400/10 px-4 py-3 text-sm text-red-300">{error}</p>}
      <button type="submit" disabled={busy} className="btn-accent w-full">{busy ? "Saving..." : "Update password"}<ArrowRight className="h-4 w-4" /></button>
    </form>
    <p className="mt-8 text-center text-sm text-muted-foreground"><Link href="/login" className="font-semibold text-foreground hover:text-lime-300">Back to sign in</Link></p>
  </div>;
}
