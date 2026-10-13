import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { requireWorkspace } from "@/lib/workspace-context";
import { canWrite } from "@/lib/workspace-access";
import { CreateProjectForm } from "./create-project-form";

async function Content() {
  await connection();
  const { membership } = await requireWorkspace();
  return <main className="mx-auto min-h-screen max-w-2xl space-y-8 px-6 py-12"><Link href="/dashboard" className="text-sm text-muted-foreground hover:underline">← Workspace</Link><h1 className="text-3xl font-semibold">New project</h1>{canWrite(membership.role) ? <CreateProjectForm key={membership.team_id} teamId={membership.team_id} /> : <p>Ask a team admin or developer to create a project.</p>}</main>;
}
export default function Page() { return <Suspense fallback={<p className="p-12">Loading workspace...</p>}><Content /></Suspense>; }
