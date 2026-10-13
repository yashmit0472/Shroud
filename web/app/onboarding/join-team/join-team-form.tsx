"use client";
import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function JoinTeamForm() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [isOpening, startNavigation] = useTransition();
  function submit(event: FormEvent) {
    event.preventDefault(); setError("");
    let token = value.trim();
    if (!/^[a-f0-9]{64}$/i.test(token)) {
      try { token = new URL(token, window.location.origin).pathname.match(/^\/invite\/([a-f0-9]{64})\/?$/i)?.[1] ?? ""; } catch { token = ""; }
    }
    if (!token) { setError("Paste a valid Shroud invitation link or its full token."); return; }
    startNavigation(() => router.push(`/invite/${encodeURIComponent(token)}`));
  }
  return <form onSubmit={submit} aria-busy={isOpening} className="space-y-4"><Label htmlFor="invite-link">Invitation link or token</Label><Input id="invite-link" value={value} onChange={(event) => setValue(event.target.value)} required disabled={isOpening} autoComplete="off" placeholder="https://your-shroud-site/invite/..." />{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<Button type="submit" disabled={isOpening}>{isOpening ? "Opening invitation..." : "Open invitation"}</Button></form>;
}
