"use client";

import { useSecretMutation } from "@/components/use-secret-mutation";
import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { ArrowRight, EyeOff, Loader2 } from "lucide-react";
import { assertBrowserContext, browserCommandDisplay, parseBrowserCommand, terminalHelp } from "@/lib/browser-cli";
import { DarkSelect } from "@/components/dark-select";

type Item = { id: string; name: string; slug: string; type?: string };
type Output = { command?: string; text: string; error?: boolean; sensitive?: boolean; context?: string };

async function query(action: string, project?: string, environment?: string, options?: Record<string, string>) {
  const search = new URLSearchParams({ action, ...options });
  if (project) search.set("project", project);
  if (environment) search.set("environment", environment);
  const response = await fetch("/api/browser-cli?" + search, { cache: "no-store" });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Unable to run this command.");
  return data;
}

function resolveItem(items: Item[], value: string, label: string) {
  const matches = items.filter((item) => item.id === value || item.slug === value || item.type === value || item.name.toLowerCase() === value.toLowerCase());
  if (matches.length !== 1) throw new Error(label + " not found or ambiguous. Use its ID or slug.");
  return matches[0];
}

export function BrowserTerminal() {
  const mutation=useSecretMutation();
  const [projects, setProjects] = useState<Item[]>([]);
  const [environments, setEnvironments] = useState<Item[]>([]);
  const [projectId, setProjectId] = useState("");
  const [environmentId, setEnvironmentId] = useState("");
  const [input, setInput] = useState("");
  const [output, setOutput] = useState<Output[]>([{ text: "Welcome to Shroud. No project is active.\nRun shroud projects, then shroud use <project> and shroud env development.\nType help for commands." }]);
  const [history, setHistory] = useState<string[]>([]);
  const [historyPosition, setHistoryPosition] = useState(-1);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const commandInput = useRef<HTMLInputElement>(null);
  const log = useRef<HTMLDivElement>(null);
  const currentProject = projects.find((item) => item.id === projectId);
  const currentEnvironment = environments.find((item) => item.id === environmentId);
  const context = (currentProject?.slug ?? "workspace") + "/" + (currentEnvironment?.slug ?? "no-environment");

  function append(entry: Output) { setOutput((entries) => [...entries.slice(-99), entry]); }
  function hideValues() { setOutput((entries) => entries.filter((entry) => !entry.sensitive)); }
  function enterProject(id: string) {
    hideValues(); if (id !== projectId) setEnvironments([]); setEnvironmentId(""); setProjectId(id);
  }

  useEffect(() => {
    let cancelled = false;
    query("projects").then((data) => {
      if (!cancelled) { setProjects(data.items); setConnected(true); }
    }).catch((failure) => {
      if (!cancelled) setOutput((entries) => [...entries, { text: failure.message, error: true }]);
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!projectId) return;
    query("environments", projectId).then((data) => {
      if (!cancelled) setEnvironments(data.items);
    }).catch((failure) => {
      if (!cancelled) setOutput((entries) => [...entries, { text: failure.message, error: true }]);
    });
    return () => { cancelled = true; };
  }, [projectId]);

  useEffect(() => { log.current?.scrollTo({ top: log.current.scrollHeight, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" }); }, [output, busy]);
  useEffect(() => { const hide = () => setOutput(entries => entries.filter(entry => !entry.sensitive)); const visibility = () => { if (document.hidden) hide(); }; window.addEventListener("blur", hide); document.addEventListener("visibilitychange", visibility); return () => { window.removeEventListener("blur", hide); document.removeEventListener("visibilitychange", visibility); }; }, []);
  useEffect(() => { if (!busy) commandInput.current?.focus(); }, [busy]);

  async function execute(commandText: string) {
    if (busy || !commandText.trim()) return;
    let command;
    try { command = parseBrowserCommand(commandText); }
    catch (failure) {
      append({ text: failure instanceof Error ? failure.message : "Invalid command.", error: true });
      setInput(""); return;
    }
    setInput(""); setHistoryPosition(-1);
    if (command.action === "clear") { setOutput([]); setHistory([]); return; }
    if (command.action !== "push") setHistory((entries) => [...entries.slice(-49), commandText.trim()]);
    append({ command: browserCommandDisplay(command, commandText), text: "", context });
    if (command.action === "help") { append({ text: terminalHelp }); return; }
    setBusy(true);
    try {
      assertBrowserContext(command.action, projectId, environmentId);
      if (["whoami", "teams", "projects"].includes(command.action)) {
        const data = await query(command.action);
        if (command.action === "projects") setProjects(data.items);
        append({ text: data.output ?? (data.items.length ? data.items.map((item: Item) => item.name + "  (" + item.slug + ")\n  " + item.id).join("\n") : "No accessible items found.") });
        return;
      }
      if (command.action === "use") {
        if (command.project === "..") { enterProject(""); append({ text: "Left the project. No project or environment is active." }); return; }
        const availableProjects = projects.length ? projects : (await query("projects")).items;
        const project = resolveItem(availableProjects, command.project!, "Project");
        setProjects(availableProjects); enterProject(project.id);
        append({ text: "Entered " + project.name + ". Choose an environment: shroud env development.", context: project.slug });
        return;
      }
      const availableEnvironments: Item[] = environments.length ? environments : (await query("environments", projectId)).items;
      if (command.action === "environments") {
        append({ text: availableEnvironments.length ? availableEnvironments.map((item) => item.name + "  (" + item.slug + ")\n  " + item.id).join("\n") : "No environments found.", context });
        return;
      }
      if (command.action === "env") {
        const environment = resolveItem(availableEnvironments, command.environment!, "Environment");
        setEnvironments(availableEnvironments); hideValues(); setEnvironmentId(environment.id);
        append({ text: "Entered " + currentProject?.name + " / " + environment.name + ".", context: currentProject?.slug + "/" + environment.slug });
        return;
      }
      if (command.action === "push") {
        const response = await mutation.request("/api/browser-cli", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ project: projectId, environment: environmentId, key: command.key, value: command.value }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to save variable.");
        hideValues();
        if(data.pending){append({text:"Production approval requested. A different project owner or admin can review it in Activity.",context});return;}
        append({ text: "Saved " + data.key + " in " + currentProject?.name + " / " + currentEnvironment?.name + ". Existing variables receive a new version.", context });
        return;
      }
      const data = await query(command.action, projectId, environmentId, command.action === "pull" ? { key: command.key! } : command.showValues ? { values: "true" } : undefined);
      const showingValues = command.action === "pull" || command.showValues;
      append({
        text: data.items.length ? data.items.map((item: { key: string; value?: string; is_required?: boolean }) => showingValues ? item.key + "=" + JSON.stringify(item.value) : item.key + (item.is_required ? "  [required]" : "")).join("\n") : "No secrets in this environment yet.",
        sensitive: !!showingValues, context,
      });
    } catch (failure) { append({ text: failure instanceof Error ? failure.message : "Command failed.", error: true }); }
    finally { setBusy(false); }
  }

  function recall(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    const position = event.key === "ArrowUp" ? Math.min(historyPosition + 1, history.length - 1) : Math.max(historyPosition - 1, -1);
    setHistoryPosition(position); setInput(position < 0 ? "" : history[history.length - 1 - position] ?? "");
  }

  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); void execute(input); }

  return <>{mutation.confirmation}<div>
    <div className="mb-4 grid max-w-xl gap-3 sm:grid-cols-2">
      <DarkSelect label="Project context" value={projectId} onChange={value=>void execute("shroud use "+(value||".."))} disabled={loading||busy} placeholder={loading?"Loading projects…":"Enter a project"} allowEmpty options={projects.map(item=>({value:item.id,label:item.name}))}/>
      <DarkSelect label="Environment" value={environmentId} onChange={value=>void execute("shroud env "+value)} disabled={!projectId||!environments.length||busy} placeholder="Enter an environment" options={environments.map(item=>({value:item.id,label:item.name}))}/>
    </div>
    {!loading&&!projects.length&&<p className="mb-4 text-xs text-muted-foreground">No accessible projects. Create a project or request project membership.</p>}
    <div className="terminal-layout"><div className="terminal-main">
      <div className="terminal-status"><span className="flex min-w-0 items-center gap-3"><span className={connected?"text-primary":"text-muted-foreground"}>{loading?"Connecting…":connected?"● Connected":"○ Unavailable"}</span><span className="truncate text-muted-foreground">{currentProject?currentProject.name+" / "+(currentEnvironment?.name??"No environment"):"Workspace / No project"}</span></span><button type="button" className="text-[10px] text-muted-foreground hover:text-foreground" disabled={busy} onClick={()=>void execute("clear")}>Clear</button></div>
      <div ref={log} role="log" aria-live="polite" aria-label="Terminal output" className="terminal-log space-y-4">{output.map((entry,index)=><div key={index}>{entry.command&&<p className="break-all text-foreground"><span className="text-primary">shroud@{entry.context} $ </span>{entry.command}</p>}{entry.sensitive&&<p className="mb-1 text-[10px] text-amber-300">Revealed values · {entry.context}</p>}{entry.text&&<pre className={"whitespace-pre-wrap break-words font-mono "+(entry.error?"text-destructive":entry.sensitive?"text-[#d9e8b4]":"text-[#aaa79d]")}>{entry.text}</pre>}</div>)}{busy&&<p className="flex items-center gap-2 text-muted-foreground"><Loader2 size={12} className="animate-spin"/>Running…</p>}</div>
      <form onSubmit={submit} className="flex items-center gap-3 border-t border-border px-4 py-3"><span aria-hidden="true" className="max-w-[35%] truncate font-mono text-[11px] text-primary">{context} $</span><input ref={commandInput} aria-label="Terminal command" className="min-w-0 flex-1 bg-transparent font-mono text-xs outline-none placeholder:text-muted-foreground" placeholder={projectId?'shroud push API_KEY "value"':"shroud use <project>"} value={input} onChange={event=>{setInput(event.target.value);setHistoryPosition(-1);}} onKeyDown={recall} autoComplete="off" spellCheck={false} maxLength={65536} disabled={busy}/><button type="submit" aria-label="Run command" disabled={busy||!input.trim()} className="icon-button"><ArrowRight size={13}/></button></form>
    </div><aside className="terminal-quick"><h2>Quick commands</h2>{[{name:"projects",description:"List projects",command:"shroud projects"},{name:"env",description:"List environments",command:"shroud environments"},{name:"secrets",description:"List keys",command:"shroud secrets"},{name:"pull",description:"Read one variable",command:"shroud pull ",edit:true},{name:"push",description:"Add / update variable",command:"shroud push ",edit:true},{name:"whoami",description:"Current account",command:"shroud whoami"},{name:"help",description:"Command reference",command:"help"}].map(item=><button type="button" key={item.name} disabled={busy} onClick={()=>{if(item.edit){setInput(item.command);commandInput.current?.focus();}else void execute(item.command);}}>{item.name}<small>{item.description}</small></button>)}<button type="button" disabled={busy} onClick={hideValues}><span className="flex items-center gap-2"><EyeOff size={12}/>Hide values</span><small>Remove revealed output</small></button></aside></div>
    <p className="mt-3 text-[10px] text-muted-foreground">Literal commands · no system shell · pushes excluded from command recall</p>
  </div></>;
}
