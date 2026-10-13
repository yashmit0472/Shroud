import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { requireWorkspace } from "@/lib/workspace-context";
import { TeamMembers } from "@/components/team-members";

async function MembersContent() {
  await connection();
  const { membership, userId } = await requireWorkspace();
  return <main className="mx-auto max-w-5xl space-y-8">
    <div><p className="eyebrow">Workspace access</p><h1 className="mt-3 text-4xl font-semibold tracking-tight">Team & invitations</h1><p className="mt-3 max-w-2xl text-muted-foreground">Create an invitation link, token, or code to share with a teammate. Choose their role and when the invitation expires.</p><Link href="/dashboard/tokens" className="mt-4 inline-block text-sm font-semibold text-lime-300 hover:underline">Need an API token for CLI or CI? Create one here →</Link></div>
    <TeamMembers key={membership.team_id} teamId={membership.team_id} currentUserId={userId} currentUserRole={membership.role} />
  </main>;
}

export default function MembersPage() {
  return <Suspense fallback={<p className="p-8 text-muted-foreground">Loading team...</p>}><MembersContent /></Suspense>;
}
