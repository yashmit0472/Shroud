import { Suspense } from "react";
import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { projectAccess } from "@/lib/workspace-access";

type Params = { projectId: string; environmentId: string; secretId: string };
async function Content({ params }: { params: Promise<Params> }) {
  await connection();
  const { projectId, environmentId, secretId } = await params;
  const access = await projectAccess(projectId, environmentId);
  if (access.status === 401) redirect("/login");
  if (access.status === 500) throw new Error("Unable to verify project access.");
  if (access.status !== 200) notFound();
  const { data: secret, error: secretError } = await access.supabase.from("secrets").select("id,key").eq("id", secretId).eq("environment_id", environmentId).maybeSingle();
  if (secretError) throw new Error("Unable to load secret.");
  if (!secret) notFound();
  const { data: versions, error } = await access.supabase.rpc("shroud_secret_history", { p_project_id: projectId, p_environment_id: environmentId, p_secret_id: secretId });
  if (error) throw new Error("Unable to load version history. Check that the core database migration has been applied.");
  return <main className="mx-auto min-h-screen max-w-3xl space-y-8 px-6 py-12">
    <Link href={`/dashboard/projects/${projectId}/environments/${environmentId}`} className="text-sm text-muted-foreground hover:underline">← Environment</Link>
    <div><h1 className="break-all font-mono text-2xl font-semibold">{secret.key}</h1><p className="mt-2 text-muted-foreground">Version history. Values remain encrypted and are hidden here.</p></div>
    <ol className="space-y-3">{(versions ?? []).map((version: { id: string; version: number; created_at: string; created_by: string | null }, index: number) => <li key={version.id} className="rounded-xl border p-5"><p className="font-medium">Version {version.version}{index === 0 && <span className="ml-3 text-xs text-muted-foreground">Latest</span>}</p><p className="mt-2 text-sm text-muted-foreground">{new Date(version.created_at).toLocaleString()}</p><p className="mt-1 break-all text-xs text-muted-foreground">Changed by: {version.created_by ?? "Unknown actor"}</p></li>)}</ol>
    {!versions?.length && <p>No versions found.</p>}
  </main>;
}
export default function Page({ params }: { params: Promise<Params> }) { return <Suspense fallback={<p className="p-12">Loading history...</p>}><Content params={params} /></Suspense>; }
