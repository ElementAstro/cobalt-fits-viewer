import {
  detectPreferredSupportedImageFormat,
  detectSupportedImageFormat,
  detectSupportedImageFormatByContent,
  detectSupportedImageFormatByMimeType,
  getPrimaryExtensionForFormat,
  isFitsFamilyFilename,
  replaceFilenameExtension,
  splitFilenameExtension,
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
    expect(detectSupportedImageFormat("preview.jfif")?.id).toBe("jpeg");
    expect(detectSupportedImageFormat("preview.tiff")?.id).toBe("tiff");
    expect(detectSupportedImageFormat("preview.tif")?.id).toBe("tiff");
    expect(detectSupportedImageFormat("preview.gif")?.id).toBe("gif");
    expect(detectSupportedImageFormat("preview.heic")?.id).toBe("heic");
    expect(detectSupportedImageFormat("preview.heif")?.id).toBe("heic");
    expect(detectSupportedImageFormat("preview.avif")?.id).toBe("avif");
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
    expect(toImageSourceFormat(detectSupportedImageFormat("x.gif"))).toBe("gif");
    expect(toImageSourceFormat(detectSupportedImageFormat("x.heic"))).toBe("heic");
    expect(toImageSourceFormat(detectSupportedImageFormat("x.avif"))).toBe("avif");
    expect(toImageSourceFormat(null)).toBe("unknown");
  });

  it("detects format by MIME type", () => {
    expect(detectSupportedImageFormatByMimeType("image/png")?.id).toBe("png");
    expect(detectSupportedImageFormatByMimeType("image/jpeg; charset=utf-8")?.id).toBe("jpeg");
    expect(detectSupportedImageFormatByMimeType("application/fits")?.id).toBe("fits");
    expect(detectSupportedImageFormatByMimeType("application/octet-stream")).toBeNull();
  });

  it("detects format by binary signatures", () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).buffer;
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]).buffer;
    const gif = new TextEncoder().encode("GIF89a1234").buffer;
    const webp = new TextEncoder().encode("RIFFxxxxWEBPVP8 ").buffer;
    const tiff = new Uint8Array([0x49, 0x49, 0x2a, 0x00, 0x08]).buffer;
    const bmp = new TextEncoder().encode("BM......").buffer;
    const fits = new TextEncoder().encode("SIMPLE  =T").buffer;
    const gzip = new Uint8Array([0x1f, 0x8b, 0x08, 0x00]).buffer;
    const avif = new TextEncoder().encode("\u0000\u0000\u0000\u0018ftypavif").buffer;
    const heic = new TextEncoder().encode("\u0000\u0000\u0000\u0018ftypheic").buffer;

    expect(detectSupportedImageFormatByContent(png)?.id).toBe("png");
    expect(detectSupportedImageFormatByContent(jpeg)?.id).toBe("jpeg");
    expect(detectSupportedImageFormatByContent(gif)?.id).toBe("gif");
    expect(detectSupportedImageFormatByContent(webp)?.id).toBe("webp");
    expect(detectSupportedImageFormatByContent(tiff)?.id).toBe("tiff");
    expect(detectSupportedImageFormatByContent(bmp)?.id).toBe("bmp");
    expect(detectSupportedImageFormatByContent(fits)?.id).toBe("fits");
    expect(detectSupportedImageFormatByContent(gzip)?.id).toBe("fits_gz");
    expect(detectSupportedImageFormatByContent(avif)?.id).toBe("avif");
    expect(detectSupportedImageFormatByContent(heic)?.id).toBe("heic");
    expect(detectSupportedImageFormatByContent(new Uint8Array([0, 1, 2, 3]))).toBeNull();
  });

  it("returns primary extension for supported format", () => {
    expect(getPrimaryExtensionForFormat("jpeg")).toBe(".jpg");
    expect(getPrimaryExtensionForFormat(detectSupportedImageFormat("x.fit.gz"))).toBe(".fit.gz");
    expect(getPrimaryExtensionForFormat(null)).toBe("");
  });

  it("detects preferred format with content > mime > filename priority", () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).buffer;

    const byContent = detectPreferredSupportedImageFormat({
      filename: "frame.fits",
      mimeType: "application/fits",
      payload: png,
    });
    expect(byContent?.id).toBe("png");

    const byMime = detectPreferredSupportedImageFormat({
      filename: "frame.fits",
      mimeType: "image/jpeg",
    });
    expect(byMime?.id).toBe("jpeg");

    const byFilename = detectPreferredSupportedImageFormat({
      filename: "frame.fit.gz",
    });
    expect(byFilename?.id).toBe("fit_gz");
  });

  it("handles multi-part extension split and replacement", () => {
    expect(splitFilenameExtension("M42.fits.gz")).toEqual({
      baseName: "M42",
      extension: ".fits.gz",
    });
    expect(splitFilenameExtension("M31.fit.gz")).toEqual({
      baseName: "M31",
      extension: ".fit.gz",
    });
    expect(replaceFilenameExtension("preview.jpeg", ".png")).toBe("preview.png");
    expect(replaceFilenameExtension("stack.fit.gz", ".fits.gz")).toBe("stack.fits.gz");
  });
});
