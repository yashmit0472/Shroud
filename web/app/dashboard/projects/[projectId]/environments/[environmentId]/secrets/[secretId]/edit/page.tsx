import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EditSecretForm } from "./edit-secret-form";
import { canManage, canWrite, projectAccess } from "@/lib/workspace-access";
import { DeleteSecretButton } from "@/components/delete-secret-button";

type Props = {
  params: Promise<{
    projectId: string;
    environmentId: string;
    secretId: string;
  }>;
};

export const instant = false;

export default async function EditSecretPage({ params }: Props) {
  const { projectId, environmentId, secretId } = await params;

  const supabase = await createClient();
  const access = await projectAccess(projectId, environmentId);
  if (access.status !== 200 || !canWrite(access.role)) redirect(`/dashboard/projects/${projectId}/environments/${environmentId}`);

  const {
    data: claimsData,
    error: claimsError,
  } = await supabase.auth.getClaims();

  if (claimsError || !claimsData?.claims?.sub) {
    redirect("/login");
  }

  const { data: secret, error } = await supabase
    .from("secrets")
    .select("id, key, description, is_required")
    .eq("id", secretId)
    .eq("environment_id", environmentId)
    .single();

  if (error || !secret) {
    redirect(
      `/dashboard/projects/${projectId}/environments/${environmentId}`,
    );
  }

  return (
    <main className="min-h-screen px-6 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8">
          <p className="text-sm text-muted-foreground">
            Environment variable
          </p>

          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Edit {secret.key}
          </h1>

          <p className="mt-2 text-sm text-muted-foreground">
            Updating the value creates a new version. Previous versions are
            retained.
          </p>
        </div>

        <EditSecretForm
          projectId={projectId}
          environmentId={environmentId}
          secretId={secretId}
          initialKey={secret.key}
          initialDescription={secret.description ?? ""}
          initialRequired={secret.is_required}
        />
        {canManage(access.role) && <DeleteSecretButton projectId={projectId} environmentId={environmentId} secretId={secretId} secretKey={secret.key} />}
      </div>
    </main>
  );
}
