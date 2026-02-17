#!/usr/bin/env node

import { pathToFileURL } from "node:url";
import { parseCommonArgs } from "./_core/args.mjs";
import { createHttpClient } from "./_core/client.mjs";
import { EXIT_CODE, SkillError, failureEnvelope, successEnvelope } from "./_core/errors.mjs";
import { resolveWithFallback } from "./_core/fallback.mjs";
import {
  normalizeComponentItems,
  parseComponentsFromLlmsTxt,
} from "./_core/normalize.mjs";
import { createRuntime, emitEnvelope, log, writeStdout, writeStderr } from "./_core/output.mjs";

const LLMS_TXT_URL = "https://v3.heroui.com/native/llms.txt";
const USAGE = [
  "Usage: node list_components.mjs [options]",
  "",
  "Options:",
  "  --format <text|json>   Output format (default: text)",
  "  --json                 Alias for --format json",
  "  --timeout <ms>         Request timeout (default: 30000)",
  "  --api-base <url>       Override API base URL",
  "  --fallback <policy>    auto | never | only (default: auto)",
  "  --verbose              Print debug logs to stderr",
].join("\n");

function shouldOutputJson(argv) {
  if (argv.includes("--json")) return true;
  if (argv.includes("--format=json")) return true;
  const idx = argv.indexOf("--format");
  return idx >= 0 && argv[idx + 1] === "json";
}

function buildData(raw) {
  const items = normalizeComponentItems(raw.components ?? []);
  return {
    latestVersion: raw.latestVersion ?? "unknown",
    count: items.length,
    components: items.map((item) => item.name),
    componentItems: items,
  };
}

async function fetchPrimary(client) {
  const data = await client.getJsonFromApi("/v1/components");
  return buildData(data ?? {});
}

async function fetchFallback(client) {
  const content = await client.getText(LLMS_TXT_URL);
  const components = parseComponentsFromLlmsTxt(content);
  if (components.length === 0) {
    throw new SkillError("FALLBACK_EMPTY", "Fallback returned no components");
  }
  return buildData({ latestVersion: "unknown", components });
}

export async function run(argv = process.argv.slice(2), runtime = createRuntime()) {
  const jsonMode = shouldOutputJson(argv);
  const startedAt = Date.now();
  try {
    const args = parseCommonArgs(argv, { usage: USAGE });
    if (args.help) {
      writeStderr(runtime, USAGE);
      return EXIT_CODE.OK;
    }

    const client = createHttpClient({ apiBase: args.apiBase, timeoutMs: args.timeoutMs });
    log(runtime, args, "debug", "Fetching Native component list...");

    const resolved = await resolveWithFallback({
      policy: args.fallback,
      fetchPrimary: () => fetchPrimary(client),
      fetchFallback: () => fetchFallback(client),
      isPrimaryUsable: (data) => Array.isArray(data.components) && data.components.length > 0,
    });

    const envelope = successEnvelope(resolved.data, {
      source: resolved.source,
      meta: {
        latestVersion: resolved.data.latestVersion,
        fallbackUsed: resolved.usedFallback,
        timingMs: Date.now() - startedAt,
      },
    });

    if (args.format === "json") {
      emitEnvelope(runtime, args, envelope);
    } else {
      writeStdout(
        runtime,
        JSON.stringify(
          {
            latestVersion: resolved.data.latestVersion,
            components: resolved.data.components,
            count: resolved.data.count,
          },
          null,
          2,
        ),
      );
      writeStderr(
        runtime,
        `# Found ${resolved.data.count} Native components (${resolved.data.latestVersion})`,
      );
    }

    return EXIT_CODE.OK;
  } catch (error) {
    const envelope = failureEnvelope(error, {
      source: "api",
      meta: { timingMs: Date.now() - startedAt },
    });
    if (jsonMode) {
      emitEnvelope(runtime, { format: "json" }, envelope);
    } else {
      writeStderr(runtime, `${envelope.error.code}: ${envelope.error.message}`);
      if (envelope.error.detail?.usage) {
        writeStderr(runtime, envelope.error.detail.usage);
      }
    }
    return error instanceof SkillError ? error.exitCode : EXIT_CODE.FAILURE;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const code = await run();
  process.exit(code);
}
