"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChevronDown, Layers, Loader2, Plus, UserPlus } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Workspace } from "@/lib/workspace-selection";

export function WorkspaceMenu({ workspaces, active }: { workspaces: Workspace[]; active: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const current = workspaces.find((item) => item.id === active);
  async function switchWorkspace(id: string) {
    if (busy || id === active) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/workspaces", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ team_id: id }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to switch workspace.");
      router.push("/dashboard"); router.refresh();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Unable to switch workspace."); }
    finally { setBusy(false); }
  }
  return <div className="min-w-0">
    <DropdownMenu>
      <DropdownMenuTrigger disabled={busy} aria-label="Switch workspace" className="flex w-full max-w-[310px] items-center gap-3 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-left hover:bg-white/10 disabled:opacity-60">
        {busy ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-lime-300" /> : <Layers className="h-4 w-4 shrink-0 text-lime-300" />}<span className="truncate text-sm font-semibold">{current?.name ?? "Workspaces"}</span><ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-64 max-w-[90vw] border border-white/15 p-1.5">
        <DropdownMenuRadioGroup value={active} onValueChange={(value) => void switchWorkspace(String(value))}>
          {workspaces.map((workspace) => <DropdownMenuRadioItem key={workspace.id} value={workspace.id} className="py-3 data-highlighted:bg-lime-300/10 data-checked:text-lime-300"><div className="min-w-0"><p className="truncate font-medium">{workspace.name}</p><p className="mt-0.5 truncate text-xs text-muted-foreground"><span className="capitalize">{workspace.role}</span> · {workspace.slug}</p></div></DropdownMenuRadioItem>)}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/onboarding/create-team" />}><Plus className="h-4 w-4" />Create workspace</DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/onboarding/join-team" />}><UserPlus className="h-4 w-4" />Join workspace</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    {error && <p role="alert" className="mt-1 text-xs text-red-300">{error}</p>}
  </div>;
}
