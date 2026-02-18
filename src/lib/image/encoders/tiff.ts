const TIFF_TYPE_SHORT = 3;
const TIFF_TYPE_LONG = 4;
const TIFF_TYPE_RATIONAL = 5;

interface TiffIfdEntry {
  tag: number;
  type: number;
  count: number;
  value: number | Uint8Array;
}

export interface EncodeTiffOptions {
  bitDepth?: 8 | 16 | 32;
  colorMode?: "auto" | "mono" | "rgb";
  dpi?: number;
}

function isRgbImage(rgba: Uint8ClampedArray): boolean {
  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i] !== rgba[i + 1] || rgba[i] !== rgba[i + 2]) {
      return true;
    }
  }
  return false;
}

function toSample8(value: number): number {
  return Math.max(0, Math.min(255, value | 0));
}

function toSample16(value: number): number {
  return Math.max(0, Math.min(65535, Math.round((value / 255) * 65535)));
}

function toSample32(value: number): number {
  // Preserve 8-bit shape for integer output by repeating the byte across 32 bits.
  return Math.max(0, Math.min(0xffffffff, value * 0x01010101));
}

function encodePixels(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  bitDepth: 8 | 16 | 32,
  rgb: boolean,
): Uint8Array {
  const samplesPerPixel = rgb ? 3 : 1;
  const bytesPerSample = bitDepth / 8;
  const out = new Uint8Array(width * height * samplesPerPixel * bytesPerSample);
  const view = new DataView(out.buffer);
  let offset = 0;

  for (let i = 0; i < rgba.length; i += 4) {
    const r = rgba[i];
    const g = rgba[i + 1];
    const b = rgba[i + 2];
    const values = rgb ? [r, g, b] : [Math.round(r * 0.2126 + g * 0.7152 + b * 0.0722)];

    for (const value of values) {
      if (bitDepth === 8) {
        view.setUint8(offset, toSample8(value));
        offset += 1;
      } else if (bitDepth === 16) {
        view.setUint16(offset, toSample16(value), true);
        offset += 2;
      } else {
        view.setUint32(offset, toSample32(value), true);
        offset += 4;
      }
    }
  }

  return out;
}

function writeIfdEntry(
  view: DataView,
  offset: number,
  entry: TiffIfdEntry,
  dataOffset: number,
): number {
  view.setUint16(offset, entry.tag, true);
  view.setUint16(offset + 2, entry.type, true);
  view.setUint32(offset + 4, entry.count, true);

  if (entry.value instanceof Uint8Array) {
    view.setUint32(offset + 8, dataOffset, true);
  } else {
    view.setUint32(offset + 8, entry.value, true);
  }

  return offset + 12;
}

function rational(numerator: number, denominator: number): Uint8Array {
  const bytes = new Uint8Array(8);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, numerator, true);
  view.setUint32(4, denominator, true);
  return bytes;
}

function shortArray(values: number[]): Uint8Array {
  const bytes = new Uint8Array(values.length * 2);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < values.length; i++) {
    view.setUint16(i * 2, values[i], true);
  }
  return bytes;
}

export function encodeTiff(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  options: EncodeTiffOptions = {},
): Uint8Array {
  const bitDepth = options.bitDepth ?? 8;
  const wantsRgb =
    options.colorMode === "rgb" ||
    (options.colorMode !== "mono" && (options.colorMode !== "auto" || isRgbImage(rgba)));
  const dpi = Math.max(1, Math.round(options.dpi ?? 72));

  const samplesPerPixel = wantsRgb ? 3 : 1;
  const pixelBytes = encodePixels(rgba, width, height, bitDepth, wantsRgb);
  const stripByteCount = pixelBytes.length;

  const bitsPerSample = wantsRgb
    ? shortArray([bitDepth, bitDepth, bitDepth])
    : shortArray([bitDepth]);
  const xResolution = rational(dpi, 1);
  const yResolution = rational(dpi, 1);

  const entries: TiffIfdEntry[] = [
    { tag: 256, type: TIFF_TYPE_LONG, count: 1, value: width },
    { tag: 257, type: TIFF_TYPE_LONG, count: 1, value: height },
    {
      tag: 258,
      type: TIFF_TYPE_SHORT,
      count: wantsRgb ? 3 : 1,
      value: wantsRgb ? bitsPerSample : bitDepth,
    },
    { tag: 259, type: TIFF_TYPE_SHORT, count: 1, value: 1 }, // Compression: none
    { tag: 262, type: TIFF_TYPE_SHORT, count: 1, value: wantsRgb ? 2 : 1 }, // RGB / BlackIsZero
    { tag: 273, type: TIFF_TYPE_LONG, count: 1, value: 0 }, // StripOffsets (patched later)
    { tag: 277, type: TIFF_TYPE_SHORT, count: 1, value: samplesPerPixel },
    { tag: 278, type: TIFF_TYPE_LONG, count: 1, value: height }, // RowsPerStrip
    { tag: 279, type: TIFF_TYPE_LONG, count: 1, value: stripByteCount }, // StripByteCounts
    { tag: 282, type: TIFF_TYPE_RATIONAL, count: 1, value: xResolution },
    { tag: 283, type: TIFF_TYPE_RATIONAL, count: 1, value: yResolution },
    { tag: 284, type: TIFF_TYPE_SHORT, count: 1, value: 1 }, // PlanarConfiguration: chunky
    { tag: 296, type: TIFF_TYPE_SHORT, count: 1, value: 2 }, // ResolutionUnit: inch
  ];

  const ifdOffset = 8;
  const ifdSize = 2 + entries.length * 12 + 4;
  let extraOffset = ifdOffset + ifdSize;

  const extraChunks: Array<{ offset: number; bytes: Uint8Array }> = [];
  const resolveDataOffset = (value: number | Uint8Array): number => {
    if (!(value instanceof Uint8Array)) return 0;
    const offset = extraOffset;
    extraOffset += value.length;
    extraChunks.push({ offset, bytes: value });
    return offset;
  };

  for (const entry of entries) {
    if (entry.value instanceof Uint8Array) {
      resolveDataOffset(entry.value);
    }
  }

  const pixelOffset = extraOffset;
  const stripOffsetEntry = entries.find((entry) => entry.tag === 273);
  if (stripOffsetEntry) stripOffsetEntry.value = pixelOffset;

  const output = new Uint8Array(pixelOffset + pixelBytes.length);
  const view = new DataView(output.buffer);

  // TIFF header (little-endian, classic TIFF)
  view.setUint8(0, 0x49);
  view.setUint8(1, 0x49);
  view.setUint16(2, 42, true);
  view.setUint32(4, ifdOffset, true);

  view.setUint16(ifdOffset, entries.length, true);
  let entryOffset = ifdOffset + 2;
  const dataOffsetMap = new Map<Uint8Array, number>();
  for (const chunk of extraChunks) {
    dataOffsetMap.set(chunk.bytes, chunk.offset);
  }

  for (const entry of entries) {
    const valueOffset =
      entry.value instanceof Uint8Array ? (dataOffsetMap.get(entry.value) ?? 0) : 0;
    entryOffset = writeIfdEntry(view, entryOffset, entry, valueOffset);
  }
  view.setUint32(entryOffset, 0, true); // Next IFD = none

  for (const chunk of extraChunks) {
    output.set(chunk.bytes, chunk.offset);
  }

  output.set(pixelBytes, pixelOffset);
  return output;
}
