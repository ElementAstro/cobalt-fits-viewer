import pako from "pako";
import type { TiffCompression } from "../../fits/types";

const TIFF_TYPE_SHORT = 3;
const TIFF_TYPE_LONG = 4;
const TIFF_TYPE_RATIONAL = 5;
const TIFF_TYPE_LONG8 = 16;

const TIFF_SAMPLEFORMAT_UINT = 1;
const TIFF_SAMPLEFORMAT_INT = 2;
const TIFF_SAMPLEFORMAT_IEEEFP = 3;

const CLASSIC_TIFF_MAGIC = 42;
const BIG_TIFF_MAGIC = 43;

interface TiffIfdEntry {
  tag: number;
  type: number;
  count: number | bigint;
  value: number | bigint | Uint8Array;
}

export interface TiffEncodePage {
  width: number;
  height: number;
  rgba?: Uint8Array | Uint8ClampedArray;
  pixels?: Float32Array | Float64Array;
  channels?: {
    r: Float32Array | Float64Array;
    g: Float32Array | Float64Array;
    b: Float32Array | Float64Array;
  };
  bitDepth?: 8 | 16 | 32;
  colorMode?: "auto" | "mono" | "rgb";
  compression?: TiffCompression;
  sampleFormat?: "uint" | "int" | "float";
  orientation?: number;
}

export interface EncodeTiffOptions {
  bitDepth?: 8 | 16 | 32;
  colorMode?: "auto" | "mono" | "rgb";
  dpi?: number;
  compression?: TiffCompression;
  predictor?: 1 | 2;
  pages?: TiffEncodePage[];
  bigTiffThresholdBytes?: number | bigint;
}

interface EncodedPage {
  width: number;
  height: number;
  bitDepth: 8 | 16 | 32;
  sampleFormat: 1 | 2 | 3;
  samplesPerPixel: number;
  photometric: 1 | 2;
  orientation: number;
  compression: TiffCompression;
  predictor: 1 | 2;
  compressedData: Uint8Array;
}

interface LayoutResult {
  bytes: Uint8Array;
}

function isRgbImage(rgba: Uint8Array | Uint8ClampedArray): boolean {
  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i] !== rgba[i + 1] || rgba[i] !== rgba[i + 2]) {
      return true;
    }
  }
  return false;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function toUint8(value: number): number {
  return Math.round(clamp(value, 0, 255));
}

function toUint16(value: number): number {
  return Math.round(clamp(value, 0, 65535));
}

function toInt16(value: number): number {
  return Math.round(clamp(value, -32768, 32767));
}

function toInt32(value: number): number {
  return Math.round(clamp(value, -2147483648, 2147483647));
}

function toUint32(value: number): number {
  return Math.round(clamp(value, 0, 0xffffffff));
}

function shortArray(values: number[]): Uint8Array {
  const bytes = new Uint8Array(values.length * 2);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < values.length; i++) {
    view.setUint16(i * 2, values[i], true);
  }
  return bytes;
}

function rational(numerator: number, denominator: number): Uint8Array {
  const bytes = new Uint8Array(8);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, numerator, true);
  view.setUint32(4, denominator, true);
  return bytes;
}

function encodeRawSamples(page: EncodedPage, rawValues: number[]): Uint8Array {
  const bytesPerSample = page.bitDepth / 8;
  const output = new Uint8Array(rawValues.length * bytesPerSample);
  const view = new DataView(output.buffer);
  let offset = 0;

  for (let i = 0; i < rawValues.length; i++) {
    const value = rawValues[i];
    if (page.bitDepth === 8) {
      if (page.sampleFormat === TIFF_SAMPLEFORMAT_INT) {
        view.setInt8(offset, clamp(Math.round(value), -128, 127));
      } else {
        view.setUint8(offset, toUint8(value));
      }
      offset += 1;
      continue;
    }

    if (page.bitDepth === 16) {
      if (page.sampleFormat === TIFF_SAMPLEFORMAT_INT) {
        view.setInt16(offset, toInt16(value), true);
      } else {
        view.setUint16(offset, toUint16(value), true);
      }
      offset += 2;
      continue;
    }

    if (page.sampleFormat === TIFF_SAMPLEFORMAT_IEEEFP) {
      view.setFloat32(offset, Number.isFinite(value) ? value : 0, true);
    } else if (page.sampleFormat === TIFF_SAMPLEFORMAT_INT) {
      view.setInt32(offset, toInt32(value), true);
    } else {
      view.setUint32(offset, toUint32(value), true);
    }
    offset += 4;
  }

  return output;
}

