#!/usr/bin/env node

import { pathToFileURL } from "node:url";
import { parseCommonArgs } from "./_core/args.mjs";
import { createHttpClient } from "./_core/client.mjs";
import { EXIT_CODE, SkillError, failureEnvelope, successEnvelope } from "./_core/errors.mjs";
import { resolveWithFallback } from "./_core/fallback.mjs";
import { normalizeApiDocPath, normalizeDocPath } from "./_core/normalize.mjs";
import { createRuntime, emitEnvelope, log, writeStderr, writeStdout } from "./_core/output.mjs";

const FALLBACK_BASE = "https://v3.heroui.com";
const USAGE = [
  "Usage: node get_docs.mjs <path> [options]",
  "Example: node get_docs.mjs /docs/native/getting-started/theming",
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

function toTitleCaseFromPath(path) {
  const raw = path.split("/").pop() ?? "component";
  const name = raw.replace(".mdx", "").replace(/-/g, " ");
  return name
    .split(" ")
    .filter(Boolean)
    .map((segment) => segment[0].toUpperCase() + segment.slice(1))
    .join("");
}

async function fetchPrimary(client, path) {
  const apiPath = normalizeApiDocPath(path);
  const data = await client.getJsonFromApi(`/v1/docs/${apiPath}`);
  return {
    path,
    content: data?.content,
    contentType: data?.contentType ?? "mdx",
    source: "api",
    url: path,
  };
}

async function fetchFallback(client, path) {
  const cleanPath = normalizeDocPath(path);
  const url = `${FALLBACK_BASE}/${cleanPath}`;
  const content = await client.getText(url);
  return {
    path,
    content,
    contentType: "mdx",
    source: "fallback",
    url,
  };
}

export async function run(argv = process.argv.slice(2), runtime = createRuntime()) {
  const jsonMode = shouldOutputJson(argv);
  const startedAt = Date.now();
  let requestedPath = "";
  try {
    const args = parseCommonArgs(argv, { usage: USAGE, minPositionals: 1 });
    if (args.help) {
      writeStderr(runtime, USAGE);
      return EXIT_CODE.OK;
    }

    const path = args.positionals[0];
    requestedPath = path;

    if (path.includes("/components/")) {
      writeStderr(runtime, "# Warning: Use get_component_docs.mjs for component documentation.");
      writeStderr(runtime, `# Example: node get_component_docs.mjs ${toTitleCaseFromPath(path)}`);
    }
    if (!path.startsWith("/docs/native/")) {
      writeStderr(runtime, "# Warning: Native documentation paths should start with /docs/native/");
      writeStderr(runtime, `# Provided path: ${path}`);
    }

    const client = createHttpClient({ apiBase: args.apiBase, timeoutMs: args.timeoutMs });
    log(runtime, args, "debug", `Fetching Native documentation for ${path}`);

    const resolved = await resolveWithFallback({
      policy: args.fallback,
      fetchPrimary: () => fetchPrimary(client, path),
      fetchFallback: () => fetchFallback(client, path),
      isPrimaryUsable: (data) => typeof data.content === "string" && data.content.length > 0,
    });

    if (!resolved.data.content) {
      throw new SkillError("DOCS_NOT_FOUND", `Documentation not found: ${path}`, { path });
    }

    const envelope = successEnvelope(resolved.data, {
      source: resolved.source,
      meta: { fallbackUsed: resolved.usedFallback, path, timingMs: Date.now() - startedAt },
    });

    if (args.format === "json") {
      emitEnvelope(runtime, args, envelope);
    } else {
      writeStdout(runtime, resolved.data.content);
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
      if (requestedPath) {
        writeStdout(runtime, JSON.stringify({ error: envelope.error.message, path: requestedPath }, null, 2));
      } else {
        writeStderr(runtime, `${envelope.error.code}: ${envelope.error.message}`);
        if (envelope.error.detail?.usage) {
          writeStderr(runtime, envelope.error.detail.usage);
        }
      }
    }
    return error instanceof SkillError ? error.exitCode : EXIT_CODE.FAILURE;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const code = await run();
  process.exit(code);
}
