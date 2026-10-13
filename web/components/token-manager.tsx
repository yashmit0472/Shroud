"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Token = { id: string; name: string; token_prefix: string; scopes: string[]; expires_at: string | null; created_at: string; last_used_at: string | null; revoked_at: string | null };

export function TokenManager({ teamId }: { teamId: string }) {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [name, setName] = useState("");
  const [days, setDays] = useState("30");
  const [write, setWrite] = useState(false);
  const [secret, setSecret] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [revokeId, setRevokeId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const response = await fetch(`/api/v1/tokens?team_id=${encodeURIComponent(teamId)}`, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Unable to load tokens");
    setTokens(data.tokens);
  }, [teamId]);

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "Unable to load tokens")).finally(() => setLoading(false));
  }, [load]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(""); setNotice(""); setSecret("");
    try {
      const response = await fetch("/api/v1/tokens", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ team_id: teamId, name, scopes: write ? ["secrets:read", "secrets:write"] : ["secrets:read"], expires_at: new Date(Date.now() + Number(days) * 86400000).toISOString() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to create token");
      setSecret(data.secret); setName("");
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to create token"); }
    finally { setBusy(false); }
  }

  async function revoke(id: string) {
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/v1/tokens/${id}?team_id=${encodeURIComponent(teamId)}`, { method: "DELETE" });
      if (!response.ok) { const data = await response.json(); throw new Error(data.error || "Unable to revoke token"); }
      setRevokeId(null); setSecret(""); setNotice("Token revoked. Clients using it will need a new token.");
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to revoke token"); }
    finally { setBusy(false); }
  }

  return <div className="space-y-8">
    <form onSubmit={create} className="space-y-5 rounded-xl border bg-card p-6">
      <h2 className="text-lg font-semibold">Create API token</h2>
      <div className="space-y-2"><Label htmlFor="token-name">Name</Label><Input id="token-name" placeholder="GitHub Actions" value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} disabled={busy} /></div>
      <div className="space-y-2"><Label htmlFor="token-expiry">Expires after</Label><select id="token-expiry" className="w-full rounded-md border bg-background px-3 py-2" value={days} onChange={(e) => setDays(e.target.value)} disabled={busy}><option value="7">7 days</option><option value="30">30 days</option><option value="90">90 days</option><option value="365">1 year</option></select></div>
      <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={write} onChange={(e) => setWrite(e.target.checked)} disabled={busy} />Allow secret writes (read access is included)</label>
      <Button type="submit" disabled={busy || loading}>{busy ? "Working..." : "Create token"}</Button>
    </form>
    {secret && <div className="space-y-3 rounded-xl border border-amber-500/50 bg-amber-500/5 p-6">
      <h2 className="font-semibold">Save your token now</h2><p className="text-sm text-muted-foreground">This is the only time the full token is shown. Store it in a password manager or your CI secret store.</p>
      <code className="block break-all rounded-md border bg-background p-3 text-sm">{secret}</code>
      <div className="flex gap-3"><Button variant="outline" disabled={busy} onClick={async () => { try { await navigator.clipboard.writeText(secret); setNotice("Token copied."); } catch { setError("Copy failed. Select and copy the token manually."); } }}>Copy token</Button><Button variant="outline" onClick={() => setSecret("")}>Dismiss</Button></div>
    </div>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {notice && <p role="status" className="text-sm text-muted-foreground">{notice}</p>}
    <section className="space-y-4"><h2 className="text-lg font-semibold">Workspace tokens</h2>
      {loading ? <p className="text-sm text-muted-foreground">Loading tokens...</p> : tokens.length === 0 ? <p className="rounded-xl border border-dashed p-8 text-sm text-muted-foreground">No API tokens yet. Create one to use the CLI or connect CI/CD.</p> : tokens.map((token) => <div key={token.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border p-5">
        <div><p className="font-medium">{token.name}{token.revoked_at && <span className="ml-2 text-xs text-destructive">Revoked</span>}</p><p className="mt-1 font-mono text-xs text-muted-foreground">{token.token_prefix}...</p><p className="mt-2 text-xs text-muted-foreground">{token.scopes.join(", ")} Â· {token.expires_at ? `${Date.parse(token.expires_at) <= Date.now() ? "Expired" : "Expires"} ${new Date(token.expires_at).toLocaleDateString()}` : "No expiration"}</p><p className="mt-1 text-xs text-muted-foreground">Last used: {token.last_used_at ? new Date(token.last_used_at).toLocaleString() : "Never"}</p></div>
        {revokeId === token.id ? <div className="flex flex-wrap items-center gap-2"><span className="text-sm">Revoke this token?</span><Button variant="destructive" disabled={busy} onClick={() => revoke(token.id)}>Confirm revoke</Button><Button variant="outline" disabled={busy} onClick={() => setRevokeId(null)}>Cancel</Button></div> : <Button variant="outline" disabled={busy || Boolean(token.revoked_at)} onClick={() => setRevokeId(token.id)}>Revoke</Button>}
      </div>)}
    </section>
  </div>;
}
