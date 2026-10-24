import { PGlite } from "../.tmp/sql-check/node_modules/@electric-sql/pglite/dist/index.js";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

const db = new PGlite();
await db.exec(await readFile(new URL("./fixtures/schema.sql", import.meta.url), "utf8"));
const migration = await readFile(new URL("../supabase/migrations/202610130005_restore_secret_reads.sql", import.meta.url), "utf8");
await db.exec(migration);
await db.exec(migration); // Repair can safely be applied again.
const id = (n) => "00000000-0000-0000-0000-" + String(n).padStart(12, "0");
await db.query("INSERT INTO teams(id,name) VALUES ($1,'Test workspace'),($2,'Other workspace')", [id(1),id(2)]);
await db.query("INSERT INTO projects(id,team_id,name) VALUES ($1,$2,'Allowed'),($3,$4,'Forbidden')", [id(3),id(1),id(4),id(2)]);
await db.query("INSERT INTO environments(id,project_id,name,type) VALUES ($1,$2,'Development','development'),($3,$4,'Production','production')", [id(5),id(3),id(6),id(4)]);
await db.query("INSERT INTO team_members(team_id,user_id,role) VALUES ($1,$2,'viewer'),($1,$3,'developer')", [id(1),id(7),id(8)]);
await db.query("INSERT INTO project_members(project_id,user_id,role) VALUES ($1,$2,'viewer')", [id(3),id(7)]);
await db.query("INSERT INTO secrets(id,environment_id,key) VALUES ($1,$2,'TEST_VARIABLE'),($3,$4,'OTHER_VARIABLE')", [id(9),id(5),id(10),id(6)]);
await db.query("INSERT INTO secret_versions(secret_id,version,encrypted_value) VALUES ($1,1,'fixture-ciphertext-v1'),($1,2,'fixture-ciphertext-v2'),($2,1,'other-fixture-ciphertext')", [id(9),id(10)]);
let checks = 0;
async function denied(user,project,environment,role = "authenticated"){
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [user ?? ""]);
  await db.exec("SET ROLE " + role);
  try { await assert.rejects(db.query("SELECT * FROM public.shroud_browser_pull($1,$2)", [project,environment]), error => error.code === "42501"); checks++; }
  finally { await db.exec("RESET ROLE"); }
}
await denied(null,id(3),id(5),"anon");
await denied(null,id(3),id(5));
await denied(id(8),id(3),id(5)); // Workspace membership alone is insufficient.
await denied(id(7),id(4),id(6)); // Foreign workspace.
await denied(id(7),id(3),id(6)); // Environment from a different project.
assert.equal((await db.query("SELECT count(*)::int AS count FROM audit_logs")).rows[0].count,0);checks++;
await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [id(7)]);
await db.exec("SET ROLE authenticated");
const result = await db.query("SELECT * FROM public.shroud_browser_pull($1,$2)", [id(3),id(5)]);
await db.exec("RESET ROLE");
assert.deepEqual(result.rows,[{key:"TEST_VARIABLE",encrypted_value:"fixture-ciphertext-v2"}]);checks++;
const events = (await db.query("SELECT actor_id,project_id,environment_id,action,metadata FROM audit_logs")).rows;
assert.equal(events.length,1);checks++;
assert.equal(events[0].actor_id,id(7));checks++;
assert.equal(events[0].action,"secrets.pull");checks++;
assert.equal(events[0].metadata,null);checks++;
await db.query("DELETE FROM team_members WHERE user_id=$1", [id(7)]);
await denied(id(7),id(3),id(5)); // Revoked workspace access overrides stale project membership.
console.log(checks + " secret-read migration checks passed.");
await db.close();
