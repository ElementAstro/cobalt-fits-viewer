#!/usr/bin/env node

import { pathToFileURL } from "node:url";
import { parseCommonArgs } from "./_core/args.mjs";
import { createHttpClient } from "./_core/client.mjs";
import { EXIT_CODE, SkillError, failureEnvelope, successEnvelope } from "./_core/errors.mjs";
import { resolveWithFallback } from "./_core/fallback.mjs";
import { toKebabCase } from "./_core/normalize.mjs";
import { createRuntime, emitEnvelope, log, writeStderr, writeStdout } from "./_core/output.mjs";

const FALLBACK_BASE = "https://v3.heroui.com";
const USAGE = [
  "Usage: node get_component_docs.mjs <Component1> [Component2] ... [options]",
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

function normalizeResult(result) {
  return {
    component: result.component,
    content: result.content,
    contentType: result.contentType ?? "mdx",
    source: result.source ?? "api",
    url: result.url,
    error: result.error,
    status: result.status,
    statusText: result.statusText,
  };
}

async function fetchPrimary(client, components) {
  const payload = await client.getJsonFromApi("/v1/components/docs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ components }),
  });
  const results = (payload?.results ?? []).map(normalizeResult);
  return { results };
}

async function fetchFallback(client, components) {
  const results = [];
  for (const component of components) {
    const slug = toKebabCase(component);
    const url = `${FALLBACK_BASE}/docs/native/components/${slug}.mdx`;
    try {
      const content = await client.getText(url);
      results.push(
        normalizeResult({
          component,
          content,
          source: "fallback",
          url,
          contentType: "mdx",
        }),
      );
    } catch {
      results.push(
        normalizeResult({
          component,
          error: `Failed to fetch docs for ${component}`,
          source: "fallback",
          status: 404,
          statusText: "Not Found",
          url,
        }),
      );
    }
  }
  return { results };
}

function validateResults(data) {
  return Array.isArray(data.results) && data.results.length > 0;
}

function hasErrors(results) {
  return results.some((item) => !item.content);
}

export async function run(argv = process.argv.slice(2), runtime = createRuntime()) {
  const jsonMode = shouldOutputJson(argv);
  const startedAt = Date.now();
  try {
    const args = parseCommonArgs(argv, { usage: USAGE, minPositionals: 1 });
    if (args.help) {
      writeStderr(runtime, USAGE);
      return EXIT_CODE.OK;
    }

    const components = args.positionals;
    const client = createHttpClient({ apiBase: args.apiBase, timeoutMs: args.timeoutMs });

    log(runtime, args, "debug", `Fetching Native docs for: ${components.join(", ")}`);
    const resolved = await resolveWithFallback({
      policy: args.fallback,
      fetchPrimary: () => fetchPrimary(client, components),
      fetchFallback: () => fetchFallback(client, components),
      isPrimaryUsable: validateResults,
    });

    const envelope = successEnvelope(resolved.data, {
      source: resolved.source,
      meta: {
        requestedComponents: components,
        fallbackUsed: resolved.usedFallback,
        timingMs: Date.now() - startedAt,
      },
    });

    if (hasErrors(resolved.data.results)) {
      const error = new SkillError(
        "COMPONENT_DOCS_INCOMPLETE",
        "One or more component docs failed to fetch",
        { requestedComponents: components, results: resolved.data.results },
      );
      const fail = failureEnvelope(error, {
        source: resolved.source,
        data: resolved.data,
        meta: {
          ...envelope.meta,
          timingMs: Date.now() - startedAt,
        },
      });
      if (args.format === "json") {
        emitEnvelope(runtime, args, fail);
      } else if (resolved.data.results.length === 1) {
        writeStdout(runtime, JSON.stringify(resolved.data.results[0], null, 2));
      } else {
        writeStdout(runtime, JSON.stringify(resolved.data, null, 2));
      }
      return EXIT_CODE.FAILURE;
    }

    if (args.format === "json") {
      emitEnvelope(runtime, args, envelope);
    } else if (resolved.data.results.length === 1) {
      writeStdout(runtime, resolved.data.results[0].content);
    } else {
      writeStdout(runtime, JSON.stringify(resolved.data, null, 2));
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
