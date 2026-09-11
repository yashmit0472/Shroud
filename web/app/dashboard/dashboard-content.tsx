import { connection } from "next/server";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { TeamMembers } from "@/components/team-members";

export default async function DashboardContent() {
    // This page depends on the current user's session,
    // so it must be rendered dynamically.
    await connection();

    const supabase = await createClient();

    const {
        data: claimsData,
        error: claimsError,
    } = await supabase.auth.getClaims();

    if (claimsError || !claimsData?.claims?.sub) {
        redirect("/login");
    }

    const userId = claimsData.claims.sub;

    const {
        data: membership,
        error: membershipError,
    } = await supabase
        .from("team_members")
        .select("team_id, role")
        .eq("user_id", userId)
        .limit(1)
        .maybeSingle();

    if (membershipError) {
        console.error("Failed to load team membership:", {
            message: membershipError.message,
            code: membershipError.code,
            details: membershipError.details,
            hint: membershipError.hint,
        });

        throw new Error("Unable to load your workspace.");
    }

    // A user who has authenticated but has not joined/created
    // a team should go back through onboarding.
    if (!membership?.team_id) {
        redirect("/onboarding");
    }

    const teamId = membership.team_id;

    const {
        data: team,
        error: teamError,
    } = await supabase
        .from("teams")
        .select("id, name, slug, owner_id")
        .eq("id", teamId)
        .maybeSingle();

    if (teamError) {
        console.error(
            "FAILED TO LOAD TEAM:",
            JSON.stringify(
                {
                    message: teamError.message,
                    code: teamError.code,
                    details: teamError.details,
                    hint: teamError.hint,
                },
                null,
                2
            )
        );

        throw new Error("Unable to load your team.");
    }

    if (!team) {
        redirect("/onboarding");
    }

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

    return (
        <main className="min-h-screen px-6 py-16">
            <div className="mx-auto max-w-6xl">
                {/* Header */}
                <div className="flex flex-col gap-2">
                    <p className="text-sm font-medium text-muted-foreground">
                        Workspace
                    </p>

                    <h1 className="text-3xl font-semibold tracking-tight">
                        {team.name}
                    </h1>

                    <p className="text-muted-foreground">
                        Manage your projects, environments, and secrets.
                    </p>
                </div>

                {/* Overview */}
                <div className="mt-10 grid gap-4 sm:grid-cols-3">
                    <div className="rounded-xl border border-border bg-card p-5">
                        <p className="text-sm text-muted-foreground">
                            Your role
                        </p>

                        <p className="mt-2 text-xl font-semibold capitalize">
                            {membership.role}
                        </p>
                    </div>

                    <div className="rounded-xl border border-border bg-card p-5">
                        <p className="text-sm text-muted-foreground">
                            Projects
                        </p>

                        <p className="mt-2 text-xl font-semibold">
                            {projects?.length ?? 0}
                        </p>
                    </div>

                    <div className="rounded-xl border border-border bg-card p-5">
                        <p className="text-sm text-muted-foreground">
                            Workspace
                        </p>

                        <p className="mt-2 text-xl font-semibold">
                            {team.slug}
                        </p>
                    </div>
                </div>

                {/* Projects */}
                <section className="mt-12">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-semibold">
                                Projects
                            </h2>

                            <p className="mt-1 text-sm text-muted-foreground">
                                Projects belonging to this workspace.
                            </p>
                        </div>

                        <a
                            href="/dashboard/projects/new"
                            className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
                        >
                            New project
                        </a>
                    </div>

                    {projects && projects.length > 0 ? (
                        <div className="mt-6 grid gap-4 md:grid-cols-2">
                            {projects.map((project) => (
                                <a
                                    key={project.id}
                                    href={`/dashboard/projects/${project.id}`}
                                    className="group rounded-xl border border-border bg-card p-6 transition-all hover:-translate-y-0.5 hover:bg-muted/40"
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="min-w-0">
                                            <h3 className="font-semibold group-hover:underline">
                                                {project.name}
                                            </h3>

                                            <p className="mt-1 text-sm text-muted-foreground">
                                                {project.slug}
                                            </p>
                                        </div>

                                        <span className="text-lg text-muted-foreground transition-transform group-hover:translate-x-1">
                                            →
                                        </span>
                                    </div>

                                    {project.description && (
                                        <p className="mt-4 line-clamp-2 text-sm text-muted-foreground">
                                            {project.description}
                                        </p>
                                    )}
                                </a>
                            ))}
                        </div>
                    ) : (
                        <div className="mt-6 rounded-xl border border-dashed border-border p-10 text-center">
                            <h3 className="font-medium">
                                No projects yet
                            </h3>

                            <p className="mt-2 text-sm text-muted-foreground">
                                Create your first project to start managing
                                environments and secrets.
                            </p>

                            <a
                                href="/dashboard/projects/new"
                                className="mt-5 inline-flex rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
                            >
                                Create project
                            </a>
                        </div>
                    )}
                </section>

                {/* Team Members */}
                <section className="mt-12">
                    <TeamMembers
                        teamId={team.id}
                        currentUserId={userId}
                        currentUserRole={membership.role}
                    />
                </section>
            </div>
        </main>
    );
}