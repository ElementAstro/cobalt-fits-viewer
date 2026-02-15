import {
  computeQuickHash,
  findDuplicateOnImport,
  findDuplicateGroups,
  getDuplicateStats,
} from "../duplicateDetector";
import type { FitsMetadata } from "../../fits/types";

const makeFile = (overrides: Partial<FitsMetadata> = {}): FitsMetadata =>
  ({
    id: `file-${Math.random().toString(36).slice(2, 8)}`,
    filename: "test.fits",
    filepath: "/path/test.fits",
    fileSize: 1024,
    importDate: Date.now(),
    frameType: "light",
    isFavorite: false,
    tags: [],
    albumIds: [],
    ...overrides,
  }) as FitsMetadata;

describe("duplicateDetector", () => {
  // ===== computeQuickHash =====

  describe("computeQuickHash", () => {
    it("produces a non-empty string", () => {
      const buffer = new ArrayBuffer(100);
      const view = new Uint8Array(buffer);
      for (let i = 0; i < view.length; i++) view[i] = i;
      const hash = computeQuickHash(buffer, 100);
      expect(hash).toBeTruthy();
      expect(typeof hash).toBe("string");
    });

    it("produces consistent results for same input", () => {
      const buffer = new ArrayBuffer(256);
      new Uint8Array(buffer).fill(42);
      const hash1 = computeQuickHash(buffer, 256);
      const hash2 = computeQuickHash(buffer, 256);
      expect(hash1).toBe(hash2);
    });

    it("produces different hashes for different content", () => {
      const buf1 = new ArrayBuffer(100);
      new Uint8Array(buf1).fill(1);
      const buf2 = new ArrayBuffer(100);
      new Uint8Array(buf2).fill(2);
      expect(computeQuickHash(buf1, 100)).not.toBe(computeQuickHash(buf2, 100));
    });

    it("produces different hashes for same content but different file sizes", () => {
      const buf = new ArrayBuffer(100);
      new Uint8Array(buf).fill(7);
      const hash1 = computeQuickHash(buf, 100);
      const hash2 = computeQuickHash(buf, 200);
      expect(hash1).not.toBe(hash2);
    });

    it("handles empty buffer", () => {
      const buffer = new ArrayBuffer(0);
      const hash = computeQuickHash(buffer, 0);
      expect(hash).toBeTruthy();
    });
  });

  // ===== findDuplicateOnImport =====

  describe("findDuplicateOnImport", () => {
    it("returns null when no files have matching hash", () => {
      const files = [makeFile({ id: "f1", hash: "abc_1024" })];
      expect(findDuplicateOnImport("xyz_2048", files)).toBeNull();
    });

    it("returns the matching file when hash matches", () => {
      const files = [
        makeFile({ id: "f1", hash: "abc_1024" }),
        makeFile({ id: "f2", hash: "def_2048" }),
      ];
      const result = findDuplicateOnImport("def_2048", files);
      expect(result).not.toBeNull();
      expect(result!.id).toBe("f2");
    });

    it("returns null when existing files have no hash", () => {
      const files = [makeFile({ id: "f1" })];
      expect(findDuplicateOnImport("abc_1024", files)).toBeNull();
    });
  });

  // ===== findDuplicateGroups =====

  describe("findDuplicateGroups", () => {
    it("returns empty map when no duplicates", () => {
      const files = [makeFile({ id: "f1", hash: "a_100" }), makeFile({ id: "f2", hash: "b_200" })];
      const groups = findDuplicateGroups(files);
      expect(groups.size).toBe(0);
    });

    it("groups files with same hash", () => {
      const files = [
        makeFile({ id: "f1", hash: "a_100" }),
        makeFile({ id: "f2", hash: "a_100" }),
        makeFile({ id: "f3", hash: "b_200" }),
      ];
      const groups = findDuplicateGroups(files);
      expect(groups.size).toBe(1);
      expect(groups.get("a_100")).toHaveLength(2);
    });

    it("ignores files without hash", () => {
      const files = [makeFile({ id: "f1" }), makeFile({ id: "f2" })];
      const groups = findDuplicateGroups(files);
      expect(groups.size).toBe(0);
    });

    it("handles multiple duplicate groups", () => {
      const files = [
        makeFile({ id: "f1", hash: "a_100" }),
        makeFile({ id: "f2", hash: "a_100" }),
        makeFile({ id: "f3", hash: "b_200" }),
        makeFile({ id: "f4", hash: "b_200" }),
        makeFile({ id: "f5", hash: "b_200" }),
        makeFile({ id: "f6", hash: "c_300" }),
      ];
      const groups = findDuplicateGroups(files);
      expect(groups.size).toBe(2);
      expect(groups.get("a_100")).toHaveLength(2);
      expect(groups.get("b_200")).toHaveLength(3);
    });
  });

  // ===== getDuplicateStats =====

  describe("getDuplicateStats", () => {
    it("returns zeroes for no duplicates", () => {
      const files = [makeFile({ id: "f1", hash: "a_100" })];
      const stats = getDuplicateStats(files);
      expect(stats.duplicateGroups).toBe(0);
      expect(stats.duplicateFiles).toBe(0);
      expect(stats.wastedBytes).toBe(0);
    });

    it("calculates correct stats", () => {
      const files = [
        makeFile({ id: "f1", hash: "a_100", fileSize: 5000 }),
        makeFile({ id: "f2", hash: "a_100", fileSize: 5000 }),
        makeFile({ id: "f3", hash: "a_100", fileSize: 5000 }),
        makeFile({ id: "f4", hash: "b_200", fileSize: 3000 }),
        makeFile({ id: "f5", hash: "b_200", fileSize: 3000 }),
      ];
      const stats = getDuplicateStats(files);
      expect(stats.duplicateGroups).toBe(2);
      expect(stats.duplicateFiles).toBe(3); // 2 extra in group a + 1 extra in group b
      expect(stats.wastedBytes).toBe(2 * 5000 + 1 * 3000); // 13000
    });
  });
});
