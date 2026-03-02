import { clearPixelCache } from "./pixelCache";
import { clearColormapLutCache } from "../converter/colormaps";
import { clearPixelMathCaches } from "../utils/pixelMath";

export function clearRuntimeCaches(): void {
  clearPixelCache();
  clearPixelMathCaches();
  clearColormapLutCache();
}
