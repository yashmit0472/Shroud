"use client";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Event = { id: string; action: string; actor_id: string | null; token_id: string | null; created_at: string; resource_type: string | null; project_id: string | null; environment_id: string | null; ip_address: string | null };
export function AuditViewer({ teamId }: { teamId: string }) {
  const [events, setEvents] = useState<Event[]>([]);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async (signal: AbortSignal) => {
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/v1/audit?team_id=${encodeURIComponent(teamId)}&page=${page}&${query}`, { signal, cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load events");
      setEvents(data.events); setTotal(data.total);
    } catch (err) { if (!signal.aborted) setError(err instanceof Error ? err.message : "Unable to load events"); }
    finally { if (!signal.aborted) setLoading(false); }
  }, [teamId, page, query]);
  useEffect(() => { const controller = new AbortController(); load(controller.signal); return () => controller.abort(); }, [load]);
  function filter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams();
    for (const [key, value] of new FormData(event.currentTarget)) if (typeof value === "string" && value.trim()) params.set(key, key === "to" ? `${value}T23:59:59.999Z` : value.trim());
    setPage(0); setQuery(params.toString());
  }
  return <div className="space-y-6">
    <form onSubmit={filter} className="grid gap-4 rounded-xl border p-5 sm:grid-cols-2 lg:grid-cols-3">
      <div className="space-y-2"><Label htmlFor="audit-action">Action</Label><Input id="audit-action" name="action" placeholder="secrets.pull" /></div>
      <div className="space-y-2"><Label htmlFor="audit-from">From (UTC)</Label><Input id="audit-from" name="from" type="date" /></div>
      <div className="space-y-2"><Label htmlFor="audit-to">To (UTC)</Label><Input id="audit-to" name="to" type="date" /></div>
      {[["actor_id", "User ID"], ["token_id", "Token ID"], ["project_id", "Project ID"], ["environment_id", "Environment ID"]].map(([name, label]) => <div key={name} className="space-y-2"><Label htmlFor={`audit-${name}`}>{label}</Label><Input id={`audit-${name}`} name={name} placeholder="UUID (optional)" /></div>)}
      <div className="flex items-end"><Button disabled={loading}>Apply filters</Button></div>
    </form>
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-muted-foreground">{total} events</p><a className="text-sm underline underline-offset-4" href={`/api/v1/audit?team_id=${encodeURIComponent(teamId)}&format=csv&${query}`}>Export latest 1,000 matching events as CSV</a></div>
    {error && <p role="alert" className="text-destructive">{error}</p>}
    {loading ? <p role="status">Loading activity...</p> : !error && events.length === 0 ? <p className="rounded-xl border border-dashed p-8 text-muted-foreground">No matching events. New activity appears here after the audit migration is applied.</p> : <div className="overflow-x-auto rounded-xl border"><table className="w-full text-left text-sm"><thead className="border-b bg-muted/30"><tr><th className="p-4">When</th><th className="p-4">Action</th><th className="p-4">Actor / token</th><th className="p-4">Scope</th><th className="p-4">IP</th></tr></thead><tbody>{events.map((event) => <tr key={event.id} className="border-b last:border-0"><td className="whitespace-nowrap p-4">{new Date(event.created_at).toLocaleString()}</td><td className="p-4 font-mono">{event.action}</td><td className="p-4"><p className="font-mono text-xs">{event.actor_id ?? "System"}</p>{event.token_id && <p className="mt-1 font-mono text-xs text-muted-foreground">Token: {event.token_id}</p>}</td><td className="p-4 text-xs"><p>{event.resource_type}</p>{event.project_id && <p className="font-mono">{event.project_id}</p>}{event.environment_id && <p className="font-mono">{event.environment_id}</p>}</td><td className="p-4">{event.ip_address ?? "—"}</td></tr>)}</tbody></table></div>}
    <div className="flex items-center justify-end gap-3"><Button variant="outline" disabled={loading || page === 0} onClick={() => setPage(page - 1)}>Previous</Button><span className="text-sm">Page {page + 1}</span><Button variant="outline" disabled={loading || (page + 1) * 50 >= total} onClick={() => setPage(page + 1)}>Next</Button></div>
  </div>;
}
