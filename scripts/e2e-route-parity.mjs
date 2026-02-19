import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const APP_DIR = path.join(ROOT, "src", "app");
const FLOWS_DIR = path.join(ROOT, ".maestro", "flows", "pages");

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
      continue;
    }
    out.push(full);
  }
  return out;
}

function toPosix(p) {
  return p.split(path.sep).join("/");
}

function normalizeSegment(seg) {
  if (/^\[\.\.\..+\]$/.test(seg)) return `splat_${seg.slice(4, -1)}`;
  if (/^\[.+\]$/.test(seg)) return `param_${seg.slice(1, -1)}`;
  return seg.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function routeToFlowName(rel) {
  const route = rel.replace(/\.tsx$/, "");

  if (route === "index") return "root__index.yaml";
  if (route === "[...missing]") return "notfound__splat_missing.yaml";

  if (route.startsWith("(tabs)/")) {
    const rest = route.slice("(tabs)/".length);
    const normalized = rest
      .split("/")
      .filter(Boolean)
      .map(normalizeSegment)
      .join("__");
    return `tabs__${normalized}.yaml`;
  }

  const normalized = route
    .split("/")
    .filter(Boolean)
    .map(normalizeSegment)
    .join("__");

  return `${normalized}.yaml`;
}

const routeFiles = walk(APP_DIR)
  .filter((file) => file.endsWith(".tsx"))
  .filter((file) => !file.includes(`${path.sep}__tests__${path.sep}`))
  .filter((file) => path.basename(file) !== "_layout.tsx")
  .filter((file) => path.basename(file) !== "CLAUDE.md");

const expected = new Map();
for (const file of routeFiles) {
  const rel = toPosix(path.relative(APP_DIR, file));
  expected.set(rel, routeToFlowName(rel));
}

const expectedFlowSet = new Set(expected.values());
const actualFlowFiles = fs.existsSync(FLOWS_DIR)
  ? fs
      .readdirSync(FLOWS_DIR)
      .filter((file) => file.endsWith(".yml") || file.endsWith(".yaml"))
  : [];
const actualFlowSet = new Set(actualFlowFiles);

const missing = [];
for (const [route, flow] of expected.entries()) {
  if (!actualFlowSet.has(flow)) {
    missing.push({ route, flow });
  }
}

const extra = [];
for (const flow of actualFlowSet) {
  if (!expectedFlowSet.has(flow)) {
    extra.push(flow);
  }
}

if (missing.length > 0 || extra.length > 0) {
  if (missing.length > 0) {
    console.error("Missing page flows:");
    for (const item of missing) {
      console.error(`- ${item.route} -> ${item.flow}`);
    }
  }
  if (extra.length > 0) {
    console.error("Unexpected flow files:");
    for (const flow of extra) {
      console.error(`- ${flow}`);
    }
  }
  process.exit(1);
}

console.log(`OK: ${expected.size}/${expected.size} routes have matching Maestro page flows.`);
