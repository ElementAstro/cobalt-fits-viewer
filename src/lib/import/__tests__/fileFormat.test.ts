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

  it("detects common video formats", () => {
    expect(detectSupportedImageFormat("preview.mp4")?.id).toBe("mp4");
    expect(detectSupportedImageFormat("preview.mov")?.id).toBe("mov");
    expect(detectSupportedImageFormat("preview.m4v")?.id).toBe("m4v");
    expect(detectSupportedImageFormat("preview.webm")?.id).toBe("webm");
    expect(detectSupportedImageFormat("preview.mkv")?.id).toBe("mkv");
    expect(detectSupportedImageFormat("preview.avi")?.id).toBe("avi");
    expect(detectSupportedImageFormat("preview.3gp")?.id).toBe("3gp");
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
    expect(toImageSourceFormat(detectSupportedImageFormat("x.mp4"))).toBe("mp4");
    expect(toImageSourceFormat(detectSupportedImageFormat("x.mov"))).toBe("mov");
    expect(toImageSourceFormat(detectSupportedImageFormat("x.m4v"))).toBe("m4v");
    expect(toImageSourceFormat(detectSupportedImageFormat("x.webm"))).toBe("webm");
    expect(toImageSourceFormat(detectSupportedImageFormat("x.mkv"))).toBe("mkv");
    expect(toImageSourceFormat(detectSupportedImageFormat("x.avi"))).toBe("avi");
    expect(toImageSourceFormat(detectSupportedImageFormat("x.3gp"))).toBe("3gp");
    expect(toImageSourceFormat(null)).toBe("unknown");
  });

  it("detects format by MIME type", () => {
    expect(detectSupportedImageFormatByMimeType("image/png")?.id).toBe("png");
    expect(detectSupportedImageFormatByMimeType("image/jpeg; charset=utf-8")?.id).toBe("jpeg");
    expect(detectSupportedImageFormatByMimeType("application/fits")?.id).toBe("fits");
    expect(detectSupportedImageFormatByMimeType("video/mp4")?.id).toBe("mp4");
    expect(detectSupportedImageFormatByMimeType("video/quicktime")?.id).toBe("mov");
    expect(detectSupportedImageFormatByMimeType("video/x-m4v")?.id).toBe("m4v");
    expect(detectSupportedImageFormatByMimeType("video/webm")?.id).toBe("webm");
    expect(detectSupportedImageFormatByMimeType("video/x-matroska")?.id).toBe("mkv");
    expect(detectSupportedImageFormatByMimeType("video/x-msvideo")?.id).toBe("avi");
    expect(detectSupportedImageFormatByMimeType("video/3gpp")?.id).toBe("3gp");
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
    const mp4 = new TextEncoder().encode("\u0000\u0000\u0000\u0018ftypisom").buffer;
    const mov = new TextEncoder().encode("\u0000\u0000\u0000\u0018ftypqt  ").buffer;
    const m4v = new TextEncoder().encode("\u0000\u0000\u0000\u0018ftypM4V ").buffer;
    const threeGp = new TextEncoder().encode("\u0000\u0000\u0000\u0018ftyp3gp6").buffer;
    const webm = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x42, 0x82, 0x84, 0x77, 0x65, 0x62, 0x6d])
      .buffer;
    const mkv = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x42, 0x82, 0x84, 0x6d, 0x61, 0x74, 0x72])
      .buffer;
    const avi = new TextEncoder().encode("RIFFxxxxAVI ").buffer;

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
    expect(detectSupportedImageFormatByContent(mp4)?.id).toBe("mp4");
    expect(detectSupportedImageFormatByContent(mov)?.id).toBe("mov");
    expect(detectSupportedImageFormatByContent(m4v)?.id).toBe("m4v");
    expect(detectSupportedImageFormatByContent(threeGp)?.id).toBe("3gp");
    expect(detectSupportedImageFormatByContent(webm)?.id).toBe("webm");
    expect(detectSupportedImageFormatByContent(mkv)?.id).toBe("mkv");
    expect(detectSupportedImageFormatByContent(avi)?.id).toBe("avi");
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
