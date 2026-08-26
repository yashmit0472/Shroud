import Link from "next/link";
import { CreateTeamForm } from "../../../components/onboarding/create-team-form";

export default function CreateTeamPage() {
  return (
    <main className="min-h-screen px-6 py-16">
      <div className="mx-auto max-w-xl">
        <Link
          href="/onboarding"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Back
        </Link>

        <div className="mt-10">
          <p className="text-sm font-medium text-muted-foreground">
            New workspace
          </p>

          <h1 className="mt-3 text-4xl font-semibold tracking-tight">
            Create your team
          </h1>

          <p className="mt-4 text-muted-foreground">
            Give your team a name to get started with Shroud.
          </p>
        </div>

        <div className="mt-10">
          <CreateTeamForm />
        </div>
      </div>
    </main>
  );
}