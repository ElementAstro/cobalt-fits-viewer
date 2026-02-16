import type { ColormapType, StretchType, ViewerCurvePreset, ViewerPreset } from "../fits/types";

export interface ViewerAdjustments {
  stretch: StretchType;
  colormap: ColormapType;
  blackPoint: number;
  whitePoint: number;
  gamma: number;
  midtone: number;
  outputBlack: number;
  outputWhite: number;
  brightness: number;
  contrast: number;
  mtfMidtone: number;
  curvePreset: ViewerCurvePreset;
}

export interface ViewerOverlays {
  showGrid: boolean;
  showCrosshair: boolean;
  showPixelInfo: boolean;
  showMinimap: boolean;
}

export const DEFAULT_VIEWER_ADJUSTMENTS: ViewerAdjustments = {
  stretch: "asinh",
  colormap: "grayscale",
  blackPoint: 0,
  whitePoint: 1,
  gamma: 1,
  midtone: 0.5,
  outputBlack: 0,
  outputWhite: 1,
  brightness: 0,
  contrast: 1,
  mtfMidtone: 0.5,
  curvePreset: "linear",
};

export function toViewerPreset(
  adjustments: ViewerAdjustments,
  overlays: ViewerOverlays,
): ViewerPreset {
  return {
    version: 1,
    savedAt: Date.now(),
    adjustments,
    overlays,
  };
}

export function resolveAdjustmentsFromPreset(
  preset: ViewerPreset | undefined,
  defaults: ViewerAdjustments,
): ViewerAdjustments {
  if (!preset) return defaults;
  return { ...defaults, ...preset.adjustments };
}

export function resolveOverlaysFromPreset(
  preset: ViewerPreset | undefined,
  defaults: ViewerOverlays,
): ViewerOverlays {
  if (!preset) return defaults;
  return { ...defaults, ...preset.overlays };
}

export function resolveResetPreset(
  preset: ViewerPreset | undefined,
  defaultAdjustments: ViewerAdjustments,
  defaultOverlays: ViewerOverlays,
): ViewerPreset {
  return preset ?? toViewerPreset(defaultAdjustments, defaultOverlays);
}
