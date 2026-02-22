/**
 * backupUtils 工具函数测试
 */

import {
  toSafeRemoteFilename,
  toSafeThumbnailFilename,
  bytesToHex,
  computeSha256Hex,
  resolveRestoreStrategy,
  withRetry,
} from "../backupUtils";

describe("backupUtils", () => {
  describe("toSafeRemoteFilename", () => {
    it("should sanitize unsafe characters", () => {
      expect(toSafeRemoteFilename({ id: "abc", filename: "hello world.fits" })).toBe(
        "abc_hello_world.fits",
      );
    });

    it("should keep safe characters", () => {
      expect(toSafeRemoteFilename({ id: "id1", filename: "file.fits" })).toBe("id1_file.fits");
    });
  });

  describe("toSafeThumbnailFilename", () => {
    it("should append .jpg extension", () => {
      expect(toSafeThumbnailFilename("file123")).toBe("file123.jpg");
    });
  });

  describe("bytesToHex", () => {
    it("should convert ArrayBuffer to hex string", () => {
      const buf = new Uint8Array([0, 1, 15, 16, 255]).buffer;
      expect(bytesToHex(buf)).toBe("00010f10ff");
    });

    it("should return empty string for empty buffer", () => {
      expect(bytesToHex(new ArrayBuffer(0))).toBe("");
    });
  });

  describe("computeSha256Hex", () => {
    it("should return a 64-char hex string", async () => {
      const bytes = new Uint8Array([72, 101, 108, 108, 111]);
      const hash = await computeSha256Hex(bytes);
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe("resolveRestoreStrategy", () => {
    it("should return provided strategy", () => {
      expect(resolveRestoreStrategy("overwrite-existing")).toBe("overwrite-existing");
      expect(resolveRestoreStrategy("merge")).toBe("merge");
    });

    it("should default to skip-existing", () => {
      expect(resolveRestoreStrategy(undefined)).toBe("skip-existing");
    });
  });

  describe("withRetry", () => {
    it("should return result on first success", async () => {
      const fn = jest.fn().mockResolvedValue("ok");
      const result = await withRetry(fn, "test");
      expect(result).toBe("ok");
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("should retry on network error and eventually succeed", async () => {
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error("network error"))
        .mockResolvedValueOnce("ok");
      const result = await withRetry(fn, "test", 3, 1);
      expect(result).toBe("ok");
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it("should retry on timeout error", async () => {
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error("request timeout"))
        .mockResolvedValueOnce("done");
      const result = await withRetry(fn, "test", 3, 1);
      expect(result).toBe("done");
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it("should throw immediately on non-retryable error", async () => {
      const fn = jest.fn().mockRejectedValue(new Error("file not found"));
      await expect(withRetry(fn, "test", 3, 1)).rejects.toThrow("file not found");
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("should throw after max retries on retryable error", async () => {
      const fn = jest.fn().mockRejectedValue(new Error("network error"));
      await expect(withRetry(fn, "test", 2, 1)).rejects.toThrow("network error");
      expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
    });

    it("should retry on failed to fetch error", async () => {
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error("Failed to fetch"))
        .mockResolvedValueOnce("result");
      const result = await withRetry(fn, "test", 3, 1);
      expect(result).toBe("result");
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });
});
