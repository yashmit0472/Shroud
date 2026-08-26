import { Suspense } from "react";
import DashboardContent from "./dashboard-content";

function DashboardLoading() {
  return (
    <main className="min-h-screen px-6 py-16">
      <div className="mx-auto max-w-6xl">
        <p className="text-sm text-muted-foreground">
          Loading your workspace...
        </p>
      </div>
    </main>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <DashboardContent />
    </Suspense>
  );
}