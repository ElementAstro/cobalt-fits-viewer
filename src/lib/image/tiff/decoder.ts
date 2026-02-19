import type { HeaderKeyword } from "../../fits/types";

type SampleFormatKind = "uint" | "int" | "float" | "unknown";

export interface TiffPageInfo {
  index: number;
  width: number;
  height: number;
  bitDepth: number;
  sampleFormat: SampleFormatKind;
  photometric: number;
  compression: number;
  orientation: number;
  samplesPerPixel: number;
}

export interface RasterFrame {
  index: number;
  width: number;
  height: number;
  bitDepth: number;
  sampleFormat: SampleFormatKind;
  photometric: number;
  compression: number;
  orientation: number;
  rgba: Uint8Array;
  pixels: Float32Array;
  channels: {
    r: Float32Array;
    g: Float32Array;
    b: Float32Array;
  } | null;
  headers: HeaderKeyword[];
}

export interface RasterFrameProvider {
  readonly pageCount: number;
  readonly pages: TiffPageInfo[];
  getFrame(index: number): Promise<RasterFrame>;
  getHeaders(index: number): HeaderKeyword[];
}

interface OrientationResolved {
  width: number;
  height: number;
  sourceX: (x: number, y: number) => number;
  sourceY: (x: number, y: number) => number;
}

interface RangeStats {
  min: number;
  max: number;
}

interface TiffDecodeError extends Error {
  code?: "TIFF_DECODE_FAILED";
}

interface GeoTiffImage {
  fileDirectory: Record<string, unknown>;
  getWidth(): number;
  getHeight(): number;
  readRasters(options: { interleave: false }): Promise<ArrayLike<number> | ArrayLike<number>[]>;
}

interface GeoTiffDocument {
  getImageCount(): Promise<number>;
  getImage(index: number): Promise<GeoTiffImage>;
}

let geotiffModulePromise: Promise<{
  fromArrayBuffer: (buffer: ArrayBuffer) => Promise<GeoTiffDocument>;
}> | null = null;

async function loadGeoTiffModule(): Promise<{
  fromArrayBuffer: (buffer: ArrayBuffer) => Promise<GeoTiffDocument>;
}> {
  if (!geotiffModulePromise) {
    geotiffModulePromise = import("geotiff") as Promise<{
      fromArrayBuffer: (buffer: ArrayBuffer) => Promise<GeoTiffDocument>;
    }>;
  }
  return geotiffModulePromise;
}

const TIFF_TAG_LABELS: Record<string, string> = {
  ImageWidth: "IMAGE_WIDTH",
  ImageLength: "IMAGE_HEIGHT",
  BitsPerSample: "BITS_PER_SAMPLE",
  Compression: "COMPRESSION",
  PhotometricInterpretation: "PHOTOMETRIC",
  StripOffsets: "STRIP_OFFSETS",
  SamplesPerPixel: "SAMPLES_PER_PIXEL",
  RowsPerStrip: "ROWS_PER_STRIP",
  StripByteCounts: "STRIP_BYTE_COUNTS",
  XResolution: "X_RESOLUTION",
  YResolution: "Y_RESOLUTION",
  PlanarConfiguration: "PLANAR_CONFIG",
  ResolutionUnit: "RESOLUTION_UNIT",
  Orientation: "ORIENTATION",
  SampleFormat: "SAMPLE_FORMAT",
  Predictor: "PREDICTOR",
  ExtraSamples: "EXTRA_SAMPLES",
  ColorMap: "COLOR_MAP",
};

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function toSampleFormat(raw: unknown): SampleFormatKind {
  const value = Array.isArray(raw) ? Number(raw[0]) : Number(raw);
  if (!Number.isFinite(value)) return "unknown";
  if (value === 1) return "uint";
  if (value === 2) return "int";
  if (value === 3) return "float";
  return "unknown";
}

function getFirstNumeric(value: unknown, fallback: number): number {
  if (Array.isArray(value)) {
    const v = Number(value[0]);
    return Number.isFinite(v) ? v : fallback;
  }
  const v = Number(value);
  return Number.isFinite(v) ? v : fallback;
}

