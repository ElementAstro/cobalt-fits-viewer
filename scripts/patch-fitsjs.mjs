/**
 * Patches fitsjs-ng dist files to replace dynamic import(e) with a variable argument,
 * which Metro's web bundler cannot statically analyze.
 * The replaced function returns a rejected Promise since this code path
 * is only used for lazy-loading Node.js modules that are already shimmed via metro.config.js.
 */
import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const patches = [
  {
    file: "node_modules/fitsjs-ng/dist/index.js",
    from: "function es(e){return import(e)}",
    to: 'function es(e){return Promise.reject(new Error("Dynamic import not supported: "+e))}',
  },
  {
    file: "node_modules/fitsjs-ng/dist/index.cjs",
    from: "function ts(e){return import(e)}",
    to: 'function ts(e){return Promise.reject(new Error("Dynamic import not supported: "+e))}',
  },
  {
    file: "node_modules/image-js/lib/align/affineTransfrom/getAffineTransform.js",
    from: "debugImagePath = `${import.meta.dirname}/montage.png`,",
    to: 'debugImagePath = "montage.png",',
  },
  {
    file: "node_modules/image-js/lib/utils/cross_platform.js",
    from: ".createRequire(import.meta.url);",
    to: ".createRequire(process.cwd() + '/');",
  },
];

let patched = 0;
for (const { file, from, to } of patches) {
  const filePath = resolve(root, file);
  try {
    const content = readFileSync(filePath, "utf8");
    if (content.includes(from)) {
      writeFileSync(filePath, content.replace(from, to), "utf8");
      console.log(`Patched: ${file}`);
      patched++;
    } else if (content.includes(to)) {
      console.log(`Already patched: ${file}`);
    } else {
      console.warn(`Pattern not found in ${file}, skipping`);
    }
  } catch (err) {
    console.warn(`Could not patch ${file}: ${err.message}`);
  }
}
console.log(`Done. ${patched} file(s) patched.`);
