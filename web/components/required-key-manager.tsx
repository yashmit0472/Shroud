"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function RequiredKeyManager({ projectId, keys, canEdit }: { projectId: string; keys: string[]; canEdit: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState("");
  const [error, setError] = useState("");
  async function change(method: "POST" | "DELETE", value: string) {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/v1/projects/${projectId}/required-keys${method === "DELETE" ? `?key=${encodeURIComponent(value)}` : ""}`, { method, headers: { "Content-Type": "application/json" }, ...(method === "POST" ? { body: JSON.stringify({ key: value }) } : {}) });
      if (!response.ok) { const data = await response.json(); throw new Error(data.error || "Unable to update required keys"); }
      if (method === "POST") setKey(""); router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to update required keys"); }
    finally { setBusy(false); }
  }
  return <section className="space-y-5 rounded-xl border p-6"><h2 className="text-xl font-semibold">Required keys</h2><p className="text-sm text-muted-foreground">Every environment should contain these keys. Missing keys appear as warnings on the project screen.</p>
    {canEdit && <form onSubmit={(event: FormEvent) => { event.preventDefault(); change("POST", key); }} className="space-y-2"><Label htmlFor="required-key">Variable name</Label><div className="flex gap-3"><Input id="required-key" value={key} onChange={(e) => setKey(e.target.value)} required pattern="[A-Za-z_][A-Za-z0-9_]*" placeholder="DATABASE_URL" disabled={busy} /><Button type="submit" disabled={busy}>Add</Button></div></form>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {keys.length ? <ul className="space-y-2">{keys.map((entry) => <li key={entry} className="flex items-center justify-between gap-4 rounded-md border p-3"><code className="break-all text-sm">{entry}</code>{canEdit && <Button variant="outline" size="sm" disabled={busy} onClick={() => change("DELETE", entry)}>Remove requirement</Button>}</li>)}</ul> : <p className="text-sm text-muted-foreground">No project-wide requirements yet. Secrets marked required are also checked across environments.</p>}
  </section>;
}
