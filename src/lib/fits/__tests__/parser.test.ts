const mockFromArrayBuffer = jest.fn((buffer: ArrayBuffer) => ({ kind: "buffer", buffer }));
const mockFromBlob = jest.fn(async (blob: Blob) => ({ kind: "blob", blob }));
const mockFromURL = jest.fn(async (url: string) => ({ kind: "url", url }));
const mockConvertXisfToFits = jest.fn(async (input: ArrayBuffer) => input);
const mockConvertSerToFits = jest.fn(async (input: ArrayBuffer) => input);
const mockClassifyWithDetail = jest.fn(() => ({ type: "light", source: "header" }));
const mockIsGzipFitsBytes = jest.fn(() => false);
const mockGunzipFitsBytes = jest.fn((value: ArrayBuffer | Uint8Array) =>
  value instanceof Uint8Array ? value : new Uint8Array(value),
);
const mockDetectPreferredSupportedImageFormat = jest.fn(() => null);
const mockIsDistributedXisfFilename = jest.fn(() => false);

jest.mock("../../gallery/frameClassifier", () => ({
  classifyWithDetail: (...args: any[]) => (mockClassifyWithDetail as any)(...args),
}));

jest.mock("../compression", () => ({
  isGzipFitsBytes: (...args: any[]) => (mockIsGzipFitsBytes as any)(...args),
  gunzipFitsBytes: (...args: any[]) => (mockGunzipFitsBytes as any)(...args),
}));

jest.mock("../../import/fileFormat", () => ({
  detectPreferredSupportedImageFormat: (...args: any[]) =>
    (mockDetectPreferredSupportedImageFormat as any)(...args),
  isDistributedXisfFilename: (...args: any[]) => (mockIsDistributedXisfFilename as any)(...args),
}));

jest.mock("fitsjs-ng", () => {
  class Image {
    frames: Float32Array[];
    constructor(frames: Float32Array | Float32Array[]) {
      this.frames = Array.isArray(frames) ? frames : [frames];
    }
    async getFrame(frame: number = 0) {
      return this.frames[frame] ?? this.frames[0];
    }
  }

  class CompressedImage extends Image {}

  class Table {
    rows: Record<string, unknown>[];
    columns: Record<string, unknown[]>;
    constructor(
      rows: Record<string, unknown>[] = [],
      columns: Record<string, unknown[]> = Object.create(null),
    ) {
      this.rows = rows;
      this.columns = columns;
    }
    async getRows(start: number, count: number) {
      return this.rows.slice(start, start + count);
    }
    async getColumn(name: string) {
      return this.columns[name] ?? [];
    }
  }

  class BinaryTable extends Table {}

  class FITS {
    _header?: unknown;
    _dataUnit?: unknown;
    hdus: Array<{ header: { getDataType: () => string | null; hasDataUnit: () => boolean } }>;
    constructor(
      opts: {
        header?: unknown;
        dataUnit?: unknown;
        hdus?: Array<{ header: { getDataType: () => string | null; hasDataUnit: () => boolean } }>;
      } = {},
    ) {
      this._header = opts.header;
      this._dataUnit = opts.dataUnit;
      this.hdus = opts.hdus ?? [];
    }
    getHeader() {
      return this._header;
    }
    getDataUnit() {
      return this._dataUnit;
    }
    static fromArrayBuffer(buffer: ArrayBuffer) {
      return mockFromArrayBuffer(buffer);
    }
    static fromBlob(blob: Blob) {
      return mockFromBlob(blob);
    }
    static fromURL(url: string) {
      return mockFromURL(url);
    }
  }

  return {
    FITS,
    Image,
    BinaryTable,
    Table,
    CompressedImage,
    convertXisfToFits: (...args: any[]) => (mockConvertXisfToFits as any)(...args),
    convertSerToFits: (...args: any[]) => (mockConvertSerToFits as any)(...args),
  };
});

