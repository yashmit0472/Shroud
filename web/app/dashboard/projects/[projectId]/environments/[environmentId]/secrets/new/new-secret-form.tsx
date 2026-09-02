"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type NewSecretFormProps = {
    projectId: string;
    environmentId: string;
};

export default function NewSecretForm({
    projectId,
    environmentId,
}: NewSecretFormProps) {
    const router = useRouter();

    const [key, setKey] = useState("");
    const [value, setValue] = useState("");
    const [description, setDescription] = useState("");
    const [isRequired, setIsRequired] = useState(false);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        setError("");
        setLoading(true);

        try {
            const response = await fetch(
                `/api/v1/projects/${projectId}/environments/${environmentId}/secrets`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        key,
                        value,
                        description,
                        is_required: isRequired,
                    }),
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data?.error || "Unable to create secret."
                );
            }

            router.push(
                `/dashboard/projects/${projectId}/environments/${environmentId}`
            );

            router.refresh();
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Unable to create secret."
            );
        } finally {
            setLoading(false);
        }
    }

    return (
        <form
            onSubmit={handleSubmit}
            className="space-y-6 rounded-2xl border bg-card p-6"
        >
            <div className="space-y-2">
                <label
                    htmlFor="key"
                    className="text-sm font-medium"
                >
                    Key
                </label>

                <input
                    id="key"
                    name="key"
                    value={key}
                    onChange={(event) =>
                        setKey(event.target.value)
                    }
                    placeholder="DATABASE_URL"
                    autoComplete="off"
                    required
                    className="w-full rounded-lg border bg-background px-3 py-2.5 font-mono text-sm outline-none focus:ring-2 focus:ring-ring"
                />

                <p className="text-xs text-muted-foreground">
                    Use a valid environment variable name.
                </p>
            </div>

            <div className="space-y-2">
                <label
                    htmlFor="value"
                    className="text-sm font-medium"
                >
                    Value
                </label>

                <textarea
                    id="value"
                    name="value"
                    value={value}
                    onChange={(event) =>
                        setValue(event.target.value)
                    }
                    placeholder="Enter the environment variable value"
                    autoComplete="off"
                    required
                    rows={5}
                    className="w-full resize-y rounded-lg border bg-background px-3 py-2.5 font-mono text-sm outline-none focus:ring-2 focus:ring-ring"
                />

                <p className="text-xs text-muted-foreground">
                    This value will be encrypted before it is stored.
                </p>
            </div>

            <div className="space-y-2">
                <label
                    htmlFor="description"
                    className="text-sm font-medium"
                >
                    Description
                    <span className="ml-1 font-normal text-muted-foreground">
                        (optional)
                    </span>
                </label>

                <input
                    id="description"
                    name="description"
                    value={description}
                    onChange={(event) =>
                        setDescription(event.target.value)
                    }
                    placeholder="Production database connection"
                    className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-4">
                <input
                    type="checkbox"
                    checked={isRequired}
                    onChange={(event) =>
                        setIsRequired(event.target.checked)
                    }
                    className="mt-0.5"
                />

                <span>
                    <span className="block text-sm font-medium">
                        Required variable
                    </span>

                    <span className="mt-1 block text-xs text-muted-foreground">
                        Mark this variable as required for this project.
                    </span>
                </span>
            </label>

            {error && (
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                    {error}
                </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
                <button
                    type="button"
                    onClick={() =>
                        router.push(
                            `/dashboard/projects/${projectId}/environments/${environmentId}`
                        )
                    }
                    disabled={loading}
                    className="rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                >
                    Cancel
                </button>

                <button
                    type="submit"
                    disabled={loading}
                    className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {loading ? "Creating..." : "Create secret"}
                </button>
            </div>
        </form>
    );
}
