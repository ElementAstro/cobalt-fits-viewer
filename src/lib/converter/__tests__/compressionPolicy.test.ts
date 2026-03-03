import { isTargetSizeAllowed, normalizeTargetFileSize } from "../compressionPolicy";

describe("compressionPolicy", () => {
  it("allows target size for jpeg", () => {
    expect(isTargetSizeAllowed("jpeg", false)).toBe(true);
  });

  it("disallows target size for webp lossless", () => {
    expect(isTargetSizeAllowed("webp", true)).toBe(false);
  });

  it("returns normalized target bytes only for valid targetSize mode", () => {
    expect(normalizeTargetFileSize("jpeg", "targetSize", 120 * 1024, false)).toBe(120 * 1024);
    expect(normalizeTargetFileSize("png", "targetSize", 120 * 1024, false)).toBeUndefined();
    expect(normalizeTargetFileSize("webp", "targetSize", 120 * 1024, true)).toBeUndefined();
    expect(normalizeTargetFileSize("webp", "quality", 120 * 1024, false)).toBeUndefined();
    expect(normalizeTargetFileSize("jpeg", "targetSize", 0, false)).toBeUndefined();
  });
});
