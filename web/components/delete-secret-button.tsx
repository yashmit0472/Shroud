"use client";
import { useSecretMutation } from "@/components/use-secret-mutation";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function DeleteSecretButton({ projectId, environmentId, secretId, secretKey }: { projectId: string; environmentId: string; secretId: string; secretKey: string }) {
  const router = useRouter();
  const mutation=useSecretMutation();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function remove() {
    setBusy(true); setError("");
    try {
      const response = await mutation.request(`/api/v1/projects/${projectId}/environments/${environmentId}/secrets/${secretId}`, { method: "DELETE" });
      if (!response.ok) { const data = await response.json(); throw new Error(data.error || "Unable to delete secret"); }
      if(response.status===202){router.push(`/dashboard/projects/${projectId}?tab=activity`);router.refresh();return;}
      router.push(`/dashboard/projects/${projectId}/environments/${environmentId}`); router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to delete secret"); setBusy(false); }
  }
  return <>{mutation.confirmation}<section className="mt-10 space-y-4 rounded-xl border border-destructive/30 p-5"><h2 className="font-semibold">Delete secret</h2><p className="text-sm text-muted-foreground">Deleting this secret cannot be undone. Clients will stop receiving this key.</p>
    {!open ? <Button variant="destructive" onClick={() => setOpen(true)}>Delete secret</Button> : <div className="space-y-3"><Label htmlFor="delete-confirmation">Type {secretKey} to confirm</Label><Input id="delete-confirmation" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} disabled={busy} autoComplete="off" /><div className="flex gap-3"><Button variant="destructive" disabled={busy || confirmation !== secretKey} onClick={remove}>{busy ? "Deleting..." : "Confirm deletion"}</Button><Button variant="outline" disabled={busy} onClick={() => { setOpen(false); setConfirmation(""); }}>Cancel</Button></div></div>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </section></>;
}
