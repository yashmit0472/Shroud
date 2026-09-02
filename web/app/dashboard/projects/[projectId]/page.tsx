import { Suspense } from "react";
import ProjectContent from "./project-content";

function ProjectLoading() {
    return (
        <main className="min-h-screen px-6 py-16">
            <div className="mx-auto max-w-6xl">
                <p className="text-sm text-muted-foreground">
                    Loading project...
                </p>
            </div>
        </main>
    );
}

type ProjectPageProps = {
    params: Promise<{
        projectId: string;
    }>;
};

export default async function ProjectPage({ params }: ProjectPageProps) {
    return (
        <Suspense fallback={<ProjectLoading />}>
            <ProjectContent params={params} />
        </Suspense>
    );
}