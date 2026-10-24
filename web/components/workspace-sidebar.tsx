"use client";
import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { usePathname, useRouter } from "next/navigation";
import { BookOpen, Folder, KeyRound, LayoutDashboard, LogOut, ScrollText, Terminal, Users, Settings, Search, Clock3 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const links = [
  { href:"/dashboard", label:"Overview", icon:LayoutDashboard },
  { href:"/dashboard/projects", label:"Projects", icon:Folder },
  { href:"/dashboard/search", label:"Search", icon:Search },
  { href:"/dashboard/rotations", label:"Rotations", icon:Clock3 },
  { href:"/dashboard/cli", label:"Terminal", icon:Terminal },
  { href:"/dashboard/members", label:"Team", icon:Users },
  { href:"/dashboard/tokens", label:"API tokens", icon:KeyRound },
  { href:"/dashboard/audit", label:"Audit logs", icon:ScrollText },
];
export function WorkspaceSidebar({ workspacePicker, profile }: { workspacePicker?: React.ReactNode; profile?: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  async function logout() { await createClient().auth.signOut(); router.replace("/login"); router.refresh(); }
  return <aside className="workspace-sidebar">
    <Link href="/dashboard" className="sidebar-brand"><BrandMark /><span>SHROUD</span></Link>
    <div className="sidebar-workspace">{workspacePicker}</div>
    <nav aria-label="Workspace navigation" className="space-y-1">{links.map(({ href, label, icon:Icon }) => <Link key={href} href={href} title={label} aria-current={(href === "/dashboard" ? pathname === href : pathname.startsWith(href)) ? "page" : undefined} className={"workspace-nav-link" + ((href === "/dashboard" ? pathname === href : pathname.startsWith(href)) ? " active" : "")}><Icon /><span>{label}</span></Link>)}</nav>
    <div className="sidebar-bottom"><Link href="/dashboard/settings" title="Settings" className={"workspace-nav-link" + (pathname.endsWith("/settings") ? " active" : "")}><Settings /><span>Settings</span></Link><Link href="/docs" title="Documentation" className="workspace-nav-link"><BookOpen /><span>Docs</span></Link><button type="button" title="Sign out" onClick={logout} className="workspace-nav-link"><LogOut /><span>Sign out</span></button>{profile}</div>
  </aside>;
}
