import {
  detectSupportedImageFormat,
  isFitsFamilyFilename,
  isSupportedImageFilename,
  toImageSourceFormat,
} from "../fileFormat";

describe("fileFormat", () => {
  it("detects compressed fits extensions with priority", () => {
    const fitsGz = detectSupportedImageFormat("M42_LIGHT.FITS.GZ");
    const fitGz = detectSupportedImageFormat("M31.fit.gz");

    expect(fitsGz?.id).toBe("fits_gz");
    expect(fitGz?.id).toBe("fit_gz");
    expect(isFitsFamilyFilename("M31.fit.gz")).toBe(true);
  });

  it("detects common raster formats", () => {
    expect(detectSupportedImageFormat("preview.jpg")?.id).toBe("jpeg");
    expect(detectSupportedImageFormat("preview.jpeg")?.id).toBe("jpeg");
    expect(detectSupportedImageFormat("preview.tiff")?.id).toBe("tiff");
    expect(detectSupportedImageFormat("preview.tif")?.id).toBe("tiff");
  });

  it("handles query strings and unsupported names", () => {
    expect(isSupportedImageFilename("https://example.com/x.fits.gz?token=abc#part")).toBe(true);
    expect(isSupportedImageFilename("notes.txt")).toBe(false);
    expect(detectSupportedImageFormat("notes.txt")).toBeNull();
  });

  it("maps supported format ids to metadata source format", () => {
    expect(toImageSourceFormat(detectSupportedImageFormat("x.fits.gz"))).toBe("fits.gz");
    expect(toImageSourceFormat(detectSupportedImageFormat("x.fit.gz"))).toBe("fit.gz");
    expect(toImageSourceFormat(detectSupportedImageFormat("x.jpg"))).toBe("jpeg");
    expect(toImageSourceFormat(detectSupportedImageFormat("x.tiff"))).toBe("tiff");
    expect(toImageSourceFormat(null)).toBe("unknown");
  });
});
