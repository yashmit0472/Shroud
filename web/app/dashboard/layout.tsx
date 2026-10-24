import { Suspense } from "react";
import { WorkspaceSidebar } from "@/components/workspace-sidebar";
import { WorkspacePicker } from "@/components/workspace-picker";
import { SidebarProfile } from "@/components/sidebar-profile";
import { WorkspaceToolbar } from "@/components/workspace-toolbar";

export default function DashboardLayout({ children }: { children:React.ReactNode }) {
  return <div className="workspace-shell">
    <Suspense fallback={<aside className="workspace-sidebar" aria-hidden="true" />}><WorkspaceSidebar workspacePicker={<Suspense fallback={<div className="skeleton h-8" />}><WorkspacePicker /></Suspense>} profile={<Suspense fallback={null}><SidebarProfile /></Suspense>} /></Suspense>
    <div className="workspace-main"><header className="workspace-topbar"><Suspense fallback={<span className="skeleton w-40" />}><WorkspaceToolbar /></Suspense></header><div className="workspace-content">{children}</div></div>
  </div>;
}


