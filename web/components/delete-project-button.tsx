"use client";
import { useSecretMutation } from "@/components/use-secret-mutation";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
export function DeleteProjectButton({ projectId, name }: { projectId: string; name: string }) {
  const router = useRouter();
  const mutation=useSecretMutation();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function remove() {
    setBusy(true); setError("");
    try {
      const response = await mutation.request(`/api/v1/projects/${projectId}`, { method: "DELETE" });
      if (!response.ok) { const data = await response.json(); throw new Error(data.error || "Unable to delete project"); }
      router.push("/dashboard"); router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to delete project"); setBusy(false); }
  }
  return <>{mutation.confirmation}<section className="mt-8 space-y-4 rounded-xl border border-destructive/30 p-6"><h2 className="font-semibold">Delete project</h2><p className="text-sm text-muted-foreground">Remove this project and its environments and secrets. This cannot be undone.</p>
    {!open ? <Button variant="destructive" onClick={() => setOpen(true)}>Delete project</Button> : <div className="space-y-3"><Label htmlFor="delete-project">Type {name} to confirm</Label><Input id="delete-project" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} disabled={busy} /><div className="flex gap-3"><Button variant="destructive" disabled={busy || confirmation !== name} onClick={remove}>{busy ? "Deleting..." : "Confirm deletion"}</Button><Button variant="outline" disabled={busy} onClick={() => { setOpen(false); setConfirmation(""); }}>Cancel</Button></div></div>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </section></>;
}