function applyHorizontalPredictor(
  bytes: Uint8Array,
  width: number,
  height: number,
  samplesPerPixel: number,
  bytesPerSample: number,
): Uint8Array {
  const rowStride = width * samplesPerPixel * bytesPerSample;
  const output = new Uint8Array(bytes);
  const view = new DataView(output.buffer);

  const readSample = (offset: number): number => {
    if (bytesPerSample === 1) return view.getUint8(offset);
    if (bytesPerSample === 2) return view.getUint16(offset, true);
    return view.getUint32(offset, true);
  };

  const writeSample = (offset: number, value: number) => {
    if (bytesPerSample === 1) {
      view.setUint8(offset, value & 0xff);
      return;
    }
    if (bytesPerSample === 2) {
      view.setUint16(offset, value & 0xffff, true);
      return;
    }
    view.setUint32(offset, value >>> 0, true);
  };

  for (let y = 0; y < height; y++) {
    const rowStart = y * rowStride;
    for (let x = width - 1; x >= 1; x--) {
      const pixelOffset = rowStart + x * samplesPerPixel * bytesPerSample;
      const previousOffset = rowStart + (x - 1) * samplesPerPixel * bytesPerSample;
      for (let sample = 0; sample < samplesPerPixel; sample++) {
        const current = pixelOffset + sample * bytesPerSample;
        const prev = previousOffset + sample * bytesPerSample;
        const delta = readSample(current) - readSample(prev);
        writeSample(current, delta);
      }
    }
  }
  return output;
}

function encodeLzw(data: Uint8Array): Uint8Array {
  const CLEAR_CODE = 256;
  const EOI_CODE = 257;
  const MAX_CODE = 4095;
  let codeSize = 9;
  let nextCode = 258;
  let dict = new Map<string, number>();
  for (let i = 0; i < 256; i++) {
    dict.set(String.fromCharCode(i), i);
  }

  const codes: number[] = [CLEAR_CODE];
  let phrase = "";

  const flushReset = () => {
    dict = new Map<string, number>();
    for (let i = 0; i < 256; i++) {
      dict.set(String.fromCharCode(i), i);
    }
    codeSize = 9;
    nextCode = 258;
    codes.push(CLEAR_CODE);
    phrase = "";
  };

  for (let i = 0; i < data.length; i++) {
    const ch = String.fromCharCode(data[i]);
    const candidate = phrase + ch;
    if (dict.has(candidate)) {
      phrase = candidate;
      continue;
    }

    if (phrase) {
      codes.push(dict.get(phrase)!);
    }

    if (nextCode <= MAX_CODE) {
      dict.set(candidate, nextCode++);
      if (nextCode === 1 << codeSize && codeSize < 12) {
        codeSize++;
      }
    } else {
      flushReset();
      phrase = ch;
      continue;
    }
    phrase = ch;
  }

  if (phrase) {
    codes.push(dict.get(phrase)!);
  }
  codes.push(EOI_CODE);

  const output: number[] = [];
  let bitBuffer = 0;
  let bitCount = 0;
  codeSize = 9;
  nextCode = 258;

  for (const code of codes) {
    bitBuffer = (bitBuffer << codeSize) | code;
    bitCount += codeSize;
    while (bitCount >= 8) {
      bitCount -= 8;
      output.push((bitBuffer >> bitCount) & 0xff);
    }
    if (code === CLEAR_CODE) {
      codeSize = 9;
      nextCode = 258;
      continue;
    }
    if (code !== EOI_CODE) {
      nextCode++;
      if (nextCode === 1 << codeSize && codeSize < 12) {
        codeSize++;
      }
      if (nextCode > MAX_CODE) {
        nextCode = 258;
        codeSize = 9;
      }
    }
  }
  if (bitCount > 0) {
    output.push((bitBuffer << (8 - bitCount)) & 0xff);
  }
  return new Uint8Array(output);
}

function compressPageData(
  page: EncodedPage,
  rawData: Uint8Array,
): {
  data: Uint8Array;
  predictor: 1 | 2;
} {
  const bytesPerSample = page.bitDepth / 8;
  const allowPredictor = page.sampleFormat !== TIFF_SAMPLEFORMAT_IEEEFP && page.bitDepth >= 8;
  const predictor = page.compression === "none" || !allowPredictor ? 1 : page.predictor;
  const prepared =
    predictor === 2
      ? applyHorizontalPredictor(
          rawData,
          page.width,
          page.height,
          page.samplesPerPixel,
          bytesPerSample,
        )
      : rawData;

  if (page.compression === "none") {
    return { data: prepared, predictor };
  }
  if (page.compression === "deflate") {
    return { data: pako.deflate(prepared), predictor };
  }
  return { data: encodeLzw(prepared), predictor };
}

