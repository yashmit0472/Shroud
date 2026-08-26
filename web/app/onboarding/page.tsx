import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Suspense } from "react";

async function OnboardingContent() {
    const supabase = await createClient();

    const {
        data: claimsData,
        error: claimsError,
    } = await supabase.auth.getClaims();

    if (claimsError || !claimsData?.claims?.sub) {
        redirect("/login");
    }

    const userId = claimsData.claims.sub;

    const { data: membership, error } = await supabase
        .from("team_members")
        .select("team_id")
        .eq("user_id", userId)
        .limit(1)
        .maybeSingle();

    if (error) {
        console.error("Failed to load team membership:", {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint,
        });

        throw new Error("Unable to load your workspace.");
    }

    if (membership?.team_id) {
        redirect("/dashboard");
    }

    return (
        <main className="min-h-screen px-6 py-16">
            <div className="mx-auto flex min-h-[70vh] max-w-5xl flex-col justify-center">
                <div className="max-w-2xl">
                    <p className="text-sm font-medium text-muted-foreground">
                        Welcome to Shroud
                    </p>

                    <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
                        Let&apos;s get your workspace ready.
                    </h1>

                    <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground">
                        Start a new team or join one you&apos;ve already been invited to.
                    </p>
                </div>

                <div className="mt-12 grid gap-5 md:grid-cols-2">
                    <a
                        href="/onboarding/create-team"
                        className="group rounded-2xl border border-border bg-card p-7 transition-all hover:-translate-y-0.5 hover:bg-muted/40"
                    >
                        <div className="flex items-start justify-between">
                            <div>
                                <h2 className="text-lg font-semibold">
                                    Create a team
                                </h2>

                                <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                                    Start a new workspace and invite your teammates.
                                </p>
                            </div>

                            <span className="text-xl text-muted-foreground transition-transform group-hover:translate-x-1">
                                →
                            </span>
                        </div>

                        <div className="mt-8 text-sm font-medium">
                            Create workspace
                        </div>
                    </a>

                    <a
                        href="/onboarding/join-team"
                        className="group rounded-2xl border border-border bg-card p-7 transition-all hover:-translate-y-0.5 hover:bg-muted/40"
                    >
                        <div className="flex items-start justify-between">
                            <div>
                                <h2 className="text-lg font-semibold">
                                    Join a team
                                </h2>

                                <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                                    Enter an invite code or follow an invitation link.
                                </p>
                            </div>

                            <span className="text-xl text-muted-foreground transition-transform group-hover:translate-x-1">
                                →
                            </span>
                        </div>

                        <div className="mt-8 text-sm font-medium">
                            Join workspace
                        </div>
                    </a>
                </div>
            </div>
        </main>
    );
}

export default function OnboardingPage() {
    return (
        <Suspense
            fallback={
                <main className="min-h-screen px-6 py-16">
                    <div className="mx-auto flex min-h-[70vh] max-w-5xl items-center justify-center">
                        <p className="text-sm text-muted-foreground">
                            Loading your workspace...
                        </p>
                    </div>
                </main>
            }
        >
            <OnboardingContent />
        </Suspense>
    );
}