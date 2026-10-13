import Link from "next/link";
import { Suspense } from "react";
import { ArrowUpRight, LockKeyhole, Plus, ShieldCheck } from "lucide-react";
import { WorkspaceSidebar } from "@/components/workspace-sidebar";
import { WorkspacePicker } from "@/components/workspace-picker";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <div className="workspace-shell">
    <Suspense fallback={<aside className="workspace-sidebar" aria-hidden="true" />}><WorkspaceSidebar /></Suspense>
    <div className="workspace-main">
      <header className="workspace-topbar">
        <div className="min-w-0">
          <Suspense fallback={<span className="text-sm text-muted-foreground">Loading workspace...</span>}><WorkspacePicker /></Suspense>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/docs" className="hidden items-center gap-1 rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground sm:inline-flex">Guides <ArrowUpRight className="h-3 w-3" /></Link>
          <Link href="/dashboard/projects/new" className="btn-accent min-h-0 px-3 py-2 text-xs"><Plus className="h-3.5 w-3.5" /> New project</Link>
        </div>
      </header>
      <div className="workspace-content">{children}</div>
      <footer className="mx-auto flex max-w-[1450px] items-center justify-between px-7 pb-8 text-xs text-muted-foreground"><span className="flex items-center gap-2"><LockKeyhole className="h-3.5 w-3.5" /> Shroud</span><span className="flex items-center gap-2"><ShieldCheck className="h-3.5 w-3.5 text-lime-300" /> Your secrets stay encrypted</span></footer>
    </div>
  </div>;
}


