import type { ViewerCurvePreset } from "../fits/types";

export const VIEWER_CURVE_PRESETS: Array<{
  key: ViewerCurvePreset;
  labelKey: string;
}> = [
  { key: "linear", labelKey: "viewer.curveLinear" },
  { key: "sCurve", labelKey: "viewer.curveSCurve" },
  { key: "brighten", labelKey: "viewer.curveBrighten" },
  { key: "darken", labelKey: "viewer.curveDarken" },
  { key: "highContrast", labelKey: "viewer.curveHighContrast" },
];
