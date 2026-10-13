import assert from "node:assert/strict";
import { test } from "node:test";
import { selectWorkspace, Workspace } from "../../web/lib/workspace-selection.ts";
import { safeRedirectPath } from "../../web/lib/auth-redirect.ts";

const workspaces: Workspace[] = [{ id: "first", name: "First", slug: "first", role: "owner" }, { id: "second", name: "Second", slug: "second", role: "viewer" }];

test("workspace selection supports multiple memberships with independent roles", () => {
  assert.equal(selectWorkspace(workspaces, "second")?.role, "viewer");
  assert.equal(selectWorkspace(workspaces, "first")?.role, "owner");
  assert.equal(selectWorkspace(workspaces)?.id, "first");
});

test("invalid and revoked selections fall back only to a current membership", () => {
  assert.equal(selectWorkspace(workspaces, "outsider-workspace")?.id, "first");
  assert.equal(selectWorkspace(workspaces.slice(1), "first")?.id, "second");
  assert.equal(selectWorkspace([], "first"), null);
});

test("joining a workspace preserves invitation navigation without allowing external redirects", () => {
  assert.equal(safeRedirectPath("/invite/invitation-token", "/dashboard"), "/invite/invitation-token");
  for (const path of ["https://evil.example", "//evil.example", "/\\evil.example", "/\nunsafe", null]) assert.equal(safeRedirectPath(path, "/dashboard"), "/dashboard");
});
