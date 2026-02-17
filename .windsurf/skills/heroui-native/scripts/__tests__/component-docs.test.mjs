import test from "node:test";
import assert from "node:assert/strict";
import { run } from "../get_component_docs.mjs";
import {
  createCaptureRuntime,
  mockFetchWith,
  parseStdoutJson,
  stderrText,
} from "./test-helpers.mjs";

test("get_component_docs prints usage when no args are provided", async () => {
  const capture = createCaptureRuntime();
  const exitCode = await run([], capture.runtime);
  assert.equal(exitCode, 1);
  assert.match(stderrText(capture), /Usage: node get_component_docs\.mjs/);
});

test("get_component_docs returns failure envelope when API returns component error", async () => {
  const restore = mockFetchWith(async () => ({
    ok: true,
    json: async () => ({
      results: [
        {
          component: "NotARealComponent",
          error: "Component not found",
          status: 500,
          statusText: "Internal Server Error",
        },
      ],
    }),
  }));

  try {
    const capture = createCaptureRuntime();
    const exitCode = await run(["NotARealComponent", "--json"], capture.runtime);
    const payload = parseStdoutJson(capture);

    assert.equal(exitCode, 1);
    assert.equal(payload.ok, false);
    assert.equal(payload.error.code, "COMPONENT_DOCS_INCOMPLETE");
    assert.equal(payload.data.results[0].component, "NotARealComponent");
  } finally {
    restore();
  }
});
