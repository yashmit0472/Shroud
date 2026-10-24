"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowUpRight, Search, Terminal, Folder, KeyRound, Users, Plus, Columns3, Settings, LayoutDashboard, ScrollText, BookOpen } from "lucide-react";
import { Dialog } from "@/components/dialog";
import { canWrite } from "@/lib/roles";

type Project = { id: string; name: string; slug: string };
export function CommandPalette({manageWorkspace,createProjects,roles}:{manageWorkspace:boolean;createProjects:boolean;roles:{project_id:string;role:string}[]}) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState("");
  const recent = useRef<string[]>([]);
  useEffect(() => {
    if (!recent.current.includes(pathname)) recent.current = [pathname, ...recent.current].slice(0, 5);
  }, [pathname]);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/browser-cli?action=projects", { cache:"no-store", signal:controller.signal }).then(async response => {
      if (!response.ok) throw new Error();
      const data = await response.json(); setProjects(data.items);
    }).catch(() => { if (!controller.signal.aborted) setError("Projects are unavailable. Navigation is still accessible."); });
    return () => controller.abort();
  }, [pathname]);
  useEffect(() => {
    function keys(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setOpen(value => !value); setQuery(""); setSelected(0); }
    }
    document.addEventListener("keydown", keys);
    return () => document.removeEventListener("keydown", keys);
  }, []);
  useEffect(() => { if (open) document.getElementById("palette-" + selected)?.scrollIntoView({block:"nearest"}); }, [open,selected]);
  const currentProject = projects.find(project => pathname.includes(project.id));
  const currentRole = roles.find(role => role.project_id === currentProject?.id)?.role ?? null;
  const environmentPath = pathname.includes("/environments/") && currentProject ? "/dashboard/projects/" + currentProject.id + "/environments/" + pathname.split("/environments/")[1].split("/")[0] : null;
  const addSecretHref = environmentPath ? environmentPath + "/secrets/new" : "/dashboard/projects/" + currentProject?.id + "?add=1" + (search.get("env") ? "&env=" + encodeURIComponent(search.get("env")!) : "");
  const actions = [
    { name:"Overview", href:"/dashboard", icon:LayoutDashboard },
    { name:"Search variable names",href:"/dashboard/search",icon:Search },
    { name:"Rotation reminders",href:"/dashboard/rotations",icon:KeyRound },
    { name:"Projects", href:"/dashboard/projects", icon:Folder },
    { name:"Open terminal", href:"/dashboard/cli", icon:Terminal },
    ...(manageWorkspace ? [{ name:"Invite member", href:"/dashboard/members?invite=1", icon:Users }, { name:"Create API token", href:"/dashboard/tokens?create=1", icon:KeyRound }] : []),
    ...(createProjects ? [{ name:"New project", href:"/dashboard/projects/new", icon:Plus }] : []),
    { name:"Audit logs", href:"/dashboard/audit", icon:ScrollText },
    { name:"Settings", href:"/dashboard/settings", icon:Settings },
    { name:"Documentation", href:"/docs", icon:BookOpen },
    ...projects.map(project => ({ name:"Go to " + project.name, href:"/dashboard/projects/" + project.id, icon:Folder })),
    ...(currentProject ? [
      { name:"Open Production secrets", href:"/dashboard/projects/" + currentProject.id + "?env=production", icon:KeyRound },
      { name:"Compare environments", href:"/dashboard/projects/" + currentProject.id + "?tab=compare", icon:Columns3 },
      ...(canWrite(currentRole) ? [{ name:"Add secret", href:addSecretHref, icon:Plus }] : []),
    ] : []),
  ];
  const matches = actions.filter(action => action.name.toLowerCase().includes(query.toLowerCase()));
  const recentActions = recent.current.map(href => actions.find(action => action.href === href)).filter((action): action is typeof actions[number] => !!action);
  const choices = !query && recentActions.length ? [...recentActions, ...matches.filter(action => !recentActions.includes(action))] : matches;
  function go(href:string) { setOpen(false); router.push(href); }
  const title = pathname.includes("/environments/") ? "Secrets" : pathname.includes("/projects/") ? "Project" : pathname.endsWith("/projects") ? "Projects" : pathname.endsWith("/cli") ? "Terminal" : pathname.endsWith("/members") ? "Team" : pathname.endsWith("/tokens") ? "API tokens" : pathname.endsWith("/audit") ? "Audit logs" : pathname.endsWith("/settings") ? "Settings" : "Overview";
  return <>
    <span className="flex items-center gap-2 text-xs text-muted-foreground"><span className="hidden sm:inline">Workspace</span><span className="hidden sm:inline">/</span><span className="text-foreground">{title}</span></span>
    <button type="button" aria-label="Open command palette" className="search-field min-w-0 sm:w-64" onClick={() => { setQuery(""); setSelected(0); setOpen(true); }}><Search size={13} /><span className="hidden flex-1 text-left text-[11px] sm:inline">Search or jump to…</span><kbd>Ctrl K</kbd></button>
    {open && <Dialog title="Search Shroud" onClose={() => setOpen(false)} className="command-palette">
      <div className="palette-search"><Search size={16} /><input data-autofocus aria-label="Search commands" role="combobox" aria-expanded="true" aria-controls="palette-results" aria-activedescendant={choices.length ? "palette-" + Math.min(selected, choices.length - 1) : undefined} value={query} onChange={event => { setQuery(event.target.value); setSelected(0); }} placeholder="Search Shroud…" onKeyDown={event => {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setSelected(index => (index + (event.key === "ArrowDown" ? 1 : -1) + choices.length) % Math.max(1, choices.length)); }
        if (event.key === "Enter" && choices[selected]) { event.preventDefault(); go(choices[selected].href); }
      }} /><kbd>Esc</kbd></div>
      <div id="palette-results" role="listbox" aria-label="Commands" className="palette-list">{!query && !!recentActions.length && <p className="px-3 py-2 text-[10px] text-muted-foreground">Recent destinations first</p>}{choices.length ? choices.map((action, index) => <button type="button" role="option" aria-selected={selected === index} id={"palette-" + index} key={action.name} className="palette-option" onMouseEnter={() => setSelected(index)} onClick={() => go(action.href)}><action.icon size={14} />{action.name}<ArrowUpRight size={11} className="ml-auto text-muted-foreground" /></button>) : <p className="p-6 text-xs text-muted-foreground">No commands match your search.</p>}</div>
      {error && <p className="px-4 py-2 text-[10px] text-muted-foreground">{error}</p>}
      <div className="palette-hint"><span>↑ ↓ navigate</span><span>↵ open</span><span>esc close</span></div>
    </Dialog>}
  </>;
}
