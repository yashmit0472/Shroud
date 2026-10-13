"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BookOpen, FolderKanban, KeyRound, LayoutDashboard, LockKeyhole, LogOut, ScrollText, Terminal, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const links = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/dashboard#projects", label: "Projects", icon: FolderKanban },
  { href: "/dashboard/members", label: "Team & invites", icon: Users },
  { href: "/dashboard/tokens", label: "API tokens", icon: KeyRound },
  { href: "/dashboard/audit", label: "Audit log", icon: ScrollText },
  { href: "/dashboard/cli", label: "Terminal", icon: Terminal },
  { href: "/docs", label: "Documentation", icon: BookOpen },
];

export function WorkspaceSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  async function logout() {
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }
  function active(href: string, exact?: boolean) {
    if (href === "/dashboard#projects") return pathname.startsWith("/dashboard/projects");
    return exact ? pathname === href : pathname.startsWith(href);
  }
  return <aside className="workspace-sidebar">
    <Link href="/dashboard" className="mb-12 flex items-center gap-3 px-2 text-lg font-semibold tracking-tight"><span className="brand-mark"><LockKeyhole className="h-4 w-4" /></span> Shroud<span className="ml-auto rounded-md border border-white/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">beta</span></Link>
    <div className="sidebar-stack">
      <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[.2em] text-muted-foreground">Workspace</p>
      <nav className="space-y-1" aria-label="Workspace">{links.slice(0, 5).map(({ href, label, icon: Icon, exact }) => <Link key={href} href={href} className={"workspace-nav-link" + (active(href, exact) ? " active" : "")}><Icon className="h-[18px] w-[18px]" />{label}</Link>)}</nav>
      <p className="mb-3 mt-9 px-3 text-[10px] font-bold uppercase tracking-[.2em] text-muted-foreground">Developer tools</p>
      <nav className="space-y-1" aria-label="Developer tools">{links.slice(5).map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={"workspace-nav-link" + (active(href) ? " active" : "")}><Icon className="h-[18px] w-[18px]" />{label}</Link>)}</nav>
      <div className="mt-10 rounded-xl border border-lime-300/20 bg-lime-300/5 p-4"><div className="flex items-center gap-2 text-sm font-semibold text-lime-300"><Terminal className="h-4 w-4" /> Your browser terminal</div><p className="mt-2 text-xs leading-5 text-muted-foreground">Enter a project, read values, and add variables directly. No install needed.</p><Link href="/dashboard/cli" className="mt-4 inline-block text-xs font-semibold text-lime-300 hover:underline">Open terminal →</Link></div>
    </div>
    <nav className="mobile-links hidden" aria-label="Mobile workspace">{links.map(({ href, label, icon: Icon, exact }) => <Link key={href} href={href} aria-label={label} className={"workspace-nav-link w-auto whitespace-nowrap" + (active(href, exact) ? " active" : "")}><Icon className="h-4 w-4" /><span className="hidden sm:inline">{label}</span></Link>)}</nav>
    <div className="sidebar-bottom mt-auto border-t border-white/10 pt-5"><button type="button" onClick={logout} className="workspace-nav-link"><LogOut className="h-[18px] w-[18px]" /> Sign out</button></div>
  </aside>;
}
