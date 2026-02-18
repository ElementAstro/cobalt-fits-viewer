import {
  gunzipFitsBytes,
  gzipFitsBytes,
  isGzipFitsBytes,
  normalizeFitsCompression,
} from "../compression";

describe("fits compression helpers", () => {
  it("detects gzip header", () => {
    expect(isGzipFitsBytes(new Uint8Array([0x1f, 0x8b, 0x08]))).toBe(true);
    expect(isGzipFitsBytes(new Uint8Array([0x53, 0x49, 0x4d, 0x50]))).toBe(false);
  });

  it("round-trips gzip and gunzip", () => {
    const original = new TextEncoder().encode("SIMPLE  =                    T");
    const gz = gzipFitsBytes(original);
    expect(isGzipFitsBytes(gz)).toBe(true);
    const plain = gunzipFitsBytes(gz);
    expect(plain).toEqual(original);
  });

  it("normalizes between gzip/plain", () => {
    const original = new TextEncoder().encode("SIMPLE  =                    T");
    const gz = normalizeFitsCompression(original, "gzip");
    expect(isGzipFitsBytes(gz)).toBe(true);
    const plain = normalizeFitsCompression(gz, "none");
    expect(new TextDecoder().decode(plain)).toContain("SIMPLE");
  });
});
