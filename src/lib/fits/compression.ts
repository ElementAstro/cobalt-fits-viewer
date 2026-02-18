import { gzip, ungzip } from "pako";

const GZIP_MAGIC_0 = 0x1f;
const GZIP_MAGIC_1 = 0x8b;

function toBytes(input: ArrayBuffer | Uint8Array): Uint8Array {
  return input instanceof Uint8Array ? input : new Uint8Array(input);
}

export function isGzipFitsBytes(input: ArrayBuffer | Uint8Array): boolean {
  const bytes = toBytes(input);
  return bytes.length >= 2 && bytes[0] === GZIP_MAGIC_0 && bytes[1] === GZIP_MAGIC_1;
}

export function gzipFitsBytes(input: ArrayBuffer | Uint8Array): Uint8Array {
  const bytes = toBytes(input);
  return gzip(bytes);
}

export function gunzipFitsBytes(input: ArrayBuffer | Uint8Array): Uint8Array {
  const bytes = toBytes(input);
  try {
    return ungzip(bytes);
  } catch (error) {
    throw new Error(
      `Failed to decompress .fits.gz data: ${error instanceof Error ? error.message : "unknown error"}`,
    );
  }
}

export function normalizeFitsCompression(
  input: ArrayBuffer | Uint8Array,
  compression: "none" | "gzip",
): Uint8Array {
  const bytes = toBytes(input);
  if (compression === "gzip") {
    return isGzipFitsBytes(bytes) ? bytes : gzipFitsBytes(bytes);
  }
  return isGzipFitsBytes(bytes) ? gunzipFitsBytes(bytes) : bytes;
}
