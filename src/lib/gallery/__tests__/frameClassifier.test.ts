import {
  classifyByHeader,
  classifyByFilename,
  classifyFrameType,
  classifyWithDetail,
  sanitizeFrameClassificationConfig,
} from "../frameClassifier";

describe("frameClassifier", () => {
  // ===== classifyByHeader =====

  describe("classifyByHeader", () => {
    it("returns null for undefined input", () => {
      expect(classifyByHeader(undefined)).toBeNull();
    });

    it("returns null for empty string", () => {
      expect(classifyByHeader("")).toBeNull();
    });

    it("recognizes standard IMAGETYP values (case-insensitive)", () => {
      expect(classifyByHeader("Light")).toBe("light");
      expect(classifyByHeader("LIGHT")).toBe("light");
      expect(classifyByHeader("light")).toBe("light");
      expect(classifyByHeader("Dark")).toBe("dark");
      expect(classifyByHeader("DARK")).toBe("dark");
      expect(classifyByHeader("Flat")).toBe("flat");
      expect(classifyByHeader("FLAT")).toBe("flat");
      expect(classifyByHeader("Bias")).toBe("bias");
      expect(classifyByHeader("BIAS")).toBe("bias");
      expect(classifyByHeader("DarkFlat")).toBe("darkflat");
    });

    it("recognizes extended IMAGETYP values", () => {
      expect(classifyByHeader("Light Frame")).toBe("light");
      expect(classifyByHeader("Dark Frame")).toBe("dark");
      expect(classifyByHeader("Flat Field")).toBe("flat");
      expect(classifyByHeader("Bias Frame")).toBe("bias");
      expect(classifyByHeader("Science")).toBe("light");
      expect(classifyByHeader("Object")).toBe("light");
      expect(classifyByHeader("Offset")).toBe("bias");
      expect(classifyByHeader("Zero")).toBe("bias");
    });

    it("recognizes flat variants", () => {
      expect(classifyByHeader("SkyFlat")).toBe("flat");
      expect(classifyByHeader("Sky Flat")).toBe("flat");
      expect(classifyByHeader("DomeFlat")).toBe("flat");
      expect(classifyByHeader("Dome Flat")).toBe("flat");
      expect(classifyByHeader("Twilight Flat")).toBe("flat");
    });

    it("trims whitespace", () => {
      expect(classifyByHeader("  Light  ")).toBe("light");
      expect(classifyByHeader("  Dark Frame  ")).toBe("dark");
    });

    it("returns null for unknown values", () => {
      expect(classifyByHeader("Unknown")).toBeNull();
      expect(classifyByHeader("Calibration")).toBeNull();
      expect(classifyByHeader("Master Dark")).toBe("dark");
    });
  });

  // ===== classifyByFilename =====

  describe("classifyByFilename", () => {
    it("detects light frames from filename", () => {
      expect(classifyByFilename("Light_M42_001.fits")).toBe("light");
      expect(classifyByFilename("M42_light_300s.fits")).toBe("light");
    });

    it("detects dark frames from filename", () => {
      expect(classifyByFilename("Dark_300s_001.fits")).toBe("dark");
      expect(classifyByFilename("master_dark_120s.fits")).toBe("dark");
    });

    it("detects flat frames from filename", () => {
      expect(classifyByFilename("Flat_Ha_001.fits")).toBe("flat");
      expect(classifyByFilename("skyflat_dusk.fits")).toBe("flat");
    });

    it("detects bias frames from filename", () => {
      expect(classifyByFilename("Bias_001.fits")).toBe("bias");
      expect(classifyByFilename("offset_frame_001.fits")).toBe("bias");
      expect(classifyByFilename("zero_001.fits")).toBe("bias");
    });

    it("returns null for unrecognizable filenames", () => {
      expect(classifyByFilename("IMG_0001.fits")).toBeNull();
      expect(classifyByFilename("capture_001.fits")).toBeNull();
      expect(classifyByFilename("M42_Ha_300s_001.fits")).toBeNull();
    });

    it("matches whole words only (no false positives)", () => {
      // "darken" should not match "dark"
      expect(classifyByFilename("darken_image.fits")).toBeNull();
      // "flatten" should not match "flat"
      expect(classifyByFilename("flatten_result.fits")).toBeNull();
    });

    it("prefers darkflat patterns before dark/flat", () => {
      expect(classifyByFilename("master_darkflat_001.fit")).toBe("darkflat");
      expect(classifyByFilename("flatdark_l_001.fit")).toBe("darkflat");
    });
  });

  // ===== classifyFrameType =====

  describe("classifyFrameType", () => {
    it("prefers IMAGETYP header over FRAME header", () => {
      expect(classifyFrameType("Light", "Dark", "bias_001.fits")).toBe("light");
    });

    it("falls back to FRAME header when IMAGETYP is undefined", () => {
      expect(classifyFrameType(undefined, "Flat", "bias_001.fits")).toBe("flat");
    });

    it("falls back to filename when both headers are undefined", () => {
      expect(classifyFrameType(undefined, undefined, "dark_300s_001.fits")).toBe("dark");
    });

    it("returns 'unknown' when nothing matches", () => {
      expect(classifyFrameType(undefined, undefined, "IMG_0001.fits")).toBe("unknown");
    });

    it("falls back to filename when headers have unknown values", () => {
      expect(classifyFrameType("RandomType", "OtherType", "flat_ha_001.fits")).toBe("flat");
    });
  });

  describe("classifyWithDetail custom rules", () => {
    const config = sanitizeFrameClassificationConfig({
      frameTypes: [
        { key: "light", label: "Light", builtin: true },
        { key: "dark", label: "Dark", builtin: true },
        { key: "flat", label: "Flat", builtin: true },
        { key: "bias", label: "Bias", builtin: true },
        { key: "darkflat", label: "Dark Flat", builtin: true },
        { key: "unknown", label: "Unknown", builtin: true },
        { key: "focus", label: "Focus", builtin: false },
      ],
      rules: [
        {
          id: "disabled-rule",
          enabled: false,
          priority: 1000,
          target: "filename",
          matchType: "contains",
          pattern: "focus",
          frameType: "focus",
        },
        {
          id: "header-exact",
          enabled: true,
          priority: 100,
          target: "header",
          headerField: "IMAGETYP",
          matchType: "exact",
          pattern: "Focus",
          frameType: "focus",
        },
        {
          id: "filename-regex",
          enabled: true,
          priority: 80,
          target: "filename",
          matchType: "regex",
          pattern: "(^|[_-])focus([_-]|$)",
          frameType: "focus",
        },
        {
          id: "filename-contains",
          enabled: true,
          priority: 10,
          target: "filename",
          matchType: "contains",
          pattern: "object",
          frameType: "light",
        },
      ],
    });

    it("applies custom header exact rule with highest priority", () => {
      const result = classifyWithDetail("Focus", undefined, "light_object_001.fit", config);
      expect(result).toEqual({
        type: "focus",
        source: "rule",
        matchedRuleId: "header-exact",
      });
    });

    it("applies custom filename regex rule", () => {
      const result = classifyWithDetail(undefined, undefined, "m42_focus_001.fit", config);
      expect(result).toEqual({
        type: "focus",
        source: "rule",
        matchedRuleId: "filename-regex",
      });
    });

    it("ignores disabled rules", () => {
      const result = classifyWithDetail(undefined, undefined, "myfocusfile.fit", config);
      expect(result.type).not.toBe("focus");
    });

    it("falls back to built-in header aliases when no custom rule matched", () => {
      const result = classifyWithDetail("Master Dark Flat", undefined, "x.fit", config);
      expect(result).toEqual({
        type: "darkflat",
        source: "header",
      });
    });

    it("falls back to filename and marks source", () => {
      const result = classifyWithDetail(undefined, undefined, "master_bias_001.fit", config);
      expect(result).toEqual({
        type: "bias",
        source: "filename",
      });
    });

    it("supports case-sensitive exact matching", () => {
      const caseSensitiveConfig = sanitizeFrameClassificationConfig({
        frameTypes: [
          { key: "light", label: "Light", builtin: true },
          { key: "dark", label: "Dark", builtin: true },
          { key: "flat", label: "Flat", builtin: true },
          { key: "bias", label: "Bias", builtin: true },
          { key: "darkflat", label: "Dark Flat", builtin: true },
          { key: "unknown", label: "Unknown", builtin: true },
          { key: "focus", label: "Focus", builtin: false },
        ],
        rules: [
          {
            id: "case-sensitive-header",
            enabled: true,
            priority: 100,
            target: "header",
            headerField: "IMAGETYP",
            matchType: "exact",
            pattern: "Focus",
            caseSensitive: true,
            frameType: "focus",
          },
        ],
      });

      expect(classifyWithDetail("Focus", undefined, "x.fit", caseSensitiveConfig)).toEqual({
        type: "focus",
        source: "rule",
        matchedRuleId: "case-sensitive-header",
      });
      expect(classifyWithDetail("focus", undefined, "x.fit", caseSensitiveConfig)).toEqual({
        type: "unknown",
        source: "fallback",
      });
    });

    it("ignores invalid regex rules and continues fallback classification", () => {
      const invalidRegexConfig = sanitizeFrameClassificationConfig({
        frameTypes: [
          { key: "light", label: "Light", builtin: true },
          { key: "dark", label: "Dark", builtin: true },
          { key: "flat", label: "Flat", builtin: true },
          { key: "bias", label: "Bias", builtin: true },
          { key: "darkflat", label: "Dark Flat", builtin: true },
          { key: "unknown", label: "Unknown", builtin: true },
          { key: "focus", label: "Focus", builtin: false },
        ],
        rules: [
          {
            id: "invalid-regex",
            enabled: true,
            priority: 100,
            target: "filename",
            matchType: "regex",
            pattern: "([",
            frameType: "focus",
          },
        ],
      });

      expect(
        classifyWithDetail(undefined, undefined, "master_darkflat_001.fit", invalidRegexConfig),
      ).toEqual({
        type: "darkflat",
        source: "filename",
      });
    });
  });

  describe("sanitizeFrameClassificationConfig", () => {
    it("uses fallback when value is invalid", () => {
      const fallback = sanitizeFrameClassificationConfig({
        frameTypes: [{ key: "focus", label: "Focus", builtin: false }],
        rules: [],
      });
      const result = sanitizeFrameClassificationConfig(null, fallback);
      expect(result.frameTypes.some((item) => item.key === "focus")).toBe(true);
      expect(result.frameTypes.some((item) => item.key === "darkflat")).toBe(true);
    });
  });

  describe("fallback type resolution", () => {
    it("always falls back to unknown because sanitization injects unknown type", () => {
      const configWithoutUnknown = sanitizeFrameClassificationConfig({
        frameTypes: [{ key: "focus", label: "Focus", builtin: false }],
        rules: [],
      });
      const result = classifyWithDetail(undefined, undefined, "no_match_filename.fit", {
        frameTypes: configWithoutUnknown.frameTypes.filter((item) => item.key !== "unknown"),
        rules: [],
      });
      expect(result).toEqual({ type: "unknown", source: "fallback" });
    });
  });
});
