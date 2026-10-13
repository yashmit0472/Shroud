import assert from "node:assert/strict";
import { test } from "node:test";
import { parseEnvFile, serializeEnvFile } from "../src/lib/env-file.js";
import { environmentHealth } from "../../web/lib/environment-health.ts";

test("dotenv round trip preserves sensitive strings without interpolation", () => {
  const values = ["", "a=b=c", "has spaces", "#hash", "line\nsecond\r\nthird", 'quote"and\\slash', "tab\tvalue", "${HOME}", "$(whoami)", "'single'", "unicode 🔐"].map((value, index) => ({ key: `KEY_${index}`, value }));
  assert.deepEqual(parseEnvFile(serializeEnvFile(values)), values);
});
test("parses exports, comments, multiline values, CRLF and duplicate keys", () => {
  assert.deepEqual(parseEnvFile("\uFEFF# file\r\nexport ONE = first # note\r\nTWO='line\nnext'\nTHREE=abc#def\nONE=last\n"), [{ key: "ONE", value: "last" }, { key: "TWO", value: "line\nnext" }, { key: "THREE", value: "abc#def" }]);
});
test("rejects invalid lines without putting values into errors", () => {
  for (const input of ["INVALID-KEY=topsecret", 'KEY="topsecret', 'KEY="topsecret" junk', "KEY=top\0secret"]) {
    assert.throws(() => parseEnvFile(input), (error: unknown) => error instanceof Error && !error.message.includes("topsecret") && !error.message.includes("top\0secret"));
  }
  assert.throws(() => serializeEnvFile([{ key: "BAD\nKEY", value: "value" }]));
});
test("required keys survive an empty environment and optional keys are separate", () => {
  const health = environmentHealth(["dev", "prod", "empty"], [
    { environment_id: "dev", key: "DATABASE_URL", is_required: true },
    { environment_id: "dev", key: "DEBUG", is_required: false },
    { environment_id: "prod", key: "DATABASE_URL", is_required: false },
  ], ["STRIPE_KEY"]);
  assert.deepEqual(health[1], { id: "prod", missingRequired: ["STRIPE_KEY"], missingOptional: ["DEBUG"] });
  assert.deepEqual(health[2].missingRequired, ["DATABASE_URL", "STRIPE_KEY"]);
  assert.deepEqual(environmentHealth([], [], ["KEY"]), []);
});
