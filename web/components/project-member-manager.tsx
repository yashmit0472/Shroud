"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
type Member = { user_id: string; full_name: string | null; projectRole: string | null };
export function ProjectMemberManager({ projectId, members, currentRole }: { projectId: string; members: Member[]; currentRole: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Record<string, string>>({});
  async function save(member: Member) {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/v1/projects/${projectId}/members`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: member.user_id, role: selected[member.user_id] || null }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to change access");
      setSelected((previous) => { const next = { ...previous }; delete next[member.user_id]; return next; });
      router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to change access"); }
    finally { setBusy(false); }
  }
  return <section className="space-y-5 rounded-xl border p-6"><h2 className="text-xl font-semibold">Project access</h2><p className="text-sm text-muted-foreground">Give teammates access to this project. API tokens grant access across their workspace.</p>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <ul className="space-y-3">{members.map((member) => <li key={member.user_id} className="flex flex-wrap items-center justify-between gap-4 rounded-lg border p-4"><div><p className="text-sm font-medium">{member.full_name || "Team member"}</p><p className="mt-1 break-all font-mono text-xs text-muted-foreground">{member.user_id}</p></div>
      {member.projectRole === "owner" || (currentRole === "admin" && member.projectRole === "admin") ? <span className="text-sm capitalize">{member.projectRole}</span> : <div className="flex gap-2"><select aria-label={`Project role for ${member.full_name || member.user_id}`} value={selected[member.user_id] ?? member.projectRole ?? ""} onChange={(event) => setSelected({ ...selected, [member.user_id]: event.target.value })} disabled={busy} className="rounded-md border bg-background p-2 text-sm"><option value="">No access</option><option value="viewer">Viewer</option><option value="developer">Developer</option>{currentRole === "owner" && <option value="admin">Admin</option>}</select><Button variant="outline" disabled={busy || selected[member.user_id] === undefined} onClick={() => save(member)}>Save</Button></div>}
    </li>)}</ul></section>;
}