function computeRange(values: ArrayLike<number>): RangeStats {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < values.length; i++) {
    const value = Number(values[i]);
    if (!Number.isFinite(value)) continue;
    if (value < min) min = value;
    if (value > max) max = value;
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return { min: 0, max: 1 };
  }
  if (min === max) {
    return { min, max: min + 1 };
  }
  return { min, max };
}

function normalizeByRange(value: number, range: RangeStats): number {
  return clamp01((value - range.min) / (range.max - range.min));
}

function resolveOrientation(orientation: number, sourceWidth: number, sourceHeight: number) {
  const swapped = orientation >= 5 && orientation <= 8;
  const width = swapped ? sourceHeight : sourceWidth;
  const height = swapped ? sourceWidth : sourceHeight;

  const sourceX = (x: number, y: number): number => {
    switch (orientation) {
      case 2:
        return sourceWidth - 1 - x;
      case 3:
        return sourceWidth - 1 - x;
      case 4:
        return x;
      case 5:
        return y;
      case 6:
        return y;
      case 7:
        return sourceWidth - 1 - y;
      case 8:
        return sourceWidth - 1 - y;
      default:
        return x;
    }
  };

  const sourceY = (x: number, y: number): number => {
    switch (orientation) {
      case 2:
        return y;
      case 3:
        return sourceHeight - 1 - y;
      case 4:
        return sourceHeight - 1 - y;
      case 5:
        return x;
      case 6:
        return sourceHeight - 1 - x;
      case 7:
        return sourceHeight - 1 - x;
      case 8:
        return x;
      default:
        return y;
    }
  };

  const resolved: OrientationResolved = {
    width,
    height,
    sourceX,
    sourceY,
  };
  return resolved;
}

function remapBand(
  source: ArrayLike<number>,
  sourceWidth: number,
  sourceHeight: number,
  orientation: number,
): Float32Array {
  const resolved = resolveOrientation(orientation, sourceWidth, sourceHeight);
  const output = new Float32Array(resolved.width * resolved.height);
  for (let y = 0; y < resolved.height; y++) {
    for (let x = 0; x < resolved.width; x++) {
      const sx = resolved.sourceX(x, y);
      const sy = resolved.sourceY(x, y);
      const sourceIndex = sy * sourceWidth + sx;
      const targetIndex = y * resolved.width + x;
      const value = Number(source[sourceIndex]);
      output[targetIndex] = Number.isFinite(value) ? value : 0;
    }
  }
  return output;
}

function applyPalette(
  indexes: Float32Array,
  colorMap: ArrayLike<number>,
  bitDepth: number,
): {
  r: Float32Array;
  g: Float32Array;
  b: Float32Array;
} {
  const colorCount = Math.max(1, 1 << Math.min(16, Math.max(1, bitDepth)));
  const r = new Float32Array(indexes.length);
  const g = new Float32Array(indexes.length);
  const b = new Float32Array(indexes.length);

  const colorRange = colorCount;
  for (let i = 0; i < indexes.length; i++) {
    const raw = indexes[i];
    const idx = Math.max(0, Math.min(colorCount - 1, Math.round(raw)));
    const rv = Number(colorMap[idx] ?? 0);
    const gv = Number(colorMap[idx + colorRange] ?? 0);
    const bv = Number(colorMap[idx + colorRange * 2] ?? 0);
    r[i] = rv / 65535;
    g[i] = gv / 65535;
    b[i] = bv / 65535;
  }
  return { r, g, b };
}

function channelToUint8(channel: Float32Array): Uint8Array {
  const range = computeRange(channel);
  const bytes = new Uint8Array(channel.length);
  for (let i = 0; i < channel.length; i++) {
    bytes[i] = Math.round(normalizeByRange(channel[i], range) * 255);
  }
  return bytes;
}

function monoToUint8(values: Float32Array): Uint8Array {
  const range = computeRange(values);
  const bytes = new Uint8Array(values.length);
  for (let i = 0; i < values.length; i++) {
    bytes[i] = Math.round(normalizeByRange(values[i], range) * 255);
  }
  return bytes;
}

