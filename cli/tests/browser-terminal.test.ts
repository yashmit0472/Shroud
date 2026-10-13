import assert from "node:assert/strict";
import { test } from "node:test";
import { assertBrowserContext, browserCommandDisplay, parseBrowserCommand, parseBrowserEnv, serializeBrowserEnv } from "../../web/lib/browser-cli.ts";

test("browser commands require explicit project and environment context", () => {
  assert.deepEqual(parseBrowserCommand("shroud use my-api"), { action: "use", project: "my-api" });
  assert.deepEqual(parseBrowserCommand('shroud cd "My First Project"'), { action: "use", project: "My First Project" });
  assert.deepEqual(parseBrowserCommand("cd .."), { action: "use", project: ".." });
  assert.deepEqual(parseBrowserCommand("shroud env development"), { action: "env", environment: "development" });
  for (const action of ["secrets", "pull", "push", "environments", "env"]) assert.throws(() => assertBrowserContext(action, "", ""));
  for (const action of ["secrets", "pull", "push"]) assert.throws(() => assertBrowserContext(action, "project-id", ""));
  assert.doesNotThrow(() => assertBrowserContext("environments", "project-id", ""));
  assert.doesNotThrow(() => assertBrowserContext("pull", "project-id", "environment-id"));
  assert.doesNotThrow(() => assertBrowserContext("projects", "", ""));
  assert.doesNotThrow(() => assertBrowserContext("use", "", ""));
});

test("single-variable pull and push support literal values and redact push displays", () => {
  assert.deepEqual(parseBrowserCommand("shroud pull TEST_VARIABLE"), { action: "pull", key: "TEST_VARIABLE" });
  assert.deepEqual(parseBrowserCommand("shroud secrets --values"), { action: "secrets", showValues: true });
  assert.deepEqual(parseBrowserCommand('shroud push TOKEN "two  spaces # $ENV"'), { action: "push", key: "TOKEN", value: "two  spaces # $ENV" });
  assert.deepEqual(parseBrowserCommand("shroud push TOKEN=abc=def"), { action: "push", key: "TOKEN", value: "abc=def" });
  assert.deepEqual(parseBrowserCommand("shroud push EMPTY="), { action: "push", key: "EMPTY", value: "" });
  assert.deepEqual(parseBrowserCommand('shroud push EMPTY ""'), { action: "push", key: "EMPTY", value: "" });
  const input = 'shroud push PATH "C:\\work\\file"';
  assert.equal(parseBrowserCommand(input).value, "C:\\work\\file");
  const privateCommand = 'shroud push TOKEN "private-value"';
  assert.equal(browserCommandDisplay(parseBrowserCommand(privateCommand), privateCommand), "shroud push TOKEN [value hidden]");
});

test("browser command errors do not echo secret inputs", () => {
  assert.deepEqual(parseBrowserCommand("shroud --help"), { action: "help" });
  for (const command of ["shroud run npm run dev", "shroud pull KEY && curl example.com", "help secret", "shroud push", "shroud push KEY", 'shroud push KEY "unclosed-private-value', 'shroud push KEY "value" trailing', "shroud pull -p api", "shroud use", "shroud env"]) {
    assert.throws(() => parseBrowserCommand(command), (error: Error) => !error.message.includes("unclosed-private-value"));
  }
});

test("browser dotenv helpers preserve literal values and multiline strings", () => {
  const values = [{ key: "TOKEN", value: 'quotes" slash\\ $ENV $(echo hi)\nline\r\ttab' }, { key: "EMPTY", value: "" }];
  assert.deepEqual(parseBrowserEnv(serializeBrowserEnv(values)), values);
  assert.deepEqual(parseBrowserEnv("export KEY=first\nKEY='last'\nMULTILINE=\"line1\nline2\""), [{ key: "KEY", value: "last" }, { key: "MULTILINE", value: "line1\nline2" }]);
});

test("invalid env files report location without echoing sensitive content", () => {
  assert.throws(() => parseBrowserEnv("malformed sensitive-secret"), (error: Error) => error.message === "Invalid environment variable on line 1");
  assert.throws(() => parseBrowserEnv('KEY="unfinished-secret'), (error: Error) => !error.message.includes("unfinished-secret"));
  assert.throws(() => parseBrowserCommand("shroud push KEY=value\0"));
});
