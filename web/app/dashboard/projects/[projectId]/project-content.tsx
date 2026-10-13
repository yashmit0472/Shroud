import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { environmentHealth } from "@/lib/environment-health";
import { RequiredKeyManager } from "@/components/required-key-manager";
import { canManage } from "@/lib/workspace-access";
import { ProjectMemberManager } from "@/components/project-member-manager";
import { DeleteProjectButton } from "@/components/delete-project-button";

type ProjectContentProps = {
    params: Promise<{
        projectId: string;
    }>;
};

export default async function ProjectContent({
    params,
}: ProjectContentProps) {
    const { projectId } = await params;

    const supabase = await createClient();

    const {
        data: claimsData,
        error: claimsError,
    } = await supabase.auth.getClaims();

    if (claimsError || !claimsData?.claims?.sub) {
        redirect("/login");
    }

    const userId = claimsData.claims.sub;

    const { data: project, error: projectError } = await supabase
        .from("projects")
        .select(
            "id, name, slug, description, team_id, created_at"
        )
        .eq("id", projectId)
        .maybeSingle();

    if (projectError) {
        console.error("FAILED TO LOAD PROJECT:", {
            message: projectError.message,
            code: projectError.code,
            details: projectError.details,
            hint: projectError.hint,
        });

        throw new Error("Unable to load this project.");
    }

    if (!project) {
        notFound();
    }

    /*
     * Verify that the current user belongs to the project.
     *
     * A user can reach this URL manually, so we should not rely
     * only on the project ID being valid.
     */
    const { data: membership, error: membershipError } = await supabase
        .from("project_members")
        .select("role")
        .eq("project_id", project.id)
        .eq("user_id", userId)
        .maybeSingle();

    if (membershipError) {
        console.error("FAILED TO LOAD PROJECT MEMBERSHIP:", {
            message: membershipError.message,
            code: membershipError.code,
            details: membershipError.details,
            hint: membershipError.hint,
        });

        throw new Error("Unable to verify your project access.");
    }

    if (!membership) {
        return <main className="mx-auto max-w-2xl space-y-5 py-12"><p className="eyebrow">Project access</p><h1 className="text-3xl font-semibold">Access to {project.name} is required</h1><p className="text-muted-foreground">You belong to this workspace, but your account has no role in this project. Ask a project owner or admin to add you.</p><Link href="/dashboard" className="btn-outline">Back to workspace</Link></main>;
    }

    const {
        data: environments,
        error: environmentsError,
    } = await supabase
        .from("environments")
        .select("id, name, slug, type, created_at")
        .eq("project_id", project.id)
        .order("created_at", { ascending: true });

    if (environmentsError) {
        console.error("FAILED TO LOAD ENVIRONMENTS:", {
            message: environmentsError.message,
            code: environmentsError.code,
            details: environmentsError.details,
            hint: environmentsError.hint,
        });

        throw new Error("Unable to load project environments.");
    }

    const environmentIds = (environments ?? []).map((environment) => environment.id);
    const { data: keyMetadata, error: keyError } = environmentIds.length
        ? await supabase.from("secrets").select("environment_id, key, is_required").in("environment_id", environmentIds)
        : { data: [], error: null };
    const { data: requiredKeys, error: requiredError } = await supabase.from("required_keys").select("key").eq("project_id", project.id);
    if (keyError || requiredError) {
        console.error("FAILED TO CHECK ENVIRONMENT CONSISTENCY:", {
            secrets: keyError && { message: keyError.message, code: keyError.code, details: keyError.details, hint: keyError.hint },
            requiredKeys: requiredError && { message: requiredError.message, code: requiredError.code, details: requiredError.details, hint: requiredError.hint },
        });
        throw new Error("Unable to check environment consistency.");
    }
    const health = environmentHealth(environmentIds, keyMetadata ?? [], (requiredKeys ?? []).map((entry) => entry.key));
    const { data: teamMembers, error: teamMembersError } = canManage(membership.role)
        ? await supabase.rpc("list_team_members", { p_team_id: project.team_id, p_user_id: userId })
        : { data: [], error: null };
    const { data: projectMembers, error: projectMembersError } = canManage(membership.role)
        ? await supabase.from("project_members").select("user_id,role").eq("project_id", project.id)
        : { data: [], error: null };
    if (teamMembersError || projectMembersError) throw new Error("Unable to load project access settings.");

    return (
        <main className="min-h-screen px-6 py-16">
            <div className="mx-auto max-w-6xl">
                <div>
                    <p className="text-sm text-muted-foreground">
                        Project
                    </p>

                    <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                            <h1 className="text-3xl font-semibold tracking-tight">
                                {project.name}
                            </h1>

                            <p className="mt-2 max-w-2xl text-muted-foreground">
                                {project.description ||
                                    "No description provided."}
                            </p>
                        </div>

                        <div className="rounded-md border px-3 py-1.5 text-sm text-muted-foreground">
                            {project.slug}
                        </div>
                    </div>
                </div>

                <div className="mt-12">
                    <h2 className="text-xl font-semibold">
                        Environments
                    </h2>

                    <p className="mt-2 text-sm text-muted-foreground">
                        Manage secrets and configuration for each environment.
                    </p>

                    <div className="mt-6 grid gap-5 md:grid-cols-3">
                        {environments && environments.length > 0 ? (
                            environments.map((environment) => (
                                <a
                                    key={environment.id}
                                    href={`/dashboard/projects/${project.id}/environments/${environment.id}`}
                                    className="group rounded-2xl border bg-card p-6 transition-all hover:-translate-y-0.5 hover:bg-muted/40"
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <p className="text-sm text-muted-foreground">
                                                {environment.type}
                                            </p>

                                            <h3 className="mt-2 text-lg font-semibold">
                                                {environment.name}
                                            </h3>
                                            {!!health.find((item) => item.id === environment.id)?.missingRequired.length && (
                                                <p className="mt-3 rounded-md bg-destructive/10 p-2 text-xs text-destructive">
                                                    Missing required: {health.find((item) => item.id === environment.id)?.missingRequired.join(", ")}
                                                </p>
                                            )}
                                            {!!health.find((item) => item.id === environment.id)?.missingOptional.length && (
                                                <p className="mt-2 text-xs text-muted-foreground">Other missing keys: {health.find((item) => item.id === environment.id)?.missingOptional.join(", ")}</p>
                                            )}

                                            <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                                Manage secrets and configuration for this environment.
                                            </p>
                                        </div>

                                        <span className="text-lg text-muted-foreground transition-transform group-hover:translate-x-1">
                                            →
                                        </span>
                                    </div>

                                    <div className="mt-6 text-sm font-medium">
                                        Open environment
                                    </div>
                                </a>
                            ))
                        ) : (
                            <div className="rounded-2xl border border-dashed p-8 md:col-span-3">
                                <h3 className="font-medium">
                                    No environments found
                                </h3>

                                <p className="mt-2 text-sm text-muted-foreground">
                                    This project does not have any environments yet.
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="mt-12"><RequiredKeyManager projectId={project.id} keys={(requiredKeys ?? []).map((entry) => entry.key)} canEdit={canManage(membership.role)} /></div>
                {canManage(membership.role) && <div className="mt-8"><ProjectMemberManager projectId={project.id} currentRole={membership.role} members={(teamMembers ?? []).map((member: { user_id: string; full_name: string | null }) => ({ ...member, projectRole: projectMembers?.find((entry) => entry.user_id === member.user_id)?.role ?? null }))} /></div>}
                <div className="mt-12 rounded-2xl border bg-card p-6">
                    <h2 className="text-xl font-semibold">
                        Project details
                    </h2>

                    <div className="mt-5 grid gap-5 sm:grid-cols-2">
                        <div>
                            <p className="text-sm text-muted-foreground">
                                Your role
                            </p>

                            <p className="mt-1 font-medium capitalize">
                                {membership.role}
                            </p>
                        </div>

                        <div>
                            <p className="text-sm text-muted-foreground">
                                Project ID
                            </p>

                            <p className="mt-1 break-all font-mono text-sm">
                                {project.id}
                            </p>
                        </div>
                    </div>
                </div>
                {canManage(membership.role) && <DeleteProjectButton projectId={project.id} name={project.name} />}
            </div>
        </main>
    );
}
