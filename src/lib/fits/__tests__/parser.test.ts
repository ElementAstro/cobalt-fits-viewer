const mockFromArrayBuffer = jest.fn((buffer: ArrayBuffer) => ({ kind: "buffer", buffer }));
const mockFromBlob = jest.fn(async (blob: Blob) => ({ kind: "blob", blob }));
const mockFromURL = jest.fn(async (url: string) => ({ kind: "url", url }));
const mockClassifyFrameType = jest.fn(() => "light");

jest.mock("../../gallery/frameClassifier", () => ({
  classifyFrameType: (...args: unknown[]) => mockClassifyFrameType(...args),
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

  return { FITS, Image, BinaryTable, Table, CompressedImage };
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
  getImagePixels,
  getPixelExtent,
  getPixelValue,
  getTableColumn,
  getTableRows,
  loadFitsFromBlob,
  loadFitsFromBuffer,
  loadFitsFromURL,
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

  it("reads header values and HDU information", () => {
    const header = createHeader({
      SIMPLE: true,
      BITPIX: 16,
      NAXIS: 2,
      NAXIS1: 100,
      NAXIS2: 50,
      __dataType: "Image",
    });
    const fits = new (FITS as unknown as new (opts: unknown) => FITS)({
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
    expect(getHeaderValue(new FITS() as unknown as FITS, "BITPIX")).toBeNull();
    expect(getHDUDataType(fits as unknown as FITS)).toBe("Image");
    expect(getHDUDataType(new FITS() as unknown as FITS)).toBeNull();
    expect(getHDUList(fits as unknown as FITS)).toEqual([
      { index: 0, type: "Image", hasData: true },
      { index: 1, type: "BinaryTable", hasData: false },
    ]);
  });

  it("extracts image dimensions and pixel helpers", () => {
    const fits = new FITS({
      header: createHeader({ NAXIS1: 6, NAXIS2: 4, NAXIS3: 3, NAXIS: 3 }),
    });
    expect(getImageDimensions(fits as unknown as FITS)).toEqual({
      width: 6,
      height: 4,
      depth: 3,
      isDataCube: true,
    });
    expect(getImageDimensions(new FITS() as unknown as FITS)).toBeNull();

    const px = new Float32Array([3, NaN, 1, 9, 4]);
    expect(getPixelExtent(px)).toEqual([1, 9]);
    expect(getPixelValue(new Float32Array([0, 1, 2, 3]), 1, 1, 2)).toBe(3);
  });

  it("reads image and table data units by runtime type", async () => {
    const imageFits = new FITS({ dataUnit: new Image(new Float32Array([1, 2, 3])) });
    const compressedFits = new FITS({ dataUnit: new CompressedImage(new Float32Array([4, 5])) });
    const tableFits = new FITS({
      dataUnit: new Table([{ id: 1 }, { id: 2 }], { A: [10, 20], B: [30] }),
    });
    const binaryTableFits = new FITS({
      dataUnit: new BinaryTable([{ id: 3 }], { C: [99] }),
    });

    await expect(getImagePixels(imageFits as unknown as FITS)).resolves.toEqual(
      new Float32Array([1, 2, 3]),
    );
    await expect(getImagePixels(compressedFits as unknown as FITS)).resolves.toEqual(
      new Float32Array([4, 5]),
    );
    await expect(
      getImagePixels(new FITS({ dataUnit: new Table() }) as unknown as FITS),
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

  it("extracts normalized metadata and comments/history", () => {
    const fits = new FITS({
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
    expect(mockClassifyFrameType).toHaveBeenCalledWith("Light", "Light", "M42_LIGHT.FITS");

    expect(getCommentsAndHistory(fits as unknown as FITS)).toEqual({
      comments: ["c1"],
      history: ["h1"],
    });
    expect(getCommentsAndHistory(new FITS() as unknown as FITS)).toEqual({
      comments: [],
      history: [],
    });
  });
});
