import test from "node:test";
import assert from "node:assert/strict";
import { run } from "../get_theme.mjs";
import { createCaptureRuntime, parseStdoutJson } from "./test-helpers.mjs";

test("get_theme supports fallback-only JSON output", async () => {
  const capture = createCaptureRuntime();
  const exitCode = await run(["--json", "--fallback", "only"], capture.runtime);
  const payload = parseStdoutJson(capture);

  assert.equal(exitCode, 0);
  assert.equal(payload.ok, true);
  assert.equal(payload.source, "fallback");
  assert.ok(Array.isArray(payload.data.light.colors));
  assert.ok(Array.isArray(payload.data.dark.colors));
  assert.equal(typeof payload.meta.timingMs, "number");
});
