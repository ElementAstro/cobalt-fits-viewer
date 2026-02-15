import { classifyByHeader, classifyByFilename, classifyFrameType } from "../frameClassifier";

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
      expect(classifyByHeader("Master Dark")).toBeNull();
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
});
