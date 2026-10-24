import assert from "node:assert/strict";
import { test } from "node:test";
import { secretReadErrorMessage } from "../../web/lib/secret-read-errors.ts";

test("secret reads distinguish missing setup, access, and encryption failures", () => {
  assert.match(secretReadErrorMessage("READ_SETUP_REQUIRED",500),/202610130005_restore_secret_reads.sql/);
  assert.match(secretReadErrorMessage("SESSION_EXPIRED",401),/Sign in again/);
  assert.match(secretReadErrorMessage("ACCESS_DENIED",403),/does not have access/);
  assert.match(secretReadErrorMessage("SECRET_UNREADABLE",500),/original encryption key/);
  assert.match(secretReadErrorMessage("ENCRYPTION_NOT_CONFIGURED",500),/missing or invalid/);
});
test("unknown error payloads never become user-facing secret-read messages", () => {
  const privateText = "fixture-private-value";
  for (const payload of [privateText, {error:privateText}, null, undefined]) {
    assert.equal(secretReadErrorMessage(payload,500), "Secret reads are temporarily unavailable. Check your connection and retry.");
    assert.equal(secretReadErrorMessage(payload,500).includes(privateText),false);
  }
});
