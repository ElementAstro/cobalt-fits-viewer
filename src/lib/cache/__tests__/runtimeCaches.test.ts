import { clearRuntimeCaches } from "../runtimeCaches";
import { buildPixelCacheKey, getPixelCacheStats, setPixelCache } from "../pixelCache";
import { getImageLoadCacheStats, setImageLoadCache } from "../imageLoadCache";
import { getColormapLUT } from "../../converter/colormaps";
import { computeZScale } from "../../utils/pixelMath";

describe("runtimeCaches", () => {
  it("clears pixel cache and internal compute caches", () => {
    const pixels = new Float32Array([0, 0.2, 0.4, 0.8]);

    setPixelCache(buildPixelCacheKey("file:///a.fits", 4), {
      pixels,
      width: 2,
      height: 2,
      depth: 1,
      rgbChannels: null,
      timestamp: Date.now(),
    });
    expect(getPixelCacheStats().entries).toBe(1);
    setImageLoadCache("file:///a.fits::4::1", {
      sourceType: "fits",
      sourceFormat: "fits",
      fits: { fits: true } as any,
      rasterFrameProvider: null,
      headers: [],
      comments: [],
      history: [],
      dimensions: { width: 2, height: 2, depth: 1, isDataCube: false },
      hduList: [{ index: 0, type: "Image", hasData: true }],
      metadataBase: {
        filename: "a.fits",
        filepath: "file:///a.fits",
        fileSize: 4,
        frameType: "light",
      } as any,
      decodeStatus: "ready",
      sourceBuffer: new ArrayBuffer(4),
    });
    expect(getImageLoadCacheStats().entries).toBe(1);

    const z1 = computeZScale(pixels, 10, 0.25);
    const z2 = computeZScale(pixels, 10, 0.25);
    expect(z2).toBe(z1);

    const lut1 = getColormapLUT("grayscale", "standard");
    const lut2 = getColormapLUT("grayscale", "standard");
    expect(lut2).toBe(lut1);

    clearRuntimeCaches();

    expect(getPixelCacheStats().entries).toBe(0);
    expect(getImageLoadCacheStats().entries).toBe(0);

    const z3 = computeZScale(pixels, 10, 0.25);
    expect(z3).not.toBe(z1);

    const lut3 = getColormapLUT("grayscale", "standard");
    expect(lut3).not.toBe(lut1);
  });
});
