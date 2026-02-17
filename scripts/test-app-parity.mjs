import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const APP_DIR = path.join(ROOT, "src", "app");

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, out);
      continue;
    }
    out.push(fullPath);
  }
  return out;
}

function toPosix(p) {
  return p.split(path.sep).join("/");
}

const allFiles = walk(APP_DIR);

const routeFiles = allFiles
  .filter((file) => file.endsWith(".tsx"))
  .filter((file) => !file.includes(`${path.sep}__tests__${path.sep}`))
  .filter((file) => !file.endsWith(".test.tsx"))
  .filter((file) => !file.endsWith("CLAUDE.md"));

const missingTests = [];

for (const routeFile of routeFiles) {
  const routeDir = path.dirname(routeFile);
  const routeBase = path.basename(routeFile, ".tsx");
  const expectedTest = path.join(routeDir, "__tests__", `${routeBase}.test.tsx`);
  if (!fs.existsSync(expectedTest)) {
    missingTests.push({
      route: toPosix(path.relative(ROOT, routeFile)),
      expectedTest: toPosix(path.relative(ROOT, expectedTest)),
    });
  }
}

if (missingTests.length > 0) {
  console.error("Missing route tests:");
  for (const item of missingTests) {
    console.error(`- ${item.route} -> ${item.expectedTest}`);
  }
  process.exit(1);
}

console.log(`OK: ${routeFiles.length} routes have matching test files.`);