function buildPage(page: TiffEncodePage, defaults: EncodeTiffOptions): EncodedPage {
  const width = Math.max(1, Math.round(page.width));
  const height = Math.max(1, Math.round(page.height));
  const colorMode = page.colorMode ?? defaults.colorMode ?? "auto";
  const bitDepth = page.bitDepth ?? defaults.bitDepth ?? 8;
  const sampleFormatRaw = page.sampleFormat ?? (bitDepth === 32 ? "float" : "uint");
  const sampleFormat =
    sampleFormatRaw === "float"
      ? TIFF_SAMPLEFORMAT_IEEEFP
      : sampleFormatRaw === "int"
        ? TIFF_SAMPLEFORMAT_INT
        : TIFF_SAMPLEFORMAT_UINT;
  const compression = page.compression ?? defaults.compression ?? "lzw";
  const orientation = Math.max(1, Math.min(8, page.orientation ?? 1));
  const predictor = defaults.predictor ?? 2;

  const pixelCount = width * height;
  const hasScientificRgb = !!page.channels;
  const hasScientificMono = !!page.pixels;

  let samplesPerPixel = 1;
  let photometric: 1 | 2 = 1;
  const rawValues: number[] = [];

  if (hasScientificRgb) {
    samplesPerPixel = 3;
    photometric = 2;
    for (let i = 0; i < pixelCount; i++) {
      rawValues.push(page.channels!.r[i] ?? 0, page.channels!.g[i] ?? 0, page.channels!.b[i] ?? 0);
    }
  } else if (hasScientificMono) {
    samplesPerPixel = 1;
    photometric = 1;
    for (let i = 0; i < pixelCount; i++) {
      rawValues.push(page.pixels![i] ?? 0);
    }
  } else {
    const rgba = page.rgba;
    if (!rgba || rgba.length < pixelCount * 4) {
      throw new Error("TIFF page requires rgba data or scientific channels/pixels");
    }
    const wantsRgb = colorMode === "rgb" || (colorMode === "auto" && isRgbImage(rgba));
    samplesPerPixel = wantsRgb ? 3 : 1;
    photometric = wantsRgb ? 2 : 1;

    for (let i = 0; i < pixelCount; i++) {
      const offset = i * 4;
      const r = rgba[offset] ?? 0;
      const g = rgba[offset + 1] ?? 0;
      const b = rgba[offset + 2] ?? 0;
      if (wantsRgb) {
        if (bitDepth === 32 && sampleFormat === TIFF_SAMPLEFORMAT_IEEEFP) {
          rawValues.push(r / 255, g / 255, b / 255);
        } else {
          rawValues.push(r, g, b);
        }
      } else {
        const luma = r * 0.2126 + g * 0.7152 + b * 0.0722;
        if (bitDepth === 32 && sampleFormat === TIFF_SAMPLEFORMAT_IEEEFP) {
          rawValues.push(luma / 255);
        } else {
          rawValues.push(luma);
        }
      }
    }
  }

  const encodedPage: EncodedPage = {
    width,
    height,
    bitDepth,
    sampleFormat,
    samplesPerPixel,
    photometric,
    orientation,
    compression,
    predictor,
    compressedData: new Uint8Array(),
  };

  const raw = encodeRawSamples(encodedPage, rawValues);
  const compressed = compressPageData(encodedPage, raw);
  encodedPage.compressedData = compressed.data;
  encodedPage.predictor = compressed.predictor;
  return encodedPage;
}

function writeClassicIfdEntry(
  view: DataView,
  offset: number,
  entry: TiffIfdEntry,
  dataOffset: number,
): number {
  view.setUint16(offset, entry.tag, true);
  view.setUint16(offset + 2, entry.type, true);
  view.setUint32(offset + 4, Number(entry.count), true);
  if (entry.value instanceof Uint8Array) {
    view.setUint32(offset + 8, dataOffset, true);
  } else {
    view.setUint32(offset + 8, Number(entry.value), true);
  }
  return offset + 12;
}

function writeBigIfdEntry(
  view: DataView,
  offset: number,
  entry: TiffIfdEntry,
  dataOffset: bigint,
): number {
  view.setUint16(offset, entry.tag, true);
  view.setUint16(offset + 2, entry.type, true);
  view.setBigUint64(offset + 4, BigInt(entry.count), true);
  if (entry.value instanceof Uint8Array) {
    view.setBigUint64(offset + 12, dataOffset, true);
  } else {
    view.setBigUint64(offset + 12, BigInt(entry.value), true);
  }
  return offset + 20;
}

