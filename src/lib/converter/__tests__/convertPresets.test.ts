import {
  DEFAULT_CONVERT_PRESETS,
  DEFAULT_FITS_TARGET_OPTIONS,
  DEFAULT_XISF_TARGET_OPTIONS,
  DEFAULT_SER_TARGET_OPTIONS,
} from "../../fits/types";
import {
  createPreset,
  getAllPresets,
  getDefaultOptionsForFormat,
  getSupportedBitDepths,
  supportsQuality,
} from "../convertPresets";

describe("convertPresets", () => {
  it("returns built-in presets followed by user presets", () => {
    const userPresets = [
      {
        id: "u1",
        name: "My Preset",
        description: "custom",
        options: DEFAULT_CONVERT_PRESETS[0].options,
      },
    ];

    const all = getAllPresets(userPresets);
    expect(all.slice(0, DEFAULT_CONVERT_PRESETS.length)).toEqual(DEFAULT_CONVERT_PRESETS);
    expect(all[all.length - 1]).toEqual(userPresets[0]);
  });

  it("creates preset with unique id and cloned options", () => {
    jest.spyOn(Date, "now").mockReturnValue(1700000000000);
    jest.spyOn(Math, "random").mockReturnValue(0.123456789);

    const options = { ...DEFAULT_CONVERT_PRESETS[0].options };
    const preset = createPreset("Test", "Desc", options);

    expect(preset.id).toBe("preset_1700000000000_4fzzz");
    expect(preset.name).toBe("Test");
    expect(preset.options).toEqual(options);
    expect(preset.options).not.toBe(options);
  });

  it("returns default options for formats and fallback", () => {
    expect(getDefaultOptionsForFormat("png")).toEqual(
      expect.objectContaining({ quality: 100, bitDepth: 8, dpi: 72 }),
    );
    expect(getDefaultOptionsForFormat("jpeg")).toEqual(
      expect.objectContaining({ quality: 85, bitDepth: 8, dpi: 72 }),
    );
    expect(getDefaultOptionsForFormat("webp")).toEqual(
      expect.objectContaining({ quality: 80, bitDepth: 8, dpi: 72 }),
    );
    expect(getDefaultOptionsForFormat("tiff")).toEqual(
      expect.objectContaining({ quality: 100, bitDepth: 16, dpi: 72 }),
    );
    expect(getDefaultOptionsForFormat("bmp")).toEqual(
      expect.objectContaining({ quality: 100, bitDepth: 8, dpi: 72 }),
    );
    expect(getDefaultOptionsForFormat("fits")).toEqual(
      expect.objectContaining({
        quality: 100,
        bitDepth: 32,
        dpi: 72,
        fits: DEFAULT_FITS_TARGET_OPTIONS,
      }),
    );
    expect(getDefaultOptionsForFormat("xisf")).toEqual(
      expect.objectContaining({
        quality: 100,
        bitDepth: 32,
        dpi: 72,
        xisf: DEFAULT_XISF_TARGET_OPTIONS,
      }),
    );
    expect(getDefaultOptionsForFormat("ser")).toEqual(
      expect.objectContaining({
        quality: 100,
        bitDepth: 16,
        dpi: 72,
        ser: DEFAULT_SER_TARGET_OPTIONS,
      }),
    );
  });

  it("returns supported bit depths by format", () => {
    expect(getSupportedBitDepths("tiff")).toEqual([8, 16, 32]);
    expect(getSupportedBitDepths("png")).toEqual([8, 16]);
    expect(getSupportedBitDepths("fits")).toEqual([8, 16, 32]);
    expect(getSupportedBitDepths("xisf")).toEqual([8, 16, 32]);
    expect(getSupportedBitDepths("ser")).toEqual([8, 16]);
    expect(getSupportedBitDepths("jpeg")).toEqual([8]);
  });

  it("indicates whether quality is supported", () => {
    expect(supportsQuality("jpeg")).toBe(true);
    expect(supportsQuality("webp")).toBe(true);
    expect(supportsQuality("png")).toBe(false);
    expect(supportsQuality("tiff")).toBe(false);
    expect(supportsQuality("xisf")).toBe(false);
    expect(supportsQuality("ser")).toBe(false);
  });

  it("includes compression-oriented presets with outputSize", () => {
    const socialPreset = DEFAULT_CONVERT_PRESETS.find((p) => p.id === "social");
    expect(socialPreset).toBeDefined();
    expect(socialPreset!.options.format).toBe("jpeg");
    expect(socialPreset!.options.quality).toBe(85);
    expect(socialPreset!.options.outputSize).toEqual({ maxWidth: 1920, maxHeight: 1920 });

    const emailPreset = DEFAULT_CONVERT_PRESETS.find((p) => p.id === "email");
    expect(emailPreset).toBeDefined();
    expect(emailPreset!.options.format).toBe("jpeg");
    expect(emailPreset!.options.quality).toBe(75);
    expect(emailPreset!.options.outputSize).toEqual({ maxWidth: 1280, maxHeight: 1280 });

    const webOptPreset = DEFAULT_CONVERT_PRESETS.find((p) => p.id === "webOptimized");
    expect(webOptPreset).toBeDefined();
    expect(webOptPreset!.options.format).toBe("webp");
    expect(webOptPreset!.options.quality).toBe(80);
    expect(webOptPreset!.options.outputSize).toEqual({ maxWidth: 2048, maxHeight: 2048 });

    const thumbPreset = DEFAULT_CONVERT_PRESETS.find((p) => p.id === "thumbnailExport");
    expect(thumbPreset).toBeDefined();
    expect(thumbPreset!.options.format).toBe("jpeg");
    expect(thumbPreset!.options.quality).toBe(70);
    expect(thumbPreset!.options.outputSize).toEqual({ maxWidth: 512, maxHeight: 512 });
  });

  it("has 7 built-in presets total (3 original + 4 new)", () => {
    expect(DEFAULT_CONVERT_PRESETS.length).toBe(7);
  });

  it("all presets have unique ids", () => {
    const ids = DEFAULT_CONVERT_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
