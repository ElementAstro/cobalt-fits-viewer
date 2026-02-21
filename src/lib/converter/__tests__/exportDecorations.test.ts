import { applyExportDecorations } from "../exportDecorations";
import type { AstrometryAnnotation } from "../../astrometry/types";
import type { StarAnnotationPoint } from "../../fits/types";

function makeOpaqueRgba(width: number, height: number): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < rgba.length; i += 4) {
    rgba[i] = 0;
    rgba[i + 1] = 0;
    rgba[i + 2] = 0;
    rgba[i + 3] = 255;
  }
  return rgba;
}

function hasDiff(a: Uint8ClampedArray, b: Uint8ClampedArray): boolean {
  if (a.length !== b.length) return true;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return true;
  }
  return false;
}

describe("exportDecorations", () => {
  it("warns when annotations are requested but none are available", () => {
    const rgba = makeOpaqueRgba(32, 24);

    const result = applyExportDecorations({
      rgbaData: rgba,
      width: 32,
      height: 24,
      filename: "x.fits",
      format: "png",
      options: { includeAnnotations: true },
      source: { starAnnotations: [], astrometryAnnotations: [] },
    });

    expect(result.annotationsDrawn).toBe(0);
    expect(result.warnings).toContain("No annotations available for export.");
  });

  it("counts star + astrometry annotations and produces a decorated image", () => {
    const rgba = makeOpaqueRgba(64, 40);

    const stars: StarAnnotationPoint[] = [
      { id: "s1", x: 10, y: 12, enabled: true, source: "manual", anchorIndex: 1 },
    ];
    const astrometry: AstrometryAnnotation[] = [
      { type: "ngc", names: ["NGC 1976"], pixelx: 30, pixely: 18, radius: 6 },
    ];

    const result = applyExportDecorations({
      rgbaData: rgba,
      width: 64,
      height: 40,
      filename: "m42.fits",
      format: "png",
      options: { includeAnnotations: true },
      source: { starAnnotations: stars, astrometryAnnotations: astrometry },
    });

    expect(result.annotationsDrawn).toBe(2);
    expect(result.warnings).toEqual([]);
    expect(hasDiff(result.rgbaData, rgba)).toBe(true);
  });

  it("applies watermark (default text path) when includeWatermark is enabled", () => {
    const rgba = makeOpaqueRgba(80, 40);

    const result = applyExportDecorations({
      rgbaData: rgba,
      width: 80,
      height: 40,
      filename: "m42.fits",
      format: "png",
      options: { includeWatermark: true, watermarkText: "   " },
    });

    expect(result.watermarkApplied).toBe(true);
    expect(hasDiff(result.rgbaData, rgba)).toBe(true);
  });

  it("applies watermark and tolerates long custom watermark text", () => {
    const rgba = makeOpaqueRgba(120, 60);
    const long = "x".repeat(500);

    const result = applyExportDecorations({
      rgbaData: rgba,
      width: 120,
      height: 60,
      filename: "m42.fits",
      format: "png",
      options: { includeWatermark: true, watermarkText: long },
    });

    expect(result.watermarkApplied).toBe(true);
    expect(result.warnings).toEqual([]);
    expect(hasDiff(result.rgbaData, rgba)).toBe(true);
  });
});
