import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { requireWorkspace } from "@/lib/workspace-context";
import { TeamMembers } from "@/components/team-members";

async function MembersContent() {
  await connection();
  const { membership, userId } = await requireWorkspace();
  return <main className="space-y-6">
    <div><p className="eyebrow">Workspace access</p><h1 className="mt-3 text-4xl font-semibold tracking-tight">Team & invitations</h1><p className="mt-2 text-xs text-muted-foreground">Manage workspace members and share invitation links with your teammates.</p><Link href="/dashboard/tokens" className="mt-3 inline-block text-[11px] text-muted-foreground hover:underline">Need an API token for CLI or CI? Create one here →</Link></div>
    <TeamMembers key={membership.team_id} teamId={membership.team_id} currentUserId={userId} currentUserRole={membership.role} />
  </main>;
}

export default function MembersPage() {
  return <Suspense fallback={<p className="p-8 text-muted-foreground">Loading team...</p>}><MembersContent /></Suspense>;
}
