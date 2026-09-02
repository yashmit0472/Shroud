import { Suspense } from "react";
import EnvironmentContent from "./environment-content";

function EnvironmentLoading() {
    return (
        <main className="min-h-screen px-6 py-16">
            <div className="mx-auto max-w-6xl">
                <p className="text-sm text-muted-foreground">
                    Loading environment...
                </p>
            </div>
        </main>
    );
}

export default function EnvironmentPage({
    params,
}: {
    params: Promise<{ projectId: string; environmentId: string }>;
}) {
    return (
        <Suspense fallback={<EnvironmentLoading />}>
            <EnvironmentContent params={params} />
        </Suspense>
    );
}
