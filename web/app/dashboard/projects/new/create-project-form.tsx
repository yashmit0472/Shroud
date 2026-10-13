"use client";
import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CreateProjectForm({ teamId }: { teamId: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [isNavigating, startNavigation] = useTransition();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/v1/projects/create", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ team_id: teamId, name: form.get("name"), description: form.get("description") }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to create project");
      if (typeof data.project_id !== "string") throw new Error("Unable to open the created project. Return to the workspace overview.");
      startNavigation(() => { router.push(`/dashboard/projects/${data.project_id}`); router.refresh(); });
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to create project"); }
    finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="space-y-6 rounded-xl border bg-card p-6">
    <div className="space-y-2"><Label htmlFor="name">Project name</Label><Input id="name" name="name" placeholder="Backend API" required maxLength={100} disabled={busy} /></div>
    <div className="space-y-2"><Label htmlFor="description">Description (optional)</Label><Input id="description" name="description" maxLength={1000} disabled={busy} /></div>
    <p className="text-sm text-muted-foreground">Development, staging, and production environments will be created automatically.</p>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <Button type="submit" disabled={busy || isNavigating}>{busy || isNavigating ? "Creating..." : "Create project"}</Button>
  </form>;
}
