import { connection } from "next/server";
import Link from "next/link";

import { requireWorkspace } from "@/lib/workspace-context";
import { TeamMembers } from "@/components/team-members";
import { ArrowRight, FolderKanban, KeyRound, Plus, ScrollText, Terminal, Users } from "lucide-react";

export default async function DashboardContent() {
    // This page depends on the current user's session,
    // so it must be rendered dynamically.
    await connection();

    const { supabase, userId, workspace: team, membership } = await requireWorkspace();
    const teamId = team.id;

    const {
        data: projects,
        error: projectsError,
    } = await supabase
        .from("projects")
        .select("id, name, slug, description, created_at")
        .eq("team_id", teamId)
        .order("created_at", { ascending: false });

    if (projectsError) {
        console.error(
            "FAILED TO LOAD PROJECTS:",
            JSON.stringify(
                {
                    message: projectsError.message,
                    code: projectsError.code,
                    details: projectsError.details,
                    hint: projectsError.hint,
                },
                null,
                2
            )
        );

        throw new Error("Unable to load your projects.");
    }

    const { data: accessibleProjects, error: accessError } = projects?.length
        ? await supabase.from("project_members").select("project_id").eq("user_id", userId).in("project_id", projects.map((project) => project.id))
        : { data: [], error: null };
    if (accessError) throw new Error("Unable to check project access.");
    const accessibleProjectIds = new Set((accessibleProjects ?? []).map((entry) => entry.project_id));

    return (
      <main className="dashboard-page">
        <div className="mx-auto max-w-[1240px]">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div>
              <p className="eyebrow"><span className="status-dot" /> Workspace overview</p>
              <h1 className="mt-4 text-4xl font-semibold tracking-[-.05em] sm:text-5xl">{team.name}</h1>
              <p className="mt-3 text-muted-foreground">Your projects, people, and environments at a glance.</p>
            </div>
            <div className="flex flex-wrap gap-2"><Link href="/dashboard/members" className="btn-outline"><Users className="h-4 w-4" /> Team & invites</Link><Link href="/dashboard/tokens" className="btn-outline"><KeyRound className="h-4 w-4" /> API tokens</Link><Link href="/dashboard/projects/new" className="btn-accent"><Plus className="h-4 w-4" /> New project</Link></div>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            <div className="metric-card"><div className="flex items-center justify-between"><p className="text-sm text-muted-foreground">Active projects</p><FolderKanban className="h-5 w-5 text-lime-300" /></div><p className="mt-6 text-4xl font-semibold tracking-tight">{projects?.length ?? 0}</p><p className="mt-2 text-xs text-muted-foreground">In this workspace</p></div>
            <div className="metric-card"><div className="flex items-center justify-between"><p className="text-sm text-muted-foreground">Your access</p><Users className="h-5 w-5 text-lime-300" /></div><p className="mt-6 text-3xl font-semibold capitalize tracking-tight">{membership.role}</p><p className="mt-2 text-xs text-muted-foreground">Team role</p></div>
            <div className="metric-card"><div className="flex items-center justify-between"><p className="text-sm text-muted-foreground">Developer tools</p><Terminal className="h-5 w-5 text-lime-300" /></div><p className="mt-6 text-3xl font-semibold tracking-tight">CLI ready</p><Link href="/dashboard/cli" className="mt-2 inline-flex items-center gap-1 text-xs text-lime-300 hover:underline">Get started <ArrowRight className="h-3 w-3" /></Link></div>
          </div>
          <section id="projects" className="mt-14 scroll-mt-28">
            <div className="flex items-end justify-between gap-4"><div><p className="eyebrow">Your work</p><h2 className="mt-2 text-2xl font-semibold tracking-tight">Projects</h2><p className="mt-2 text-sm text-muted-foreground">Select a project to manage its environments and secrets.</p></div><span className="hidden rounded-full border border-white/10 px-3 py-1 text-xs text-muted-foreground sm:inline">{projects?.length ?? 0} total</span></div>
            {projects && projects.length ? <div className="mt-6 grid gap-4 md:grid-cols-2">{projects.map((project) => !accessibleProjectIds.has(project.id) ? <div key={project.id} className="surface-card p-6"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/5 text-muted-foreground"><KeyRound className="h-5 w-5" /></span><h3 className="mt-6 text-lg font-semibold">{project.name}</h3><p className="mt-1 font-mono text-xs text-muted-foreground">{project.slug}</p><p className="mt-4 text-sm leading-6 text-muted-foreground">Project access is required. Ask a project owner or admin to add your account.</p><div className="mt-6 border-t border-white/10 pt-4 text-xs font-semibold text-amber-300">Access required</div></div> : <Link key={project.id} href={"/dashboard/projects/" + project.id} className="surface-card group p-6 transition hover:-translate-y-1 hover:border-lime-300/50"><div className="flex items-start justify-between"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-lime-300/10 text-lime-300"><FolderKanban className="h-5 w-5" /></span><ArrowRight className="h-5 w-5 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-lime-300" /></div><h3 className="mt-6 text-lg font-semibold">{project.name}</h3><p className="mt-1 font-mono text-xs text-muted-foreground">{project.slug}</p><p className="mt-4 line-clamp-2 min-h-10 text-sm leading-6 text-muted-foreground">{project.description || "Manage environments, secrets, and project access."}</p><div className="mt-6 border-t border-white/10 pt-4 text-xs font-semibold text-lime-300">Open project â†’</div></Link>)}</div> : <div className="surface-card mt-6 flex flex-col items-center p-12 text-center"><FolderKanban className="h-8 w-8 text-lime-300" /><h3 className="mt-4 text-lg font-semibold">No projects yet</h3><p className="mt-2 max-w-sm text-sm text-muted-foreground">Create a project to organize environments and add your first secret.</p><Link href="/dashboard/projects/new" className="btn-accent mt-6">Create project <ArrowRight className="h-4 w-4" /></Link></div>}
          </section>
          <section className="mt-14 grid gap-4 lg:grid-cols-[1.2fr_.8fr]"><div className="surface-card overflow-hidden"><div className="flex items-center justify-between border-b border-white/10 px-6 py-4"><span className="flex items-center gap-2 text-sm font-semibold"><Terminal className="h-4 w-4 text-lime-300" /> Work from your terminal</span><span className="text-xs text-muted-foreground">Browser terminal</span></div><div className="space-y-3 p-6 font-mono text-sm"><p><span className="text-lime-300">$</span> shroud projects</p><p><span className="text-lime-300">$</span> shroud use {projects?.[0]?.slug ?? "my-project"}</p><p className="text-muted-foreground">âœ“ Then: shroud env development</p></div><div className="border-t border-white/10 px-6 py-4"><Link href="/dashboard/cli" className="inline-flex items-center gap-2 text-xs font-semibold text-lime-300 hover:underline">Open browser terminal <ArrowRight className="h-3.5 w-3.5" /></Link></div></div><div className="surface-card flex flex-col justify-between p-6"><div><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-lime-300/10 text-lime-300"><ScrollText className="h-5 w-5" /></div><h3 className="mt-5 text-lg font-semibold">Keep a clear record</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">See secret changes, token activity, and workspace events in one audit trail.</p></div><Link href="/dashboard/audit" className="mt-6 inline-flex items-center gap-2 text-xs font-semibold text-lime-300 hover:underline">View audit log <ArrowRight className="h-3.5 w-3.5" /></Link></div></section>
          <section className="mt-14"><TeamMembers key={team.id} teamId={team.id} currentUserId={userId} currentUserRole={membership.role} /></section>
        </div>
      </main>
    );
}
