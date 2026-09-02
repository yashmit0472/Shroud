import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

type EnvironmentContentProps = {
    params: Promise<{
        projectId: string;
        environmentId: string;
    }>;
};

export default async function EnvironmentContent({
    params,
}: EnvironmentContentProps) {
    await connection();

    const { projectId, environmentId } = await params;

    const supabase = await createClient();

    // --------------------------------------------------
    // AUTHENTICATION
    // --------------------------------------------------

    const {
        data: claimsData,
        error: claimsError,
    } = await supabase.auth.getClaims();

    if (claimsError || !claimsData?.claims?.sub) {
        redirect("/login");
    }

    const userId = claimsData.claims.sub;

    // --------------------------------------------------
    // LOAD PROJECT
    // --------------------------------------------------

    const {
        data: project,
        error: projectError,
    } = await supabase
        .from("projects")
        .select("id, name, slug, team_id")
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

    // --------------------------------------------------
    // VERIFY PROJECT MEMBERSHIP
    // --------------------------------------------------

    const {
        data: membership,
        error: membershipError,
    } = await supabase
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
        notFound();
    }

    // --------------------------------------------------
    // LOAD ENVIRONMENT
    // --------------------------------------------------

    const {
        data: environment,
        error: environmentError,
    } = await supabase
        .from("environments")
        .select("id, name, slug, type, project_id, created_at")
        .eq("id", environmentId)
        .eq("project_id", project.id)
        .maybeSingle();

    if (environmentError) {
        console.error("FAILED TO LOAD ENVIRONMENT:", {
            message: environmentError.message,
            code: environmentError.code,
            details: environmentError.details,
            hint: environmentError.hint,
        });

        throw new Error("Unable to load this environment.");
    }

    if (!environment) {
        notFound();
    }

    // --------------------------------------------------
    // LOAD SECRETS
    // --------------------------------------------------

    const {
        data: secrets,
        error: secretsError,
    } = await supabase
        .from("secrets")
        .select(
            "id, key, description, is_required, created_at, updated_at"
        )
        .eq("environment_id", environment.id)
        .order("created_at", { ascending: true });

    if (secretsError) {
        console.error("FAILED TO LOAD SECRETS:", {
            message: secretsError.message,
            code: secretsError.code,
            details: secretsError.details,
            hint: secretsError.hint,
        });

        throw new Error("Unable to load environment secrets.");
    }

    return (
        <main className="min-h-screen px-6 py-10">
            <div className="mx-auto max-w-6xl">
                {/* Breadcrumb */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <a
                        href="/dashboard"
                        className="hover:text-foreground hover:underline"
                    >
                        Dashboard
                    </a>

                    <span>/</span>

                    <a
                        href={`/dashboard/projects/${project.id}`}
                        className="hover:text-foreground hover:underline"
                    >
                        {project.name}
                    </a>

                    <span>/</span>

                    <span className="text-foreground">
                        {environment.name}
                    </span>
                </div>

                {/* Header */}
                <div className="mt-8 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-3xl font-semibold tracking-tight">
                                {environment.name}
                            </h1>

                            <span className="rounded-md border px-2.5 py-1 text-xs font-medium text-muted-foreground capitalize">
                                {environment.type}
                            </span>
                        </div>

                        <p className="mt-2 text-muted-foreground">
                            Manage secrets for the {environment.name.toLowerCase()} environment.
                        </p>
                    </div>

                    <a
                        href={`/dashboard/projects/${project.id}/environments/${environment.id}/secrets/new`}
                        className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
                    >
                        + Add secret
                    </a>
                </div>

                {/* Secrets */}
                <section className="mt-10">
                    <div className="flex items-end justify-between">
                        <div>
                            <h2 className="text-xl font-semibold">
                                Secrets
                            </h2>

                            <p className="mt-1 text-sm text-muted-foreground">
                                Secret values are never displayed here.
                            </p>
                        </div>

                        <span className="text-sm text-muted-foreground">
                            {secrets?.length ?? 0}{" "}
                            {(secrets?.length ?? 0) === 1
                                ? "secret"
                                : "secrets"}
                        </span>
                    </div>

                    {secrets && secrets.length > 0 ? (
                        <div className="mt-5 overflow-hidden rounded-xl border">
                            <div className="grid grid-cols-[1fr_auto] border-b bg-muted/30 px-5 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                <span>Key</span>
                                <span>Status</span>
                            </div>

                            {secrets.map((secret) => (
                                <div
                                    key={secret.id}
                                    className="grid grid-cols-[1fr_auto] items-center gap-4 border-b px-5 py-4 last:border-b-0"
                                >
                                    <div className="min-w-0">
                                        <p className="truncate font-mono text-sm font-medium">
                                            {secret.key}
                                        </p>

                                        {secret.description && (
                                            <p className="mt-1 truncate text-xs text-muted-foreground">
                                                {secret.description}
                                            </p>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-3">
                                        {secret.is_required && (
                                            <span className="rounded-md border px-2 py-1 text-xs text-muted-foreground">
                                                Required
                                            </span>
                                        )}

                                        <span className="font-mono text-sm text-muted-foreground">
                                            ••••••••
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="mt-5 rounded-xl border border-dashed p-12 text-center">
                            <div className="mx-auto max-w-md">
                                <h3 className="font-medium">
                                    No secrets yet
                                </h3>

                                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                    Add your first secret to start managing
                                    configuration securely with Shroud.
                                </p>

                                <a
                                    href={`/dashboard/projects/${project.id}/environments/${environment.id}/secrets/new`}
                                    className="mt-5 inline-flex rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
                                >
                                    Add your first secret
                                </a>
                            </div>
                        </div>
                    )}
                </section>
            </div>
        </main>
    );
}
