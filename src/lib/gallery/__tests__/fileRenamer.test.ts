import {
  generateFilename,
  previewRenames,
  getTemplateVariables,
  DEFAULT_TEMPLATE,
} from "../fileRenamer";
import type { FitsMetadata } from "../../fits/types";

const makeFile = (overrides: Partial<FitsMetadata> = {}): FitsMetadata =>
  ({
    id: `file-${Math.random().toString(36).slice(2, 8)}`,
    filename: "IMG_0001.fits",
    filepath: "/path/IMG_0001.fits",
    fileSize: 1024,
    importDate: Date.now(),
    frameType: "light",
    isFavorite: false,
    tags: [],
    albumIds: [],
    object: "M42",
    dateObs: "2024-01-15T22:30:00Z",
    exptime: 300,
    filter: "Ha",
    instrument: "ASI294MM",
    telescope: "RC8",
    gain: 100,
    ...overrides,
  }) as FitsMetadata;

describe("fileRenamer", () => {
  // ===== generateFilename =====

  describe("generateFilename", () => {
    it("replaces {object} variable", () => {
      const result = generateFilename(makeFile(), "{object}", 0);
      expect(result).toBe("M42.fits");
    });

    it("replaces {filter} variable", () => {
      const result = generateFilename(makeFile(), "{filter}", 0);
      expect(result).toBe("Ha.fits");
    });

    it("replaces {exptime} variable", () => {
      const result = generateFilename(makeFile(), "{exptime}s", 0);
      expect(result).toBe("300s.fits");
    });

    it("replaces {date} variable", () => {
      const result = generateFilename(makeFile(), "{date}", 0);
      expect(result).toBe("2024-01-15.fits");
    });

    it("replaces {time} variable", () => {
      const result = generateFilename(makeFile(), "{time}", 0);
      expect(result).toBe("22-30-00.fits");
    });

    it("replaces {frameType} variable", () => {
      const result = generateFilename(makeFile({ frameType: "dark" }), "{frameType}", 0);
      expect(result).toBe("dark.fits");
    });

    it("replaces {telescope} variable", () => {
      const result = generateFilename(makeFile(), "{telescope}", 0);
      expect(result).toBe("RC8.fits");
    });

    it("replaces {camera} variable (from instrument)", () => {
      const result = generateFilename(makeFile(), "{camera}", 0);
      expect(result).toBe("ASI294MM.fits");
    });

    it("replaces {gain} variable", () => {
      const result = generateFilename(makeFile(), "{gain}", 0);
      expect(result).toBe("100.fits");
    });

    it("replaces {seq} with zero-padded index", () => {
      const result = generateFilename(makeFile(), "{seq}", 0, 3);
      expect(result).toBe("001.fits");
      const result5 = generateFilename(makeFile(), "{seq}", 4, 3);
      expect(result5).toBe("005.fits");
    });

    it("replaces {original} with original filename stem", () => {
      const result = generateFilename(
        makeFile({ filename: "MyCapture_001.fits" }),
        "{original}",
        0,
      );
      expect(result).toBe("MyCapture_001.fits");
    });

    it("handles multiple variables in a template", () => {
      const result = generateFilename(makeFile(), "{object}_{filter}_{exptime}s_{seq}", 2, 3);
      expect(result).toBe("M42_Ha_300s_003.fits");
    });

    it("uses 'unknown' for missing object", () => {
      const result = generateFilename(makeFile({ object: undefined }), "{object}", 0);
      expect(result).toBe("unknown.fits");
    });

    it("uses 'nofilter' for missing filter", () => {
      const result = generateFilename(makeFile({ filter: undefined }), "{filter}", 0);
      expect(result).toBe("nofilter.fits");
    });

    it("preserves the original file extension", () => {
      const result = generateFilename(makeFile({ filename: "test.fit" }), "{object}", 0);
      expect(result).toBe("M42.fit");
    });

    it("sanitizes illegal characters in object name", () => {
      const result = generateFilename(makeFile({ object: "NGC 7000/IC 5070" }), "{object}", 0);
      expect(result).not.toContain("/");
    });

    it("is case-insensitive for variable placeholders", () => {
      const result = generateFilename(makeFile(), "{OBJECT}_{Filter}", 0);
      expect(result).toBe("M42_Ha.fits");
    });
  });

  // ===== previewRenames =====

  describe("previewRenames", () => {
    it("returns preview for each file", () => {
      const files = [
        makeFile({ id: "f1", filename: "a.fits", object: "M42" }),
        makeFile({ id: "f2", filename: "b.fits", object: "M31" }),
      ];
      const previews = previewRenames(files, "{object}_{seq}");
      expect(previews).toHaveLength(2);
      expect(previews[0].oldName).toBe("a.fits");
      expect(previews[0].newName).toBe("M42_001.fits");
      expect(previews[1].oldName).toBe("b.fits");
      expect(previews[1].newName).toBe("M31_002.fits");
    });

    it("returns empty array for empty input", () => {
      expect(previewRenames([], "{object}")).toEqual([]);
    });
  });

  // ===== getTemplateVariables =====

  describe("getTemplateVariables", () => {
    it("returns all expected variables", () => {
      const vars = getTemplateVariables();
      expect(vars.length).toBeGreaterThanOrEqual(10);
      const keys = vars.map((v) => v.key);
      expect(keys).toContain("{object}");
      expect(keys).toContain("{date}");
      expect(keys).toContain("{filter}");
      expect(keys).toContain("{exptime}");
      expect(keys).toContain("{frameType}");
      expect(keys).toContain("{seq}");
      expect(keys).toContain("{original}");
    });
  });

  // ===== DEFAULT_TEMPLATE =====

  describe("DEFAULT_TEMPLATE", () => {
    it("is a non-empty string", () => {
      expect(DEFAULT_TEMPLATE).toBeTruthy();
      expect(typeof DEFAULT_TEMPLATE).toBe("string");
    });
  });
});
