import {
  isImageLikeMedia,
  isProcessableImageMedia,
  parseImageBuffer,
  parseImageFile,
} from "../imageParsePipeline";

jest.mock("../../fits/parser", () => ({
  loadScientificFitsFromBuffer: jest.fn(),
  getImageDimensions: jest.fn(),
  getImagePixels: jest.fn(),
  isRgbCube: jest.fn(() => ({ isRgb: false, width: 0, height: 0 })),
  getImageChannels: jest.fn(),
  getHeaderKeywords: jest.fn(() => []),
  getCommentsAndHistory: jest.fn(() => ({ comments: [], history: [] })),
  extractMetadata: jest.fn(),
  getSerMetadata: jest.fn(() => undefined),
}));

jest.mock("../../image/rasterParser", () => ({
  parseRasterFromBufferAsync: jest.fn(),
  extractRasterMetadata: jest.fn(),
}));

jest.mock("../fileFormat", () => ({
  detectPreferredSupportedImageFormat: jest.fn(),
  isDistributedXisfFilename: jest.fn(() => false),
  isRawRasterFormatId: jest.fn(),
  toImageSourceFormat: jest.fn(),
  detectSupportedMediaFormat: jest.fn(),
}));

jest.mock("../../utils/fileManager", () => ({
  readFileAsArrayBuffer: jest.fn(),
}));

const fitsParserMock = jest.requireMock("../../fits/parser") as {
  loadScientificFitsFromBuffer: jest.Mock;
  getImageDimensions: jest.Mock;
  getImagePixels: jest.Mock;
  isRgbCube: jest.Mock;
  getImageChannels: jest.Mock;
  getHeaderKeywords: jest.Mock;
  getCommentsAndHistory: jest.Mock;
  extractMetadata: jest.Mock;
  getSerMetadata: jest.Mock;
};

const rasterParserMock = jest.requireMock("../../image/rasterParser") as {
  parseRasterFromBufferAsync: jest.Mock;
  extractRasterMetadata: jest.Mock;
};

const fileFormatMock = jest.requireMock("../fileFormat") as {
  detectPreferredSupportedImageFormat: jest.Mock;
  isDistributedXisfFilename: jest.Mock;
  isRawRasterFormatId: jest.Mock;
  toImageSourceFormat: jest.Mock;
  detectSupportedMediaFormat: jest.Mock;
};

const fileManagerMock = jest.requireMock("../../utils/fileManager") as {
  readFileAsArrayBuffer: jest.Mock;
};

