"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createTeam } from "@/app/actions/team";

export function CreateTeamForm() {
    const router = useRouter();

    const [teamName, setTeamName] = useState("");
    const [error, setError] = useState("");
    const [isCreating, setIsCreating] = useState(false);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        setError("");
        setIsCreating(true);

        const result = await createTeam(teamName);

        if (!result.success) {
            setError(result.error);
            setIsCreating(false);
            return;
        }

        router.push("/dashboard");
        router.refresh();
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
                <label
                    htmlFor="team-name"
                    className="text-sm font-medium"
                >
                    Team name
                </label>

                <input
                    id="team-name"
                    name="teamName"
                    type="text"
                    value={teamName}
                    onChange={(event) => setTeamName(event.target.value)}
                    placeholder="e.g. Acme Engineering"
                    required
                    maxLength={100}
                    disabled={isCreating}
                    autoFocus
                    className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
                />

                <p className="text-xs text-muted-foreground">
                    You can change your team details later.
                </p>
            </div>

            {error && (
                <div
                    role="alert"
                    className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
                >
                    {error}
                </div>
            )}

            <button
                type="submit"
                disabled={isCreating || !teamName.trim()}
                className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
                {isCreating ? "Creating your workspace..." : "Create team"}
            </button>
        </form>
    );
}