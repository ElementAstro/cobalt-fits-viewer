import test from "node:test";
import assert from "node:assert/strict";
import { run } from "../get_docs.mjs";
import {
  createCaptureRuntime,
  mockFetchWith,
  parseStdoutJson,
  stdoutText,
  stderrText,
} from "./test-helpers.mjs";

test("get_docs returns JSON failure envelope when fallback is disabled and API fails", async () => {
  const restore = mockFetchWith(async () => ({
    ok: false,
    status: 404,
    statusText: "Not Found",
    text: async () => "",
  }));

  try {
    const capture = createCaptureRuntime();
    const exitCode = await run(
      ["/docs/native/getting-started/theming", "--json", "--fallback", "never"],
      capture.runtime,
    );
    const payload = parseStdoutJson(capture);

    assert.equal(exitCode, 1);
    assert.equal(payload.ok, false);
    assert.equal(payload.error.code, "HTTP_ERROR");
  } finally {
    restore();
  }
});

test("get_docs keeps text-mode failure compatibility payload", async () => {
  const restore = mockFetchWith(async () => ({
    ok: false,
    status: 404,
    statusText: "Not Found",
    text: async () => "",
  }));

  try {
    const capture = createCaptureRuntime();
    const exitCode = await run(["/bad/path"], capture.runtime);
    assert.equal(exitCode, 1);

    const payload = JSON.parse(stdoutText(capture));
    assert.equal(payload.path, "/bad/path");
    assert.match(payload.error, /404/);
    assert.match(stderrText(capture), /Warning: Native documentation paths/);
  } finally {
    restore();
  }
});
