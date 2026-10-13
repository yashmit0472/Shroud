"use client";

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { ArrowRight, EyeOff, Loader2, ShieldCheck, Terminal } from "lucide-react";
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
      if (!cancelled) setProjects(data.items);
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

  useEffect(() => { log.current?.scrollTo({ top: log.current.scrollHeight, behavior: "smooth" }); }, [output, busy]);
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
        const response = await fetch("/api/browser-cli", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ project: projectId, environment: environmentId, key: command.key, value: command.value }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to save variable.");
        hideValues();
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

  return <div className="space-y-5">
    <div className="surface-card grid gap-4 p-5 sm:grid-cols-2">
      <DarkSelect label="Current project" value={projectId} onChange={(value) => void execute("shroud use " + (value || ".."))} disabled={loading || busy} placeholder={loading ? "Loading projects..." : "No project — choose one to enter"} allowEmpty options={projects.map((item) => ({ value: item.id, label: item.name }))} />
      <DarkSelect label="Current environment" value={environmentId} onChange={(value) => void execute("shroud env " + value)} disabled={!projectId || !environments.length || busy} placeholder="Choose an environment to enter" options={environments.map((item) => ({ value: item.id, label: item.name }))} />
    </div>
    {!loading && !projects.length && <p className="text-sm text-muted-foreground">No accessible projects yet. Create a project or ask your team admin for project access.</p>}
    <div className="overflow-hidden rounded-2xl border border-white/15 bg-[#080e16] shadow-2xl">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-white/[.03] px-5 py-4"><span className="flex items-center gap-2 text-sm font-semibold"><Terminal className="h-4 w-4 text-lime-300" /> Shroud terminal</span><span className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5 text-lime-300" /> {currentProject ? currentProject.name + " / " + (currentEnvironment?.name ?? "select environment") : "No project entered"}</span></div>
      <div ref={log} role="log" aria-live="polite" aria-label="Terminal output" className="h-[380px] space-y-5 overflow-y-auto p-5 font-mono text-xs leading-6 sm:p-7 sm:text-sm">
        {output.map((entry, index) => <div key={index}>{entry.command && <p className="break-all text-foreground"><span className="text-lime-300">shroud@{entry.context} $ </span>{entry.command}</p>}{entry.sensitive && <p className="mb-1 text-[10px] text-amber-300">Revealed values — {entry.context}</p>}{entry.text && <pre className={"whitespace-pre-wrap break-words font-mono " + (entry.error ? "text-red-300" : entry.sensitive ? "text-lime-200" : "text-slate-300")}>{entry.text}</pre>}</div>)}
        {busy && <p className="flex items-center gap-2 text-lime-300"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Running...</p>}
      </div>
      <form onSubmit={submit} className="flex items-center gap-3 border-t border-white/10 px-5 py-4 sm:px-7"><span aria-hidden="true" className="max-w-[40%] truncate font-mono text-xs text-lime-300">{context} $</span><input ref={commandInput} aria-label="Terminal command" className="min-w-0 flex-1 bg-transparent font-mono text-sm outline-none placeholder:text-slate-600" placeholder={projectId ? 'shroud push API_KEY "value"' : "shroud use <project>"} value={input} onChange={(event) => { setInput(event.target.value); setHistoryPosition(-1); }} onKeyDown={recall} autoComplete="off" spellCheck={false} maxLength={65536} disabled={busy} /><button type="submit" aria-label="Run command" disabled={busy || !input.trim()} className="rounded-lg bg-lime-300/10 p-2 text-lime-300 disabled:opacity-30"><ArrowRight className="h-4 w-4" /></button></form>
    </div>
    <div className="flex flex-wrap gap-2">{[{ command: "help", label: "Help" }, { command: "shroud projects", label: "Projects" }, { command: "shroud environments", label: "Environments" }, { command: "shroud secrets", label: "List keys" }, { command: "shroud secrets --values", label: "Show values" }].map(({ command, label }) => <button key={command} className="btn-outline min-h-0 px-3 py-2 text-xs" disabled={busy} onClick={() => void execute(command)}>{label}</button>)}<button className="btn-outline min-h-0 px-3 py-2 text-xs" disabled={busy} onClick={hideValues}><EyeOff className="h-3.5 w-3.5" />Hide values</button><button className="ml-auto text-xs text-muted-foreground hover:text-foreground" disabled={busy} onClick={() => void execute("clear")}>Clear terminal</button></div>
    <p className="text-xs leading-5 text-muted-foreground">Enter a project and environment before accessing variables. Pull reveals a value; push saves the name and value you type. Push values are excluded from command history. Revealed values disappear when you switch context, hide values, clear the terminal, or leave this page.</p>
  </div>;
}