function buildHeaders(fileDirectory: Record<string, unknown>): HeaderKeyword[] {
  return Object.entries(fileDirectory).map(([key, value]) => {
    const label = TIFF_TAG_LABELS[key] ?? key.toUpperCase();
    let normalized: HeaderKeyword["value"];
    if (Array.isArray(value)) {
      normalized = JSON.stringify(value.slice(0, 16));
    } else if (
      typeof value === "number" ||
      typeof value === "boolean" ||
      typeof value === "string"
    ) {
      normalized = value;
    } else {
      normalized = value == null ? null : String(value);
    }
    return {
      key: label,
      value: normalized,
      comment: "TIFF tag",
    };
  });
}

function isTiffDecodeError(error: unknown): error is TiffDecodeError {
  return error instanceof Error && (error as TiffDecodeError).code === "TIFF_DECODE_FAILED";
}

function toDecodeError(error: unknown, index: number): TiffDecodeError {
  const message = error instanceof Error ? error.message : String(error ?? "unknown error");
  const wrapped = new Error(`Failed to decode TIFF page #${index}: ${message}`) as TiffDecodeError;
  wrapped.code = "TIFF_DECODE_FAILED";
  return wrapped;
}

class TiffFrameProvider implements RasterFrameProvider {
  readonly pageCount: number;
  readonly pages: TiffPageInfo[];
  private readonly cache = new Map<number, RasterFrame>();

  constructor(
    private readonly tiff: GeoTiffDocument,
    pages: TiffPageInfo[],
    private readonly cacheSize: number,
  ) {
    this.pages = pages;
    this.pageCount = pages.length;
  }

  getHeaders(index: number): HeaderKeyword[] {
    const page = this.pages[index];
    if (!page) return [];
    return [
      { key: "TIFF_PAGE", value: page.index, comment: "Page index" },
      { key: "IMAGE_WIDTH", value: page.width, comment: "Image width" },
      { key: "IMAGE_HEIGHT", value: page.height, comment: "Image height" },
      { key: "BIT_DEPTH", value: page.bitDepth, comment: "Bits per sample" },
      { key: "SAMPLE_FORMAT", value: page.sampleFormat, comment: "Sample format" },
      { key: "PHOTOMETRIC", value: page.photometric, comment: "Photometric interpretation" },
      { key: "COMPRESSION", value: page.compression, comment: "Compression" },
      { key: "ORIENTATION", value: page.orientation, comment: "Orientation" },
    ];
  }

