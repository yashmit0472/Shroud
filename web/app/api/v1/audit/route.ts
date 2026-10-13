import { NextResponse } from "next/server";
import { teamAccess } from "@/lib/workspace-access";

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return `"${(/^[\s]*[=+@-]/.test(text) ? `'${text}` : text).replaceAll('"', '""')}"`;
}
export async function GET(request: Request) {
  const search = new URL(request.url).searchParams;
  const teamId = search.get("team_id");
  if (!teamId) return NextResponse.json({ error: "team_id is required" }, { status: 400 });
  const access = await teamAccess(teamId);
  if (access.status !== 200) return NextResponse.json({ error: "Unable to access this team" }, { status: access.status });
  const page = Number(search.get("page") ?? 0);
  if (!Number.isSafeInteger(page) || page < 0 || page > 10000) return NextResponse.json({ error: "Invalid page" }, { status: 400 });
  let query = access.supabase.from("audit_logs").select("id, actor_id, token_id, action, resource_type, resource_id, project_id, environment_id, ip_address, created_at", { count: "exact" }).eq("team_id", teamId);
  for (const column of ["action", "actor_id", "token_id", "project_id", "environment_id"] as const) {
    const value = search.get(column);
    if (value) {
      if (column !== "action" && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) return NextResponse.json({ error: `Invalid ${column}` }, { status: 400 });
      query = query.eq(column, value);
    }
  }
  for (const [parameter, method] of [["from", "gte"], ["to", "lte"]] as const) {
    const value = search.get(parameter);
    if (value) {
      if (!Number.isFinite(Date.parse(value))) return NextResponse.json({ error: `Invalid ${parameter} date` }, { status: 400 });
      query = query[method]("created_at", new Date(value).toISOString());
    }
  }
  const exportCsv = search.get("format") === "csv";
  const limit = exportCsv ? 1000 : 50;
  const { data, error, count } = await query.order("created_at", { ascending: false }).order("id").range(page * limit, (page + 1) * limit - 1);
  if (error) return NextResponse.json({ error: "Unable to load audit events" }, { status: 500 });
  if (exportCsv) {
    const columns = ["created_at", "action", "actor_id", "token_id", "resource_type", "resource_id", "project_id", "environment_id", "ip_address"] as const;
    const content = [columns.map(csvCell).join(","), ...(data ?? []).map((row) => columns.map((column) => csvCell(row[column])).join(","))].join("\r\n");
    return new NextResponse(content, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="shroud-audit.csv"', "Cache-Control": "no-store" } });
  }
  return NextResponse.json({ events: data ?? [], total: count ?? 0, page }, { headers: { "Cache-Control": "no-store" } });
}
