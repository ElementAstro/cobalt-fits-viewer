import { clearPixelCache } from "./pixelCache";
import { clearImageLoadCache } from "./imageLoadCache";
import { clearRuntimeDiskCaches } from "./runtimeDiskCache";
import { clearColormapLutCache } from "../converter/colormaps";
import { clearPixelMathCaches } from "../utils/pixelMath";

export function clearRuntimeCaches(): void {
  clearPixelCache();
  clearImageLoadCache();
  clearRuntimeDiskCaches();
  clearPixelMathCaches();
  clearColormapLutCache();
}