  async getFrame(index: number): Promise<RasterFrame> {
    const page = this.pages[index];
    if (!page) {
      throw new Error(`Invalid TIFF page index: ${index}`);
    }

    const cached = this.cache.get(index);
    if (cached) {
      this.cache.delete(index);
      this.cache.set(index, cached);
      return cached;
    }

    let image: GeoTiffImage;
    try {
      image = await this.tiff.getImage(index);
    } catch (error) {
      throw toDecodeError(error, index);
    }

    const fileDirectory = image.fileDirectory as Record<string, unknown>;
    const headers = [...this.getHeaders(index), ...buildHeaders(fileDirectory)];
    const orientation = page.orientation;
    const sourceWidth = page.width;
    const sourceHeight = page.height;
    const resolvedOrientation = resolveOrientation(orientation, sourceWidth, sourceHeight);
    const pixelCount = resolvedOrientation.width * resolvedOrientation.height;

    try {
      const rastersRaw = await image.readRasters({ interleave: false });
      const rasterBands = Array.isArray(rastersRaw) ? rastersRaw : [rastersRaw];
      if (!rasterBands.length) {
        throw new Error("No raster bands decoded");
      }

      const remappedBands = rasterBands.map((band) =>
        remapBand(band as ArrayLike<number>, sourceWidth, sourceHeight, orientation),
      );

      const hasPalette = page.photometric === 3 && Array.isArray(fileDirectory.ColorMap);
      let channels: { r: Float32Array; g: Float32Array; b: Float32Array } | null = null;
      let pixels: Float32Array;

      if (hasPalette) {
        channels = applyPalette(
          remappedBands[0],
          fileDirectory.ColorMap as ArrayLike<number>,
          page.bitDepth,
        );
        pixels = new Float32Array(pixelCount);
        for (let i = 0; i < pixelCount; i++) {
          pixels[i] = channels.r[i] * 0.2126 + channels.g[i] * 0.7152 + channels.b[i] * 0.0722;
        }
      } else if (remappedBands.length >= 3) {
        channels = {
          r: remappedBands[0],
          g: remappedBands[1],
          b: remappedBands[2],
        };
        pixels = new Float32Array(pixelCount);
        for (let i = 0; i < pixelCount; i++) {
          pixels[i] = channels.r[i] * 0.2126 + channels.g[i] * 0.7152 + channels.b[i] * 0.0722;
        }
      } else {
        pixels = remappedBands[0];
      }

      const rgba = new Uint8Array(pixelCount * 4);
      if (channels) {
        const r8 = channelToUint8(channels.r);
        const g8 = channelToUint8(channels.g);
        const b8 = channelToUint8(channels.b);
        for (let i = 0; i < pixelCount; i++) {
          const offset = i * 4;
          rgba[offset] = r8[i];
          rgba[offset + 1] = g8[i];
          rgba[offset + 2] = b8[i];
          rgba[offset + 3] = 255;
        }
      } else {
        const mono = monoToUint8(pixels);
        for (let i = 0; i < pixelCount; i++) {
          const offset = i * 4;
          rgba[offset] = mono[i];
          rgba[offset + 1] = mono[i];
          rgba[offset + 2] = mono[i];
          rgba[offset + 3] = 255;
        }
      }

      const frame: RasterFrame = {
        index,
        width: resolvedOrientation.width,
        height: resolvedOrientation.height,
        bitDepth: page.bitDepth,
        sampleFormat: page.sampleFormat,
        photometric: page.photometric,
        compression: page.compression,
        orientation,
        rgba,
        pixels,
        channels,
        headers,
      };

      this.cache.set(index, frame);
      if (this.cache.size > this.cacheSize) {
        const oldest = this.cache.keys().next().value;
        if (oldest != null) this.cache.delete(oldest);
      }
      return frame;
    } catch (error) {
      if (isTiffDecodeError(error)) throw error;
      throw toDecodeError(error, index);
    }
  }
}

export function isTiffLikeBuffer(buffer: ArrayBuffer | Uint8Array): boolean {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (bytes.length < 4) return false;
  return (
    (bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2a && bytes[3] === 0x00) ||
    (bytes[0] === 0x4d && bytes[1] === 0x4d && bytes[2] === 0x00 && bytes[3] === 0x2a) ||
    (bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2b && bytes[3] === 0x00) ||
    (bytes[0] === 0x4d && bytes[1] === 0x4d && bytes[2] === 0x00 && bytes[3] === 0x2b)
  );
}

export async function createTiffFrameProvider(
  buffer: ArrayBuffer,
  cacheSize = 3,
): Promise<RasterFrameProvider> {
  let tiff: GeoTiffDocument;
  try {
    const geotiff = await loadGeoTiffModule();
    tiff = await geotiff.fromArrayBuffer(buffer);
  } catch (error) {
    throw toDecodeError(error, 0);
  }

  const count = await tiff.getImageCount();
  const pages: TiffPageInfo[] = [];
  for (let index = 0; index < count; index++) {
    const image = await tiff.getImage(index);
    const fileDirectory = image.fileDirectory as Record<string, unknown>;
    const bitsPerSample = getFirstNumeric(fileDirectory.BitsPerSample, 8);
    const compression = getFirstNumeric(fileDirectory.Compression, 1);
    const photometric = getFirstNumeric(fileDirectory.PhotometricInterpretation, 1);
    const orientation = getFirstNumeric(fileDirectory.Orientation, 1);
    const sampleFormat = toSampleFormat(fileDirectory.SampleFormat);
    const samplesPerPixel = getFirstNumeric(fileDirectory.SamplesPerPixel, 1);
    pages.push({
      index,
      width: image.getWidth(),
      height: image.getHeight(),
      bitDepth: bitsPerSample,
      sampleFormat,
      photometric,
      compression,
      orientation,
      samplesPerPixel,
    });
  }
  return new TiffFrameProvider(tiff, pages, Math.max(1, cacheSize));
}
