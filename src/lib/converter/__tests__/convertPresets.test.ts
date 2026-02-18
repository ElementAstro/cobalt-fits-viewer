import { DEFAULT_CONVERT_PRESETS, DEFAULT_FITS_TARGET_OPTIONS } from "../../fits/types";
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
  });

  it("returns supported bit depths by format", () => {
    expect(getSupportedBitDepths("tiff")).toEqual([8, 16, 32]);
    expect(getSupportedBitDepths("png")).toEqual([8, 16]);
    expect(getSupportedBitDepths("fits")).toEqual([8, 16, 32]);
    expect(getSupportedBitDepths("jpeg")).toEqual([8]);
  });

  it("indicates whether quality is supported", () => {
    expect(supportsQuality("jpeg")).toBe(true);
    expect(supportsQuality("webp")).toBe(true);
    expect(supportsQuality("png")).toBe(false);
    expect(supportsQuality("tiff")).toBe(false);
  });
});
