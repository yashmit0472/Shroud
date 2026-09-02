import { connection } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

import NewSecretForm from "./new-secret-form";

type NewSecretPageProps = {
    params: Promise<{
        projectId: string;
        environmentId: string;
    }>;
};

export default async function NewSecretPage({
    params,
}: NewSecretPageProps) {
    await connection();
    const { projectId, environmentId } = await params;

    const supabase = await createClient();

    const {
        data: claimsData,
        error: claimsError,
    } = await supabase.auth.getClaims();

    if (claimsError || !claimsData?.claims?.sub) {
        redirect("/login");
    }

    const { data: environment, error } = await supabase
        .from("environments")
        .select("id, name, type, project_id")
        .eq("id", environmentId)
        .eq("project_id", projectId)
        .maybeSingle();

    if (error) {
        console.error("Failed to load environment:", {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint,
        });

        throw new Error("Unable to load environment.");
    }

    if (!environment) {
        redirect("/dashboard");
    }

    return (
        <main className="min-h-screen px-6 py-16">
            <div className="mx-auto max-w-2xl">
                <div className="mb-8">
                    <a
                        href={`/dashboard/projects/${projectId}/environments/${environmentId}`}
                        className="text-sm text-muted-foreground hover:text-foreground hover:underline"
                    >
                        ← Back to {environment.name}
                    </a>

                    <p className="mt-8 text-sm font-medium text-muted-foreground">
                        {environment.name}
                    </p>

                    <h1 className="mt-2 text-3xl font-semibold tracking-tight">
                        Add environment variable
                    </h1>

                    <p className="mt-2 text-muted-foreground">
                        Add a secret to the {environment.name.toLowerCase()} environment.
                    </p>
                </div>

                <NewSecretForm
                    projectId={projectId}
                    environmentId={environmentId}
                />
            </div>
        </main>
    );
}
