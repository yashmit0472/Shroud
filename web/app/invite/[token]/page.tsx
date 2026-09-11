"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, ShieldAlert } from "lucide-react";
import { useRouter } from "next/navigation";

type Status =
    | "loading"
    | "ready"
    | "success"
    | "error";

export default function InvitePage({
    params,
}: {
    params: Promise<{ token: string }>;
}) {
    const router = useRouter();

    const [token, setToken] = useState("");
    const [status, setStatus] =
        useState<Status>("loading");
    const [error, setError] = useState("");

    useEffect(() => {
        params.then(({ token }) => {
            setToken(token);
            setStatus("ready");
        });
    }, [params]);

    async function acceptInvitation() {
        setStatus("loading");
        setError("");

        try {
            const response = await fetch(
                "/api/v1/teams/invitations/accept",
                {
                    method: "POST",
                    headers: {
                        "Content-Type":
                            "application/json",
                    },
                    body: JSON.stringify({
                        token,
                    }),
                },
            );

            const data = await response.json();

            if (response.status === 401) {
                router.push(
                    `/login?redirect=/invite/${encodeURIComponent(token)}`,
                );
                return;
            }

            if (!response.ok) {
                setError(
                    data.error ??
                        "Unable to accept invitation.",
                );
                setStatus("error");
                return;
            }

            setStatus("success");

            setTimeout(() => {
                router.push("/dashboard");
            }, 1200);
        } catch {
            setError(
                "Something went wrong. Please try again.",
            );
            setStatus("error");
        }
    }

    return (
        <main className="flex min-h-screen items-center justify-center bg-background px-4">
            <div className="w-full max-w-md">
                <div className="mb-8 text-center">
                    <div className="mx-auto mb-4 flex size-10 items-center justify-center rounded-xl border bg-card">
                        <span className="text-sm font-bold">
                            S
                        </span>
                    </div>

                    <h1 className="text-xl font-semibold">
                        You've been invited to Shroud
                    </h1>

                    <p className="mt-2 text-sm text-muted-foreground">
                        Join the team and securely manage
                        environment variables together.
                    </p>
                </div>

                <div className="rounded-xl border bg-card p-6 shadow-sm">
                    {status === "loading" && (
                        <div className="flex flex-col items-center py-8">
                            <Loader2 className="size-6 animate-spin" />

                            <p className="mt-3 text-sm text-muted-foreground">
                                Processing invitation...
                            </p>
                        </div>
                    )}

                    {status === "ready" && (
                        <>
                            <div className="rounded-lg border bg-muted/30 p-4">
                                <div className="flex gap-3">
                                    <ShieldAlert className="mt-0.5 size-5 shrink-0" />

                                    <div>
                                        <p className="text-sm font-medium">
                                            Team invitation
                                        </p>

                                        <p className="mt-1 text-xs text-muted-foreground">
                                            This invitation will
                                            add your account to
                                            the team with the
                                            assigned role.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={
                                    acceptInvitation
                                }
                                className="mt-5 h-10 w-full rounded-md bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90"
                            >
                                Accept invitation
                            </button>

                            <p className="mt-3 text-center text-xs text-muted-foreground">
                                You may be asked to sign in
                                first.
                            </p>
                        </>
                    )}

                    {status === "success" && (
                        <div className="flex flex-col items-center py-8 text-center">
                            <CheckCircle2 className="size-8" />

                            <h2 className="mt-4 font-semibold">
                                Invitation accepted
                            </h2>

                            <p className="mt-1 text-sm text-muted-foreground">
                                You've joined the team.
                                Redirecting to your
                                dashboard...
                            </p>
                        </div>
                    )}

                    {status === "error" && (
                        <>
                            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                                <p className="text-sm font-medium text-destructive">
                                    Invitation could not
                                    be accepted
                                </p>

                                <p className="mt-1 text-xs text-muted-foreground">
                                    {error}
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() =>
                                    setStatus("ready")
                                }
                                className="mt-5 h-9 w-full rounded-md border text-sm font-medium hover:bg-muted"
                            >
                                Try again
                            </button>
                        </>
                    )}
                </div>
            </div>
        </main>
    );
}
