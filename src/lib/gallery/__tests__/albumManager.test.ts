import { createAlbum, evaluateSmartRules, suggestSmartAlbums } from "../albumManager";
import type { FitsMetadata, SmartAlbumRule } from "../../fits/types";

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
    object: "M42",
    filter: "Ha",
    exptime: 300,
    ...overrides,
  }) as FitsMetadata;

describe("albumManager", () => {
  // ===== createAlbum =====

  describe("createAlbum", () => {
    it("creates a basic album", () => {
      const album = createAlbum("My Album", "description");
      expect(album.name).toBe("My Album");
      expect(album.description).toBe("description");
      expect(album.isSmart).toBe(false);
      expect(album.imageIds).toEqual([]);
      expect(album.id).toBeTruthy();
    });

    it("creates a smart album with rules", () => {
      const rules: SmartAlbumRule[] = [{ field: "object", operator: "equals", value: "M42" }];
      const album = createAlbum("M42 Smart", undefined, true, rules);
      expect(album.isSmart).toBe(true);
      expect(album.smartRules).toEqual(rules);
    });
  });

  // ===== evaluateSmartRules =====

  describe("evaluateSmartRules", () => {
    it("returns matching files for equals operator", () => {
      const rules: SmartAlbumRule[] = [{ field: "object", operator: "equals", value: "M42" }];
      const files = [makeFile({ id: "f1", object: "M42" }), makeFile({ id: "f2", object: "M31" })];
      const result = evaluateSmartRules(rules, files);
      expect(result).toEqual(["f1"]);
    });

    it("returns matching files for contains operator", () => {
      const rules: SmartAlbumRule[] = [{ field: "object", operator: "contains", value: "NGC" }];
      const files = [
        makeFile({ id: "f1", object: "NGC 7000" }),
        makeFile({ id: "f2", object: "M42" }),
      ];
      expect(evaluateSmartRules(rules, files)).toEqual(["f1"]);
    });

    it("returns matching files for gt operator", () => {
      const rules: SmartAlbumRule[] = [{ field: "exptime", operator: "gt", value: 200 }];
      const files = [makeFile({ id: "f1", exptime: 300 }), makeFile({ id: "f2", exptime: 100 })];
      expect(evaluateSmartRules(rules, files)).toEqual(["f1"]);
    });

    it("returns matching files for lt operator", () => {
      const rules: SmartAlbumRule[] = [{ field: "exptime", operator: "lt", value: 200 }];
      const files = [makeFile({ id: "f1", exptime: 300 }), makeFile({ id: "f2", exptime: 100 })];
      expect(evaluateSmartRules(rules, files)).toEqual(["f2"]);
    });

    it("returns matching files for between operator", () => {
      const rules: SmartAlbumRule[] = [
        { field: "exptime", operator: "between", value: [100, 300] },
      ];
      const files = [
        makeFile({ id: "f1", exptime: 200 }),
        makeFile({ id: "f2", exptime: 500 }),
        makeFile({ id: "f3", exptime: 100 }),
      ];
      expect(evaluateSmartRules(rules, files)).toEqual(["f1", "f3"]);
    });

    it("returns matching files for in operator", () => {
      const rules: SmartAlbumRule[] = [{ field: "filter", operator: "in", value: ["Ha", "OIII"] }];
      const files = [
        makeFile({ id: "f1", filter: "Ha" }),
        makeFile({ id: "f2", filter: "L" }),
        makeFile({ id: "f3", filter: "OIII" }),
      ];
      expect(evaluateSmartRules(rules, files)).toEqual(["f1", "f3"]);
    });

    it("supports frameType field in rules", () => {
      const rules: SmartAlbumRule[] = [{ field: "frameType", operator: "equals", value: "dark" }];
      const files = [
        makeFile({ id: "f1", frameType: "light" }),
        makeFile({ id: "f2", frameType: "dark" }),
        makeFile({ id: "f3", frameType: "flat" }),
      ];
      expect(evaluateSmartRules(rules, files)).toEqual(["f2"]);
    });

    it("supports frameType with in operator", () => {
      const rules: SmartAlbumRule[] = [
        { field: "frameType", operator: "in", value: ["dark", "bias"] },
      ];
      const files = [
        makeFile({ id: "f1", frameType: "light" }),
        makeFile({ id: "f2", frameType: "dark" }),
        makeFile({ id: "f3", frameType: "bias" }),
      ];
      expect(evaluateSmartRules(rules, files)).toEqual(["f2", "f3"]);
    });

    it("applies AND logic across multiple rules", () => {
      const rules: SmartAlbumRule[] = [
        { field: "object", operator: "equals", value: "M42" },
        { field: "filter", operator: "equals", value: "Ha" },
      ];
      const files = [
        makeFile({ id: "f1", object: "M42", filter: "Ha" }),
        makeFile({ id: "f2", object: "M42", filter: "OIII" }),
        makeFile({ id: "f3", object: "M31", filter: "Ha" }),
      ];
      expect(evaluateSmartRules(rules, files)).toEqual(["f1"]);
    });

    it("excludes files with undefined field values", () => {
      const rules: SmartAlbumRule[] = [{ field: "object", operator: "equals", value: "M42" }];
      const files = [
        makeFile({ id: "f1", object: undefined }),
        makeFile({ id: "f2", object: "M42" }),
      ];
      expect(evaluateSmartRules(rules, files)).toEqual(["f2"]);
    });

    it("returns empty for no matching files", () => {
      const rules: SmartAlbumRule[] = [
        { field: "object", operator: "equals", value: "Nonexistent" },
      ];
      const files = [makeFile({ id: "f1", object: "M42" })];
      expect(evaluateSmartRules(rules, files)).toEqual([]);
    });
  });

  // ===== suggestSmartAlbums =====

  describe("suggestSmartAlbums", () => {
    it("suggests albums by object", () => {
      const files = [makeFile({ object: "M42" }), makeFile({ object: "M31" })];
      const suggestions = suggestSmartAlbums(files);
      const names = suggestions.map((s) => s.name);
      expect(names).toContain("M42");
      expect(names).toContain("M31");
    });

    it("suggests albums by filter", () => {
      const files = [makeFile({ filter: "Ha" }), makeFile({ filter: "OIII" })];
      const suggestions = suggestSmartAlbums(files);
      const names = suggestions.map((s) => s.name);
      expect(names).toContain("Filter: Ha");
      expect(names).toContain("Filter: OIII");
    });

    it("suggests favorites album when favorites exist", () => {
      const files = [makeFile({ isFavorite: true })];
      const suggestions = suggestSmartAlbums(files);
      const names = suggestions.map((s) => s.name);
      expect(names).toContain("Favorites");
    });

    it("does not suggest favorites when none exist", () => {
      const files = [makeFile({ isFavorite: false })];
      const suggestions = suggestSmartAlbums(files);
      const names = suggestions.map((s) => s.name);
      expect(names).not.toContain("Favorites");
    });

    it("returns empty for no files", () => {
      expect(suggestSmartAlbums([])).toEqual([]);
    });
  });
});
