/* eslint-disable @typescript-eslint/no-require-imports, no-undef */
// Patch TextDecoder before any module loads (fitsjs-ng needs 'ascii' encoding)
const OriginalTextDecoder = globalThis.TextDecoder;
if (OriginalTextDecoder) {
  const ENCODING_ALIASES = {
    ascii: "utf-8",
    "us-ascii": "utf-8",
    latin1: "utf-8",
    "iso-8859-1": "utf-8",
  };
  globalThis.TextDecoder = class PatchedTextDecoder extends OriginalTextDecoder {
    constructor(label, options) {
      const normalized = (label || "utf-8").toLowerCase().trim();
      super(ENCODING_ALIASES[normalized] || label, options);
    }
  };
}

// Load expo-router entry after the patch
require("expo-router/entry");