describe("imageParsePipeline", () => {
  const baseBuffer = new ArrayBuffer(8);

  beforeEach(() => {
    jest.clearAllMocks();

    fitsParserMock.loadScientificFitsFromBuffer.mockResolvedValue({ fits: true });
    fitsParserMock.getImageDimensions.mockReturnValue({
      width: 4,
      height: 3,
      depth: 1,
      isDataCube: false,
    });
    fitsParserMock.getImagePixels.mockResolvedValue(new Float32Array([0, 1, 2, 3]));
    fitsParserMock.getImageChannels.mockResolvedValue(null);
    fitsParserMock.getHeaderKeywords.mockReturnValue([{ key: "SIMPLE", value: true }]);
    fitsParserMock.getCommentsAndHistory.mockReturnValue({
      comments: ["comment"],
      history: ["history"],
    });
    fitsParserMock.extractMetadata.mockReturnValue({
      filename: "a.fits",
      filepath: "/tmp/a.fits",
      fileSize: 8,
      frameType: "light",
      frameTypeSource: "filename",
    });
    fitsParserMock.getSerMetadata.mockReturnValue(undefined);

    rasterParserMock.parseRasterFromBufferAsync.mockResolvedValue({
      width: 5,
      height: 4,
      depth: 1,
      isMultiFrame: false,
      frameIndex: 0,
      bitDepth: 8,
      rgba: new Uint8Array([255, 0, 0, 255]),
      pixels: new Float32Array([0.2, 0.3, 0.4, 0.5]),
      channels: null,
      headers: [{ key: "RASTER", value: 1 }],
      decodeStatus: "ready",
      decodeError: undefined,
    });
    rasterParserMock.extractRasterMetadata.mockReturnValue({
      filename: "a.png",
      filepath: "/tmp/a.png",
      fileSize: 8,
      bitpix: 8,
      naxis: 2,
      naxis1: 5,
      naxis2: 4,
      naxis3: 1,
      frameType: "light",
      frameTypeSource: "filename",
      decodeStatus: "ready",
      decodeError: undefined,
    });

    fileFormatMock.detectPreferredSupportedImageFormat.mockReturnValue({
      id: "fits",
      sourceType: "fits",
    });
    fileFormatMock.toImageSourceFormat.mockReturnValue("fits");
    fileFormatMock.detectSupportedMediaFormat.mockReturnValue({
      id: "fits",
      sourceType: "fits",
    });
    fileFormatMock.isRawRasterFormatId.mockImplementation((formatId: string) => formatId === "dng");

    fileManagerMock.readFileAsArrayBuffer.mockResolvedValue(baseBuffer);
  });

  it("parses scientific fits/xisf/ser formats through shared FITS pipeline", async () => {
    fileFormatMock.detectPreferredSupportedImageFormat.mockReturnValueOnce({
      id: "xisf",
      sourceType: "fits",
    });
    fileFormatMock.toImageSourceFormat.mockReturnValueOnce("xisf");
    fitsParserMock.getSerMetadata.mockReturnValueOnce({ frameCount: 10 });

    const result = await parseImageBuffer({
      buffer: baseBuffer,
      filename: "capture.xisf",
      filepath: "/tmp/capture.xisf",
      fileSize: 8,
    });

    expect(fitsParserMock.loadScientificFitsFromBuffer).toHaveBeenCalledWith(baseBuffer, {
      filename: "capture.xisf",
      mimeType: undefined,
      detectedFormat: expect.objectContaining({ id: "xisf" }),
    });
    expect(result).toEqual(
      expect.objectContaining({
        sourceType: "fits",
        sourceFormat: "xisf",
        decodeStatus: "ready",
        serInfo: expect.objectContaining({ frameCount: 10 }),
      }),
    );
  });

  it("parses multipage tiff raster and keeps frame provider", async () => {
    const frameProvider = {
      pageCount: 2,
      pages: [],
      getHeaders: jest.fn(),
      getFrame: jest.fn(),
    };
    fileFormatMock.detectPreferredSupportedImageFormat.mockReturnValueOnce({
      id: "tiff",
      sourceType: "raster",
    });
    fileFormatMock.toImageSourceFormat.mockReturnValueOnce("tiff");
    rasterParserMock.parseRasterFromBufferAsync.mockResolvedValueOnce({
      width: 6,
      height: 4,
      depth: 2,
      isMultiFrame: true,
      frameIndex: 0,
      bitDepth: 16,
      rgba: new Uint8Array([255, 255, 255, 255]),
      pixels: new Float32Array([0, 1, 2, 3]),
      channels: null,
      headers: [{ key: "TIFF_PAGE", value: 0 }],
      frameProvider,
      decodeStatus: "ready",
      decodeError: undefined,
    });

    const result = await parseImageBuffer({
      buffer: baseBuffer,
      filename: "stack.tiff",
      filepath: "/tmp/stack.tiff",
      fileSize: 8,
    });

    expect(result.sourceType).toBe("raster");
    expect(result.dimensions).toEqual({
      width: 6,
      height: 4,
      depth: 2,
      isDataCube: true,
    });
    expect(result.rasterFrameProvider).toBe(frameProvider);
  });

  it("forwards heic/avif hints into raster async parser", async () => {
    fileFormatMock.detectPreferredSupportedImageFormat.mockReturnValueOnce({
      id: "heic",
      sourceType: "raster",
    });
    fileFormatMock.toImageSourceFormat.mockReturnValueOnce("heic");

    await parseImageBuffer({
      buffer: baseBuffer,
      filename: "photo.heic",
      filepath: "/tmp/photo.heic",
      mimeType: "image/heic",
      fileSize: 8,
    });

    expect(rasterParserMock.parseRasterFromBufferAsync).toHaveBeenCalledWith(
      baseBuffer,
      expect.objectContaining({
        filename: "photo.heic",
        mimeType: "image/heic",
        formatHint: "heic",
      }),
    );
  });

  it("returns decode-failed metadata for tiff when allowDecodeFailureMetadata is enabled", async () => {
    fileFormatMock.detectPreferredSupportedImageFormat.mockReturnValueOnce({
      id: "tiff",
      sourceType: "raster",
    });
    fileFormatMock.toImageSourceFormat.mockReturnValueOnce("tiff");
    rasterParserMock.parseRasterFromBufferAsync.mockRejectedValueOnce(new Error("decode failed"));
    rasterParserMock.extractRasterMetadata.mockReturnValueOnce({
      filename: "broken.tiff",
      filepath: "/tmp/broken.tiff",
      fileSize: 8,
      frameType: "unknown",
      frameTypeSource: "filename",
      decodeStatus: "failed",
      decodeError: "decode failed",
    });

    const result = await parseImageBuffer({
      buffer: baseBuffer,
      filename: "broken.tiff",
      filepath: "/tmp/broken.tiff",
      fileSize: 8,
      allowDecodeFailureMetadata: true,
    });

    expect(result.decodeStatus).toBe("failed");
    expect(result.decodeError).toBe("decode failed");
    expect(result.pixels).toBeNull();
    expect(rasterParserMock.extractRasterMetadata).toHaveBeenCalledWith(
      expect.objectContaining({ filename: "broken.tiff" }),
      expect.objectContaining({ width: 0, height: 0, depth: 1 }),
      undefined,
      expect.objectContaining({
        decodeStatus: "failed",
        decodeError: "decode failed",
      }),
    );
  });

  it("returns decode-failed metadata for RAW when allowDecodeFailureMetadata is enabled", async () => {
    fileFormatMock.detectPreferredSupportedImageFormat.mockReturnValueOnce({
      id: "dng",
      sourceType: "raster",
    });
    fileFormatMock.toImageSourceFormat.mockReturnValueOnce("dng");
    rasterParserMock.parseRasterFromBufferAsync.mockRejectedValueOnce(
      new Error("Unsupported RAW compression"),
    );
    rasterParserMock.extractRasterMetadata.mockReturnValueOnce({
      filename: "broken.dng",
      filepath: "/tmp/broken.dng",
      fileSize: 8,
      frameType: "unknown",
      frameTypeSource: "filename",
      decodeStatus: "failed",
      decodeError: "Unsupported RAW compression",
    });

    const result = await parseImageBuffer({
      buffer: baseBuffer,
      filename: "broken.dng",
      filepath: "/tmp/broken.dng",
      fileSize: 8,
      allowDecodeFailureMetadata: true,
    });

    expect(result.decodeStatus).toBe("failed");
    expect(result.decodeError).toBe("Unsupported RAW compression");
    expect(result.pixels).toBeNull();
    expect(rasterParserMock.extractRasterMetadata).toHaveBeenCalledWith(
      expect.objectContaining({ filename: "broken.dng" }),
      expect.objectContaining({ width: 0, height: 0, depth: 1 }),
      undefined,
      expect.objectContaining({
        decodeStatus: "failed",
        decodeError: "Unsupported RAW compression",
      }),
    );
  });

  it("throws decode error for tiff when downgrade is disabled", async () => {
    fileFormatMock.detectPreferredSupportedImageFormat.mockReturnValueOnce({
      id: "tiff",
      sourceType: "raster",
    });
    fileFormatMock.toImageSourceFormat.mockReturnValueOnce("tiff");
    rasterParserMock.parseRasterFromBufferAsync.mockRejectedValueOnce(new Error("decode failed"));

    await expect(
      parseImageBuffer({
        buffer: baseBuffer,
        filename: "broken.tiff",
      }),
    ).rejects.toThrow("decode failed");
  });

  it("parses image file by reading file first", async () => {
    await parseImageFile({
      filepath: "/tmp/a.fits",
      filename: "a.fits",
      fileSize: 8,
    });
    expect(fileManagerMock.readFileAsArrayBuffer).toHaveBeenCalledWith("/tmp/a.fits");
    expect(fitsParserMock.loadScientificFitsFromBuffer).toHaveBeenCalled();
  });

  it("filters image-like media records", () => {
    fileFormatMock.detectSupportedMediaFormat.mockReturnValueOnce({
      id: "mp4",
      sourceType: "video",
    });
    fileFormatMock.detectSupportedMediaFormat.mockReturnValueOnce({
      id: "png",
      sourceType: "raster",
    });

    expect(isImageLikeMedia({ mediaKind: "video" })).toBe(false);
    expect(isImageLikeMedia({ sourceType: "fits" })).toBe(true);
    expect(isImageLikeMedia({ filename: "clip.mp4" })).toBe(false);
    expect(isImageLikeMedia({ filename: "frame.png" })).toBe(true);
  });

  it("filters processable image-like media records", () => {
    expect(isProcessableImageMedia({ mediaKind: "image", decodeStatus: "ready" })).toBe(true);
    expect(isProcessableImageMedia({ sourceType: "fits" })).toBe(true);
    expect(isProcessableImageMedia({ sourceType: "raster", decodeStatus: "failed" })).toBe(false);
    expect(isProcessableImageMedia({ mediaKind: "video" })).toBe(false);
  });
});
