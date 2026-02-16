import {
  DEFAULT_VIEWER_ADJUSTMENTS,
  resolveAdjustmentsFromPreset,
  resolveOverlaysFromPreset,
  resolveResetPreset,
  toViewerPreset,
  type ViewerOverlays,
} from "../model";

describe("viewer preset model", () => {
  const defaultOverlays: ViewerOverlays = {
    showGrid: false,
    showCrosshair: false,
    showPixelInfo: true,
    showMinimap: false,
  };

  it("serializes adjustments and overlays into a preset", () => {
    const preset = toViewerPreset(
      { ...DEFAULT_VIEWER_ADJUSTMENTS, brightness: 0.15, curvePreset: "sCurve" },
      { ...defaultOverlays, showGrid: true },
    );
    expect(preset.version).toBe(1);
    expect(preset.savedAt).toBeGreaterThan(0);
    expect(preset.adjustments.brightness).toBeCloseTo(0.15, 6);
    expect(preset.adjustments.curvePreset).toBe("sCurve");
    expect(preset.overlays.showGrid).toBe(true);
  });

  it("loads adjustments and overlays from preset with default fallback", () => {
    const preset = toViewerPreset(
      { ...DEFAULT_VIEWER_ADJUSTMENTS, contrast: 1.4 },
      { ...defaultOverlays, showCrosshair: true },
    );
    const adjustments = resolveAdjustmentsFromPreset(preset, DEFAULT_VIEWER_ADJUSTMENTS);
    const overlays = resolveOverlaysFromPreset(preset, defaultOverlays);
    expect(adjustments.contrast).toBeCloseTo(1.4, 6);
    expect(overlays.showCrosshair).toBe(true);
  });

  it("resets to file preset first and falls back to global defaults", () => {
    const saved = toViewerPreset(
      { ...DEFAULT_VIEWER_ADJUSTMENTS, mtfMidtone: 0.35 },
      { ...defaultOverlays, showMinimap: true },
    );
    const fromSaved = resolveResetPreset(saved, DEFAULT_VIEWER_ADJUSTMENTS, defaultOverlays);
    expect(fromSaved).toBe(saved);

    const fromDefaults = resolveResetPreset(undefined, DEFAULT_VIEWER_ADJUSTMENTS, defaultOverlays);
    expect(fromDefaults.adjustments).toEqual(DEFAULT_VIEWER_ADJUSTMENTS);
    expect(fromDefaults.overlays).toEqual(defaultOverlays);
  });
});