function buildPageEntries(
  page: EncodedPage,
  dpi: number,
  useBigTiff: boolean,
): {
  entries: TiffIfdEntry[];
  chunks: Array<{ key: string; bytes: Uint8Array }>;
} {
  const compressionCode = page.compression === "none" ? 1 : page.compression === "lzw" ? 5 : 8;
  const bitsPerSample = shortArray(Array(page.samplesPerPixel).fill(page.bitDepth));
  const xResolution = rational(dpi, 1);
  const yResolution = rational(dpi, 1);
  const offsetType = useBigTiff ? TIFF_TYPE_LONG8 : TIFF_TYPE_LONG;
  const stripByteCountType = useBigTiff ? TIFF_TYPE_LONG8 : TIFF_TYPE_LONG;

  const stripByteCount = page.compressedData.length;
  const entries: TiffIfdEntry[] = [
    { tag: 256, type: TIFF_TYPE_LONG, count: 1, value: page.width },
    { tag: 257, type: TIFF_TYPE_LONG, count: 1, value: page.height },
    {
      tag: 258,
      type: TIFF_TYPE_SHORT,
      count: page.samplesPerPixel,
      value: page.samplesPerPixel === 1 ? page.bitDepth : bitsPerSample,
    },
    { tag: 259, type: TIFF_TYPE_SHORT, count: 1, value: compressionCode },
    { tag: 262, type: TIFF_TYPE_SHORT, count: 1, value: page.photometric },
    { tag: 273, type: offsetType, count: 1, value: 0 },
    { tag: 274, type: TIFF_TYPE_SHORT, count: 1, value: page.orientation },
    { tag: 277, type: TIFF_TYPE_SHORT, count: 1, value: page.samplesPerPixel },
    { tag: 278, type: TIFF_TYPE_LONG, count: 1, value: page.height },
    { tag: 279, type: stripByteCountType, count: 1, value: stripByteCount },
    { tag: 282, type: TIFF_TYPE_RATIONAL, count: 1, value: xResolution },
    { tag: 283, type: TIFF_TYPE_RATIONAL, count: 1, value: yResolution },
    { tag: 284, type: TIFF_TYPE_SHORT, count: 1, value: 1 },
    { tag: 296, type: TIFF_TYPE_SHORT, count: 1, value: 2 },
    { tag: 339, type: TIFF_TYPE_SHORT, count: 1, value: page.sampleFormat },
  ];
  if (page.predictor === 2) {
    entries.push({ tag: 317, type: TIFF_TYPE_SHORT, count: 1, value: 2 });
  }

  return {
    entries,
    chunks: [
      { key: "bits", bytes: bitsPerSample },
      { key: "xres", bytes: xResolution },
      { key: "yres", bytes: yResolution },
      { key: "pixels", bytes: page.compressedData },
    ],
  };
}

