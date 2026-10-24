import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { requireWorkspace } from "@/lib/workspace-context";
import { PageSkeleton } from "@/components/empty-state";
import { DatabaseStatus } from "@/components/database-status";
import { canManage } from "@/lib/workspace-access";

async function Settings(){
  await connection();
  const {supabase,userId,workspace,membership}=await requireWorkspace();
  const {data:profile}=await supabase.from("profiles").select("full_name").eq("id",userId).maybeSingle();
  const {data:identity}=await supabase.auth.getClaims();
  return <main><div className="page-heading"><div><h1>Settings</h1><p>Your account and current workspace.</p></div></div>
    <section className="surface-card p-5"><h2>Account</h2><dl className="mt-4 grid gap-5 text-xs sm:grid-cols-2"><div><dt className="text-muted-foreground">Name</dt><dd className="mt-1">{profile?.full_name||"Not set"}</dd></div><div><dt className="text-muted-foreground">Email</dt><dd className="mt-1 break-all">{String(identity?.claims?.email??"Not available")}</dd></div></dl><Link href="/auth/forgot-password" className="btn-outline mt-5">Reset password</Link></section>
    <section className="surface-card mt-4 p-5"><h2>Workspace</h2><dl className="mt-4 grid gap-5 text-xs sm:grid-cols-2"><div><dt className="text-muted-foreground">Name</dt><dd className="mt-1">{workspace.name}</dd></div><div><dt className="text-muted-foreground">Your role</dt><dd className="mt-1 capitalize">{membership.role}</dd></div><div><dt className="text-muted-foreground">Workspace ID</dt><dd className="mt-1 break-all font-mono">{workspace.id}</dd></div></dl><div className="mt-5 flex flex-wrap gap-2"><Link href="/onboarding/create-team" className="btn-outline">Create workspace</Link><Link href="/onboarding/join-team" className="btn-outline">Join workspace</Link><Link href="/dashboard/members" className="btn-outline">Manage team</Link></div></section>
    {canManage(membership.role)&&<DatabaseStatus/>}
  </main>;
}
export default function Page(){return <Suspense fallback={<PageSkeleton/>}><Settings/></Suspense>;}
