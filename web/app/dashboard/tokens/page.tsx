import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { requireWorkspace } from "@/lib/workspace-context";
import { canManage } from "@/lib/workspace-access";
import { TokenManager } from "@/components/token-manager";

async function TokensContent() {
  await connection();
  const { membership } = await requireWorkspace();
  return <main className="space-y-6">
    <Link href="/dashboard" className="text-sm text-muted-foreground hover:underline">← Workspace</Link>
    <div><p className="eyebrow">Developer access</p><h1 className="mt-3 text-4xl font-semibold tracking-tight">API tokens</h1><p className="mt-2 text-muted-foreground">Manage credentials for the Shroud CLI, CI/CD, and your servers.</p><Link href="/dashboard/cli" className="mt-3 inline-flex text-[11px] text-muted-foreground hover:underline">Open browser terminal →</Link></div>
    {canManage(membership.role) ? <TokenManager key={membership.team_id} teamId={membership.team_id} /> : <p className="rounded-xl border p-6">Ask a workspace owner or admin to create a token for you.</p>}
  </main>;
}

export default function TokensPage() {
  return <Suspense fallback={<p className="p-12">Loading token settings...</p>}><TokensContent /></Suspense>;
}