function buildLayout(pages: EncodedPage[], dpi: number, useBigTiff: boolean): LayoutResult {
  const ifdEntrySize = useBigTiff ? 20 : 12;
  const ifdCountSize = useBigTiff ? 8 : 2;
  const ifdNextSize = useBigTiff ? 8 : 4;
  const headerSize = useBigTiff ? 16 : 8;

  const ifdOffsets: Array<number | bigint> = [];
  let cursor = BigInt(headerSize);
  const prepared = pages.map((page) => buildPageEntries(page, dpi, useBigTiff));

  for (const block of prepared) {
    ifdOffsets.push(cursor);
    cursor += BigInt(ifdCountSize + block.entries.length * ifdEntrySize + ifdNextSize);
  }

  const entryDataOffsets = new Map<Uint8Array, bigint>();
  const pixelOffsets: bigint[] = [];

  for (const block of prepared) {
    for (const entry of block.entries) {
      if (!(entry.value instanceof Uint8Array)) continue;
      const size = BigInt(entry.value.length);
      if (size <= BigInt(useBigTiff ? 8 : 4)) continue;
      if (!entryDataOffsets.has(entry.value)) {
        entryDataOffsets.set(entry.value, cursor);
        cursor += size;
      }
    }
    const pixelChunk = block.chunks.find((c) => c.key === "pixels");
    if (!pixelChunk) {
      pixelOffsets.push(0n);
      continue;
    }
    if (!entryDataOffsets.has(pixelChunk.bytes)) {
      entryDataOffsets.set(pixelChunk.bytes, cursor);
      cursor += BigInt(pixelChunk.bytes.length);
    }
    pixelOffsets.push(entryDataOffsets.get(pixelChunk.bytes)!);
  }

  const totalSizeNumber = Number(cursor);
  if (!Number.isFinite(totalSizeNumber) || totalSizeNumber <= 0) {
    throw new Error("Failed to encode TIFF: invalid output size");
  }

  const output = new Uint8Array(totalSizeNumber);
  const view = new DataView(output.buffer);

  if (useBigTiff) {
    view.setUint8(0, 0x49);
    view.setUint8(1, 0x49);
    view.setUint16(2, BIG_TIFF_MAGIC, true);
    view.setUint16(4, 8, true);
    view.setUint16(6, 0, true);
    view.setBigUint64(8, ifdOffsets[0] as bigint, true);
  } else {
    view.setUint8(0, 0x49);
    view.setUint8(1, 0x49);
    view.setUint16(2, CLASSIC_TIFF_MAGIC, true);
    view.setUint32(4, Number(ifdOffsets[0] ?? 0), true);
  }

  for (let pageIndex = 0; pageIndex < prepared.length; pageIndex++) {
    const block = prepared[pageIndex];
    const ifdOffsetBig = ifdOffsets[pageIndex] as bigint;
    const ifdOffset = Number(ifdOffsetBig);
    if (useBigTiff) {
      view.setBigUint64(ifdOffset, BigInt(block.entries.length), true);
    } else {
      view.setUint16(ifdOffset, block.entries.length, true);
    }
    let entryOffset = ifdOffset + ifdCountSize;
    for (const entry of block.entries) {
      if (entry.tag === 273) {
        entry.value = pixelOffsets[pageIndex];
      }
      if (entry.value instanceof Uint8Array) {
        const size = BigInt(entry.value.length);
        const dataOffset =
          size <= BigInt(useBigTiff ? 8 : 4) ? 0n : (entryDataOffsets.get(entry.value) ?? 0n);
        if (useBigTiff) {
          entryOffset = writeBigIfdEntry(view, entryOffset, entry, dataOffset);
        } else {
          entryOffset = writeClassicIfdEntry(view, entryOffset, entry, Number(dataOffset));
        }
      } else if (useBigTiff) {
        entryOffset = writeBigIfdEntry(view, entryOffset, entry, 0n);
      } else {
        entryOffset = writeClassicIfdEntry(view, entryOffset, entry, 0);
      }
    }

    const nextOffset = pageIndex < prepared.length - 1 ? ifdOffsets[pageIndex + 1] : 0n;
    if (useBigTiff) {
      view.setBigUint64(entryOffset, BigInt(nextOffset), true);
    } else {
      view.setUint32(entryOffset, Number(nextOffset), true);
    }
  }

  for (const [bytes, offset] of entryDataOffsets.entries()) {
    output.set(bytes, Number(offset));
  }

  return { bytes: output };
}

function estimateClassicSize(pages: EncodedPage[], dpi: number): bigint {
  const prepared = pages.map((page) => buildPageEntries(page, dpi, false));
  let size = 8n;
  for (const block of prepared) {
    size += BigInt(2 + block.entries.length * 12 + 4);
    for (const entry of block.entries) {
      if (entry.value instanceof Uint8Array && entry.value.length > 4) {
        size += BigInt(entry.value.length);
      }
    }
  }
  return size;
}

export function encodeTiffDocument(
  pages: TiffEncodePage[],
  options: EncodeTiffOptions = {},
): Uint8Array {
  if (!pages.length) {
    throw new Error("TIFF export requires at least one page");
  }
  const dpi = Math.max(1, Math.round(options.dpi ?? 72));
  const encodedPages = pages.map((page) => buildPage(page, options));
  const threshold =
    typeof options.bigTiffThresholdBytes === "bigint"
      ? options.bigTiffThresholdBytes
      : BigInt(Math.max(0, Math.floor(options.bigTiffThresholdBytes ?? 0xffffffff)));
  const requiresBigTiff = estimateClassicSize(encodedPages, dpi) > threshold;
  const layout = buildLayout(encodedPages, dpi, requiresBigTiff);
  return layout.bytes;
}

export function encodeTiff(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  options: EncodeTiffOptions = {},
): Uint8Array {
  return encodeTiffDocument(
    [
      {
        width,
        height,
        rgba,
        bitDepth: options.bitDepth,
        colorMode: options.colorMode,
      },
    ],
    options,
  );
}
