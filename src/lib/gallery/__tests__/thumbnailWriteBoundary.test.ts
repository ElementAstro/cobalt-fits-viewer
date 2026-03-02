import { readdirSync, readFileSync } from "fs";
import { join, relative } from "path";

const SRC_ROOT = join(__dirname, "../../..");
const ALLOWED_FILES = new Set([
  "src/lib/gallery/thumbnailCache.ts",
  "src/lib/gallery/thumbnailWorkflow.ts",
  "src/lib/gallery/thumbnailGenerator.ts",
]);
const FORBIDDEN_CALL_RE =
  /\b(generateAndSaveThumbnail|generateVideoThumbnailToCache|copyThumbnailToCache)\s*\(/;

function walk(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.name === "__tests__") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(full));
      continue;
    }
    if (!entry.isFile()) continue;
    if (!full.endsWith(".ts") && !full.endsWith(".tsx")) continue;
    files.push(full);
  }
  return files;
}

describe("thumbnail write boundary", () => {
  it("restricts direct thumbnailCache write calls to gateway modules", () => {
    const offenders: string[] = [];
    for (const file of walk(SRC_ROOT)) {
      const rel = relative(process.cwd(), file).replace(/\\/g, "/");
      if (ALLOWED_FILES.has(rel)) continue;
      const content = readFileSync(file, "utf8");
      if (FORBIDDEN_CALL_RE.test(content)) {
        offenders.push(rel);
      }
    }

    expect(offenders).toEqual([]);
  });
});
