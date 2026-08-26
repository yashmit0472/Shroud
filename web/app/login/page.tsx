"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Lock, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleGoogleLogin() {
    setLoading(true);
    setError("");

    const supabase = createClient();

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-md">
        <Link
          href="/"
          className="mb-10 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Shroud
        </Link>

        <div className="rounded-2xl border border-border bg-card p-8 shadow-2xl">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-muted">
            <Lock className="h-5 w-5" />
          </div>

          <h1 className="mt-7 text-2xl font-semibold tracking-tight">
            Welcome to Shroud
          </h1>

          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Sign in to manage your teams, projects, and secrets.
          </p>

          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="mt-8 flex w-full items-center justify-center gap-3 rounded-lg bg-foreground px-4 py-3 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              "Connecting..."
            ) : (
              <>
                <GoogleIcon />
                Continue with Google
              </>
            )}
          </button>

          {error && (
            <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="my-7 flex items-center gap-4">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">OR</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <p className="text-center text-xs leading-5 text-muted-foreground">
            Email and password authentication will be available here as we
            expand the authentication system.
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          By continuing, you agree to use Shroud responsibly and keep your
          credentials secure.
        </p>
      </div>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M21.35 12.27c0-.71-.06-1.39-.18-2.04H12v3.86h5.22a4.46 4.46 0 0 1-1.94 2.93v2.43h3.14c1.84-1.69 2.93-4.18 2.93-7.18Z"
      />
      <path
        fill="currentColor"
        d="M12 21.75c2.63 0 4.84-.87 6.45-2.35l-3.14-2.43c-.87.58-1.98.93-3.31.93-2.54 0-4.69-1.72-5.46-4.03H3.3v2.51A9.74 9.74 0 0 0 12 21.75Z"
      />
      <path
        fill="currentColor"
        d="M6.54 13.87a5.86 5.86 0 0 1 0-3.74V7.62H3.3a9.75 9.75 0 0 0 0 8.76l3.24-2.51Z"
      />
      <path
        fill="currentColor"
        d="M12 6.1c1.43 0 2.71.49 3.72 1.46l2.79-2.79C16.84 3.1 14.63 2.25 12 2.25a9.74 9.74 0 0 0-8.7 5.37l3.24 2.51C7.31 7.82 9.46 6.1 12 6.1Z"
      />
    </svg>
  );
}
