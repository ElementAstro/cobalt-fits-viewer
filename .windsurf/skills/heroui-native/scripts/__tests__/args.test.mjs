import test from "node:test";
import assert from "node:assert/strict";
import { parseCommonArgs } from "../_core/args.mjs";
import { SkillError } from "../_core/errors.mjs";

test("parseCommonArgs parses shared options and positionals", () => {
  const parsed = parseCommonArgs(
    ["Button", "--json", "--timeout", "12000", "--fallback", "never"],
    { minPositionals: 1, usage: "usage" },
  );

  assert.equal(parsed.positionals[0], "Button");
  assert.equal(parsed.format, "json");
  assert.equal(parsed.timeoutMs, 12000);
  assert.equal(parsed.fallback, "never");
});

test("parseCommonArgs throws SkillError on invalid format", () => {
  assert.throws(
    () => parseCommonArgs(["--format", "yaml"], { usage: "usage" }),
    (error) => error instanceof SkillError && error.code === "INVALID_ARGS",
  );
});