import { BinaryTable, CompressedImage, FITS, Image, Table } from "fitsjs-ng";
import {
  extractMetadata,
  getCommentsAndHistory,
  getHDUDataType,
  getHDUList,
  getHeaderKeywords,
  getHeaderValue,
  getImageDimensions,
  getImageChannels,
  getImagePixels,
  getPixelExtent,
  getPixelValue,
  getTableColumn,
  getTableRows,
  loadFitsFromBlob,
  loadFitsFromBufferAuto,
  loadFitsFromBuffer,
  loadFitsFromURL,
  loadScientificFitsFromBuffer,
  isRgbCube,
} from "../parser";

function createHeader(data: Record<string, unknown>) {
  return {
    keys: () => Object.keys(data),
    get: (k: string) => data[k] ?? null,
    getDataType: () => (data.__dataType as string | undefined) ?? null,
    getComments: () => (data.__comments as string[] | undefined) ?? [],
    getHistory: () => (data.__history as string[] | undefined) ?? [],
  };
}

describe("fits parser", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDetectPreferredSupportedImageFormat.mockReturnValue(null);
    mockIsDistributedXisfFilename.mockReturnValue(false);
  });

  it("loads FITS from buffer/blob/url", async () => {
    const buf = new ArrayBuffer(8);
    const blob = new Blob(["abc"]);
    expect(loadFitsFromBuffer(buf)).toEqual({ kind: "buffer", buffer: buf });
    await expect(loadFitsFromBlob(blob)).resolves.toEqual({ kind: "blob", blob });
    await expect(loadFitsFromURL("https://x.test/file.fits")).resolves.toEqual({
      kind: "url",
      url: "https://x.test/file.fits",
    });
    expect(mockFromArrayBuffer).toHaveBeenCalledWith(buf);
    expect(mockFromBlob).toHaveBeenCalledWith(blob);
    expect(mockFromURL).toHaveBeenCalledWith("https://x.test/file.fits");
  });

  it("loads FITS from buffer with gzip auto-detection", () => {
    const buf = new ArrayBuffer(8);
    mockIsGzipFitsBytes.mockReturnValueOnce(false);
    expect(loadFitsFromBufferAuto(buf)).toEqual({ kind: "buffer", buffer: buf });

    mockIsGzipFitsBytes.mockReturnValueOnce(true);
    const gz = new Uint8Array([1, 2, 3, 4]).buffer;
    const inflated = new Uint8Array([9, 8, 7, 6]);
    mockGunzipFitsBytes.mockReturnValueOnce(inflated);
    loadFitsFromBufferAuto(gz);
    expect(mockGunzipFitsBytes).toHaveBeenCalled();
    expect(mockFromArrayBuffer).toHaveBeenCalledWith(inflated.buffer);
  });

  it("loads scientific buffers (xisf/ser) by converting to fits", async () => {
    const xisfBuffer = new TextEncoder().encode("XISF0100payload").buffer;
    const serBuffer = new TextEncoder().encode("LUCAM-RECORDERpayload").buffer;
    const convertedXisf = new Uint8Array([1, 2, 3, 4]).buffer;
    const convertedSer = new Uint8Array([9, 8, 7, 6]).buffer;

    mockConvertXisfToFits.mockResolvedValueOnce(convertedXisf);
    await expect(
      loadScientificFitsFromBuffer(xisfBuffer, {
        filename: "frame.xisf",
        detectedFormat: { id: "xisf", sourceType: "fits", label: "XISF", extensions: [".xisf"] },
      }),
    ).resolves.toEqual({ kind: "buffer", buffer: convertedXisf });
    expect(mockConvertXisfToFits).toHaveBeenCalledWith(
      xisfBuffer,
      expect.objectContaining({ strictValidation: true }),
    );

    mockConvertSerToFits.mockResolvedValueOnce(convertedSer);
    await expect(
      loadScientificFitsFromBuffer(serBuffer, {
        filename: "capture.ser",
        detectedFormat: { id: "ser", sourceType: "fits", label: "SER", extensions: [".ser"] },
      }),
    ).resolves.toEqual({ kind: "buffer", buffer: convertedSer });
    expect(mockConvertSerToFits).toHaveBeenCalledWith(
      serBuffer,
      expect.objectContaining({ layout: "cube", includeTimestampExtension: true }),
    );
  });

  it("rejects distributed xish/xisb and normalizes conversion errors", async () => {
    const xishBuffer = new ArrayBuffer(8);
    mockDetectPreferredSupportedImageFormat.mockReturnValueOnce(null);
    mockIsDistributedXisfFilename.mockReturnValueOnce(true);
    await expect(
      loadScientificFitsFromBuffer(xishBuffer, {
        filename: "distributed.xish",
      }),
    ).rejects.toThrow("Distributed XISF");

    mockConvertXisfToFits.mockRejectedValueOnce(new Error("signature mismatch"));
    await expect(
      loadScientificFitsFromBuffer(new ArrayBuffer(8), {
        filename: "invalid.xisf",
        detectedFormat: { id: "xisf", sourceType: "fits", label: "XISF", extensions: [".xisf"] },
      }),
    ).rejects.toThrow("signature validation failed");
  });

  it("reads header values and HDU information", () => {
    const header = createHeader({
      SIMPLE: true,
      BITPIX: 16,
      NAXIS: 2,
      NAXIS1: 100,
      NAXIS2: 50,
      __dataType: "Image",
    });
    const fits = new (FITS as any)({
      header,
      hdus: [
        { header: { getDataType: () => "Image", hasDataUnit: () => true } },
        { header: { getDataType: () => "BinaryTable", hasDataUnit: () => false } },
      ],
    });

    const keys = getHeaderKeywords(fits as unknown as FITS);
    expect(keys).toEqual(
      expect.arrayContaining([
        { key: "SIMPLE", value: true, comment: undefined },
        { key: "BITPIX", value: 16, comment: undefined },
      ]),
    );
    expect(getHeaderValue(fits as unknown as FITS, "BITPIX")).toBe(16);
    expect(getHeaderValue(new (FITS as any)() as unknown as FITS, "BITPIX")).toBeNull();
    expect(getHDUDataType(fits as unknown as FITS)).toBe("Image");
    expect(getHDUDataType(new (FITS as any)() as unknown as FITS)).toBeNull();
    expect(getHDUList(fits as unknown as FITS)).toEqual([
      { index: 0, type: "Image", hasData: true },
      { index: 1, type: "BinaryTable", hasData: false },
    ]);
  });

  it("extracts image dimensions and pixel helpers", () => {
    const fits = new (FITS as any)({
      header: createHeader({ NAXIS1: 6, NAXIS2: 4, NAXIS3: 3, NAXIS: 3 }),
    });
    expect(getImageDimensions(fits as unknown as FITS)).toEqual({
      width: 6,
      height: 4,
      depth: 3,
      isDataCube: true,
    });
    expect(getImageDimensions(new (FITS as any)() as unknown as FITS)).toBeNull();
    expect(isRgbCube(fits as unknown as FITS).isRgb).toBe(true);

    const px = new Float32Array([3, NaN, 1, 9, 4]);
    expect(getPixelExtent(px)).toEqual([1, 9]);
    expect(getPixelValue(new Float32Array([0, 1, 2, 3]), 1, 1, 2)).toBe(3);
  });

  it("reads image and table data units by runtime type", async () => {
    const imageFits = new (FITS as any)({
      dataUnit: new (Image as any)(new Float32Array([1, 2, 3])),
    });
    const compressedFits = new (FITS as any)({
      dataUnit: new (CompressedImage as any)(new Float32Array([4, 5])),
    });
    const tableFits = new (FITS as any)({
      dataUnit: new (Table as any)([{ id: 1 }, { id: 2 }], { A: [10, 20], B: [30] }),
    });
    const binaryTableFits = new (FITS as any)({
      dataUnit: new (BinaryTable as any)([{ id: 3 }], { C: [99] }),
    });

    await expect(getImagePixels(imageFits as unknown as FITS)).resolves.toEqual(
      new Float32Array([1, 2, 3]),
    );
    await expect(getImagePixels(compressedFits as unknown as FITS)).resolves.toEqual(
      new Float32Array([4, 5]),
    );
    await expect(
      getImagePixels(new (FITS as any)({ dataUnit: new (Table as any)() }) as unknown as FITS),
    ).resolves.toBeNull();

    await expect(getTableRows(tableFits as unknown as FITS, 0, 0, 2)).resolves.toEqual([
      { id: 1 },
      { id: 2 },
    ]);
    await expect(getTableRows(binaryTableFits as unknown as FITS, 0, 0, 2)).resolves.toEqual([
      { id: 3 },
    ]);
    await expect(getTableRows(imageFits as unknown as FITS, 0)).resolves.toBeNull();

    await expect(getTableColumn(tableFits as unknown as FITS, 0, "A")).resolves.toEqual([10, 20]);
    await expect(getTableColumn(binaryTableFits as unknown as FITS, 0, "C")).resolves.toEqual([99]);
    await expect(getTableColumn(imageFits as unknown as FITS, 0, "A")).resolves.toBeNull();
  });

  it("reads RGB cube channels for cube-like FITS", async () => {
    const frames = [new Float32Array([1, 2]), new Float32Array([3, 4]), new Float32Array([5, 6])];
    const fits = new (FITS as any)({
      header: createHeader({ NAXIS: 3, NAXIS1: 2, NAXIS2: 1, NAXIS3: 3 }),
      dataUnit: new (Image as any)(frames),
    });

    const channels = await getImageChannels(fits as unknown as FITS);
    expect(channels?.r).toEqual(frames[0]);
    expect(channels?.g).toEqual(frames[1]);
    expect(channels?.b).toEqual(frames[2]);
  });

  it("extracts normalized metadata and comments/history", () => {
    const fits = new (FITS as any)({
      header: createHeader({
        BITPIX: 16,
        NAXIS: 2,
        NAXIS1: 3000,
        NAXIS2: 2000,
        NAXIS3: 1,
        OBJECT: " M42 ",
        "DATE-OBS": "2024-01-02T00:00:00Z",
        EXPTIME: 300,
        FILTER: " Ha ",
        INSTRUME: " CameraX ",
        TELESCOP: " RC8 ",
        RA: 83.8,
        DEC: -5.4,
        AIRMASS: 1.3,
        DETECTOR: " IMX ",
        GAIN: 100,
        "SET-TEMP": -10,
        IMAGETYP: "Light",
        FRAME: "Light",
        __comments: ["c1"],
        __history: ["h1"],
      }),
    });
    const metadata = extractMetadata(fits as unknown as FITS, {
      filename: "M42_LIGHT.FITS",
      filepath: "/tmp/M42_LIGHT.FITS",
      fileSize: 1234,
    });

    expect(metadata.filename).toBe("M42_LIGHT.FITS");
    expect(metadata.object).toBe("M42");
    expect(metadata.filter).toBe("Ha");
    expect(metadata.ccdTemp).toBe(-10);
    expect(metadata.frameType).toBe("light");
    expect(metadata.frameTypeSource).toBe("header");
    expect(metadata.imageTypeRaw).toBe("Light");
    expect(metadata.frameHeaderRaw).toBe("Light");
    expect(mockClassifyWithDetail).toHaveBeenCalledWith(
      "Light",
      "Light",
      "M42_LIGHT.FITS",
      undefined,
    );

    expect(getCommentsAndHistory(fits as unknown as FITS)).toEqual({
      comments: ["c1"],
      history: ["h1"],
    });
    expect(getCommentsAndHistory(new (FITS as any)() as unknown as FITS)).toEqual({
      comments: [],
      history: [],
    });
  });
});
