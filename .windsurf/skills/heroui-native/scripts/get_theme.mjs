#!/usr/bin/env node

import { pathToFileURL } from "node:url";
import { parseCommonArgs } from "./_core/args.mjs";
import { createHttpClient } from "./_core/client.mjs";
import { EXIT_CODE, SkillError, failureEnvelope, successEnvelope } from "./_core/errors.mjs";
import { resolveWithFallback } from "./_core/fallback.mjs";
import { normalizeThemePayload } from "./_core/normalize.mjs";
import { createRuntime, emitEnvelope, log, writeStderr, writeStdout } from "./_core/output.mjs";
import { FALLBACK_THEME } from "./_core/theme-fallback.mjs";

const USAGE = [
  "Usage: node get_theme.mjs [options]",
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

function formatColors(colors) {
  const grouped = {};
  for (const token of colors) {
    const key = token.category ?? "semantic";
    grouped[key] ??= [];
    grouped[key].push(token);
  }

  const lines = [];
  for (const [category, tokens] of Object.entries(grouped)) {
    lines.push(`  /* ${category.charAt(0).toUpperCase() + category.slice(1)} Colors */`);
    for (const token of tokens) {
      lines.push(`  ${token.name}: ${token.value};`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

function renderThemeText(data) {
  const lines = [];
  lines.push("/* HeroUI Native Theme Variables */");
  lines.push(`/* Theme: ${data.theme} */`);
  lines.push(`/* Version: ${data.latestVersion} */`);
  lines.push("");

  if (data.light?.colors?.length) {
    lines.push("/* Light Mode Colors */");
    lines.push(formatColors(data.light.colors));
  }

  if (data.dark?.colors?.length) {
    lines.push("/* Dark Mode Colors */");
    lines.push(formatColors(data.dark.colors));
  }

  if (data.borderRadius && Object.keys(data.borderRadius).length > 0) {
    lines.push("/* Border Radius */");
    for (const [key, value] of Object.entries(data.borderRadius)) {
      lines.push(`  --radius-${key}: ${value};`);
    }
    lines.push("");
  }

  if (data.opacity && Object.keys(data.opacity).length > 0) {
    lines.push("/* Opacity */");
    for (const [key, value] of Object.entries(data.opacity)) {
      lines.push(`  --opacity-${key}: ${value};`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

async function fetchPrimary(client) {
  const raw = await client.getJsonFromApi("/v1/themes/variables?theme=default");
  return normalizeThemePayload(raw);
}

async function fetchFallback() {
  return normalizeThemePayload(FALLBACK_THEME);
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

    log(runtime, args, "debug", "Fetching Native theme variables...");
    const client = createHttpClient({ apiBase: args.apiBase, timeoutMs: args.timeoutMs });
    const resolved = await resolveWithFallback({
      policy: args.fallback,
      fetchPrimary: () => fetchPrimary(client),
      fetchFallback,
      isPrimaryUsable: (data) =>
        Array.isArray(data?.light?.colors) &&
        Array.isArray(data?.dark?.colors) &&
        data.light.colors.length > 0 &&
        data.dark.colors.length > 0,
    });

    const envelope = successEnvelope(resolved.data, {
      source: resolved.source,
      meta: {
        fallbackUsed: resolved.usedFallback,
        latestVersion: resolved.data.latestVersion,
        timingMs: Date.now() - startedAt,
      },
    });

    if (args.format === "json") {
      emitEnvelope(runtime, args, envelope);
    } else {
      writeStdout(runtime, renderThemeText(resolved.data));
      if (args.verbose) {
        writeStderr(runtime, "# Raw JSON output:");
        writeStderr(runtime, JSON.stringify(resolved.data, null, 2));
      }
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
