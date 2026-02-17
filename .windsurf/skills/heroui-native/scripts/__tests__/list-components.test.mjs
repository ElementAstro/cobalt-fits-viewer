import test from "node:test";
import assert from "node:assert/strict";
import { run } from "../list_components.mjs";
import {
  createCaptureRuntime,
  mockFetchWith,
  parseStdoutJson,
  stderrText,
} from "./test-helpers.mjs";

test("list_components returns envelope JSON in --json mode", async () => {
  const restore = mockFetchWith(async () => ({
    ok: true,
    json: async () => ({ latestVersion: "v1.0.0", components: ["Button", "Card"] }),
  }));

  try {
    const capture = createCaptureRuntime();
    const exitCode = await run(["--json"], capture.runtime);
    const payload = parseStdoutJson(capture);

    assert.equal(exitCode, 0);
    assert.equal(payload.ok, true);
    assert.equal(payload.source, "api");
    assert.deepEqual(payload.data.components, ["Button", "Card"]);
    assert.equal(payload.data.count, 2);
    assert.equal(typeof payload.meta.timingMs, "number");
    assert.equal(stderrText(capture), "");
  } finally {
    restore();
  }
});

test("list_components supports fallback-only policy", async () => {
  const llmsTxt = `
### Components
- [Button](https://v3.heroui.com/docs/native/components/button)
- [Card](https://v3.heroui.com/docs/native/components/card)
### Next Section
`.trim();

  const restore = mockFetchWith(async () => ({
    ok: true,
    text: async () => llmsTxt,
  }));

  try {
    const capture = createCaptureRuntime();
    const exitCode = await run(["--json", "--fallback", "only"], capture.runtime);
    const payload = parseStdoutJson(capture);

    assert.equal(exitCode, 0);
    assert.equal(payload.source, "fallback");
    assert.equal(payload.data.count, 2);
  } finally {
    restore();
  }
});

test("list_components honors --api-base over environment variable", async () => {
  const previous = process.env.HEROUI_NATIVE_API_BASE;
  process.env.HEROUI_NATIVE_API_BASE = "https://from-env.example.com";
  let requestUrl = "";

  const restore = mockFetchWith(async (url) => {
    requestUrl = String(url);
    return {
      ok: true,
      json: async () => ({ latestVersion: "v1", components: ["Button"] }),
    };
  });

  try {
    const capture = createCaptureRuntime();
    const code = await run(["--json", "--api-base", "https://from-arg.example.com"], capture.runtime);
    assert.equal(code, 0);
    assert.match(requestUrl, /^https:\/\/from-arg\.example\.com\//);
  } finally {
    restore();
    if (previous === undefined) {
      delete process.env.HEROUI_NATIVE_API_BASE;
    } else {
      process.env.HEROUI_NATIVE_API_BASE = previous;
    }
  }
});
