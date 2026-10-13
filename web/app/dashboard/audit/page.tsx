import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { requireWorkspace } from "@/lib/workspace-context";
import { AuditViewer } from "@/components/audit-viewer";

async function Content() {
  await connection();
  const { membership } = await requireWorkspace();
  return <main className="mx-auto min-h-screen max-w-6xl space-y-8 px-6 py-12"><Link href="/dashboard" className="text-sm text-muted-foreground hover:underline">← Workspace</Link><div><h1 className="text-3xl font-semibold">Audit log</h1><p className="mt-2 text-muted-foreground">Secret access and workspace changes. Filter events or export them for review.</p></div><AuditViewer key={membership.team_id} teamId={membership.team_id} /></main>;
}
export default function Page() { return <Suspense fallback={<p className="p-12">Loading activity...</p>}><Content /></Suspense>; }
