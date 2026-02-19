import type { FitsMetadata, FitsExportMode, HeaderKeyword } from "./types";

const CARD_LENGTH = 80;
const FITS_BLOCK_SIZE = 2880;

const STRUCTURAL_KEYS = new Set([
  "SIMPLE",
  "BITPIX",
  "NAXIS",
  "NAXIS1",
  "NAXIS2",
  "NAXIS3",
  "BZERO",
  "BSCALE",
  "END",
]);

const WCS_KEY_PATTERNS: RegExp[] = [
  /^CRVAL\d+$/i,
  /^CRPIX\d+$/i,
  /^CTYPE\d+$/i,
  /^CDELT\d+$/i,
  /^CUNIT\d+$/i,
  /^CROTA\d+$/i,
  /^CD\d+_\d+$/i,
  /^PC\d+_\d+$/i,
];

type PrimitiveFitsValue = string | number | boolean | null;
type FitsBitpix = 8 | 16 | 32 | -32 | -64;

export interface FitsMonoWriteInput {
  kind: "mono2d";
  width: number;
  height: number;
  pixels: Float32Array | Float64Array;
}

export interface FitsRgbCubeWriteInput {
  kind: "rgbCube3d";
  width: number;
  height: number;
  r: Float32Array | Float64Array;
  g: Float32Array | Float64Array;
  b: Float32Array | Float64Array;
}

export interface FitsMonoCubeWriteInput {
  kind: "monoCube3d";
  width: number;
  height: number;
  depth: number;
  pixels: Float32Array | Float64Array;
}

export type FitsWriteImageInput =
  | FitsMonoWriteInput
  | FitsRgbCubeWriteInput
  | FitsMonoCubeWriteInput;

export interface FitsWriteOptions {
  image: FitsWriteImageInput;
  bitpix: FitsBitpix;
  preserveOriginalHeader?: boolean;
  preserveWcs?: boolean;
  originalHeaderKeywords?: HeaderKeyword[];
  comments?: string[];
  history?: string[];
  metadata?: Partial<FitsMetadata>;
  bscale?: number;
  bzero?: number;
  exportMode?: FitsExportMode;
  sourceFormat?: string;
  targetFormat?: string;
  timestamp?: string;
}

interface NumericRange {
  min: number;
  max: number;
}

interface IntegerScaling {
  bscale: number;
  bzero: number;
}

interface EncodedData {
  bytes: Uint8Array;
  bscale?: number;
  bzero?: number;
}

function isWcsKey(key: string): boolean {
  return WCS_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

function sanitizeHeaderKey(key: string): string {
  return key.trim().toUpperCase().slice(0, 8);
}

function sanitizeCardText(value: string): string {
  return value.replace(/\r?\n/g, " ").trim();
}

function formatNumericValue(value: number): string {
  if (!Number.isFinite(value)) return "0";
  if (Number.isInteger(value)) return String(value);
  return value.toPrecision(12).replace(/(?:\.0+|(\.\d*?[1-9])0+)$/, "$1");
}

function formatCard(
  key: string,
  value?: PrimitiveFitsValue,
  comment?: string,
  forceCommentStyle: boolean = false,
): string {
  const normalizedKey = sanitizeHeaderKey(key).padEnd(8, " ");

  if (forceCommentStyle || value === undefined) {
    const body = sanitizeCardText(comment ?? "");
    return `${normalizedKey}${body ? ` ${body}` : ""}`
      .padEnd(CARD_LENGTH, " ")
      .slice(0, CARD_LENGTH);
  }

  let formattedValue: string;
  let isStringValue = false;
  if (typeof value === "string") {
    const escaped = sanitizeCardText(value).replace(/'/g, "''");
    formattedValue = `'${escaped}'`;
    isStringValue = true;
  } else if (typeof value === "boolean") {
    formattedValue = value ? "T" : "F";
  } else if (typeof value === "number") {
    formattedValue = formatNumericValue(value);
  } else {
    formattedValue = "";
  }

  const valueField = isStringValue
    ? formattedValue.padEnd(20, " ")
    : formattedValue.padStart(20, " ");
  const suffix = comment ? ` / ${sanitizeCardText(comment)}` : "";
  return `${normalizedKey}= ${valueField}${suffix}`.padEnd(CARD_LENGTH, " ").slice(0, CARD_LENGTH);
}

function padToFitsBlock(bytes: Uint8Array, padByte = 0): Uint8Array {
  const remainder = bytes.length % FITS_BLOCK_SIZE;
  if (remainder === 0) return bytes;
  const padded = new Uint8Array(bytes.length + (FITS_BLOCK_SIZE - remainder));
  padded.set(bytes, 0);
  if (padByte !== 0) padded.fill(padByte, bytes.length);
  return padded;
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function collectRange(data: Float32Array | Float64Array): NumericRange {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < data.length; i++) {
    const value = data[i];
    if (!Number.isFinite(value)) continue;
    if (value < min) min = value;
    if (value > max) max = value;
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { min: 0, max: 0 };
  return { min, max };
}

function mergeRanges(ranges: NumericRange[]): NumericRange {
  let min = Infinity;
  let max = -Infinity;
  for (const range of ranges) {
    if (range.min < min) min = range.min;
    if (range.max > max) max = range.max;
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { min: 0, max: 0 };
  return { min, max };
}

function getIntegerStorageRange(bitpix: 8 | 16 | 32): NumericRange {
  if (bitpix === 8) return { min: 0, max: 255 };
  if (bitpix === 16) return { min: -32768, max: 32767 };
  return { min: -2147483648, max: 2147483647 };
}

function resolveIntegerScaling(
  bitpix: 8 | 16 | 32,
  dataRange: NumericRange,
  requestedBscale?: number,
  requestedBzero?: number,
): IntegerScaling {
  if (
    typeof requestedBscale === "number" &&
    Number.isFinite(requestedBscale) &&
    requestedBscale !== 0 &&
    typeof requestedBzero === "number" &&
    Number.isFinite(requestedBzero)
  ) {
    return { bscale: requestedBscale, bzero: requestedBzero };
  }

  const storage = getIntegerStorageRange(bitpix);
  if (dataRange.min >= storage.min && dataRange.max <= storage.max) {
    return { bscale: 1, bzero: 0 };
  }

  const sourceSpan = dataRange.max - dataRange.min;
  const targetSpan = storage.max - storage.min;
  if (!Number.isFinite(sourceSpan) || sourceSpan <= 0 || targetSpan <= 0) {
    return { bscale: 1, bzero: 0 };
  }

  const bscale = sourceSpan / targetSpan;
  const bzero = dataRange.min - storage.min * bscale;
  return {
    bscale: Number.isFinite(bscale) && bscale !== 0 ? bscale : 1,
    bzero: Number.isFinite(bzero) ? bzero : 0,
  };
}

function physicalToArrayValue(value: number, scaling: IntegerScaling): number {
  return (value - scaling.bzero) / scaling.bscale;
}

function encodePlaneData(
  source: Float32Array | Float64Array,
  bitpix: FitsBitpix,
  scaling?: IntegerScaling,
): Uint8Array {
  const bytesPerPixel = Math.abs(bitpix) / 8;
  const output = new Uint8Array(source.length * bytesPerPixel);
  const view = new DataView(output.buffer);

  if (bitpix === 8) {
    const min = 0;
    const max = 255;
    for (let i = 0; i < source.length; i++) {
      const physical = Number.isFinite(source[i]) ? source[i] : 0;
      const arrayVal = scaling ? physicalToArrayValue(physical, scaling) : physical;
      const quantized = Math.max(min, Math.min(max, Math.round(arrayVal)));
      view.setUint8(i, quantized);
    }
    return output;
  }

  if (bitpix === 16) {
    const min = -32768;
    const max = 32767;
    for (let i = 0; i < source.length; i++) {
      const physical = Number.isFinite(source[i]) ? source[i] : 0;
      const arrayVal = scaling ? physicalToArrayValue(physical, scaling) : physical;
      const quantized = Math.max(min, Math.min(max, Math.round(arrayVal)));
      view.setInt16(i * 2, quantized, false);
    }
    return output;
  }

  if (bitpix === 32) {
    const min = -2147483648;
    const max = 2147483647;
    for (let i = 0; i < source.length; i++) {
      const physical = Number.isFinite(source[i]) ? source[i] : 0;
      const arrayVal = scaling ? physicalToArrayValue(physical, scaling) : physical;
      const quantized = Math.max(min, Math.min(max, Math.round(arrayVal)));
      view.setInt32(i * 4, quantized, false);
    }
    return output;
  }

  if (bitpix === -32) {
    for (let i = 0; i < source.length; i++) {
      const value = Number.isFinite(source[i]) ? source[i] : 0;
      view.setFloat32(i * 4, value, false);
    }
    return output;
  }

  for (let i = 0; i < source.length; i++) {
    const value = Number.isFinite(source[i]) ? source[i] : 0;
    view.setFloat64(i * 8, value, false);
  }
  return output;
}

function encodeImageData(
  image: FitsWriteImageInput,
  bitpix: FitsBitpix,
  options: FitsWriteOptions,
): EncodedData {
  const planes: Array<Float32Array | Float64Array> =
    image.kind === "mono2d"
      ? [image.pixels]
      : image.kind === "monoCube3d"
        ? Array.from({ length: image.depth }, (_, index) => {
            const planeSize = image.width * image.height;
            const start = index * planeSize;
            const end = start + planeSize;
            return image.pixels.subarray(start, end);
          })
        : [image.r, image.g, image.b];

  if (bitpix < 0) {
    const encodedPlanes = planes.map((plane) => encodePlaneData(plane, bitpix));
    return { bytes: concatBytes(encodedPlanes) };
  }

  const range = mergeRanges(planes.map((plane) => collectRange(plane)));
  const integerBitpix = bitpix as 8 | 16 | 32;
  const scaling = resolveIntegerScaling(integerBitpix, range, options.bscale, options.bzero);
  const encodedPlanes = planes.map((plane) => encodePlaneData(plane, bitpix, scaling));
  return {
    bytes: concatBytes(encodedPlanes),
    bscale: scaling.bscale,
    bzero: scaling.bzero,
  };
}

function mapMetadataToCards(
  metadata: Partial<FitsMetadata>,
): Array<{ key?: string; card: string }> {
  const cards: Array<{ key?: string; card: string }> = [];
  const unmapped: string[] = [];

  const mapping: Array<{ key: string; value: unknown; comment?: string }> = [
    { key: "DATE-OBS", value: metadata.dateObs, comment: "Observation date/time" },
    { key: "OBJECT", value: metadata.object, comment: "Target object" },
    { key: "EXPTIME", value: metadata.exptime, comment: "Exposure time in seconds" },
    { key: "FILTER", value: metadata.filter, comment: "Filter name" },
    { key: "INSTRUME", value: metadata.instrument, comment: "Instrument" },
    { key: "TELESCOP", value: metadata.telescope, comment: "Telescope" },
    { key: "DETECTOR", value: metadata.detector, comment: "Detector model" },
    { key: "GAIN", value: metadata.gain, comment: "Detector gain" },
    { key: "CCD-TEMP", value: metadata.ccdTemp, comment: "Sensor temperature" },
    { key: "RA", value: metadata.ra, comment: "Right ascension" },
    { key: "DEC", value: metadata.dec, comment: "Declination" },
    { key: "AIRMASS", value: metadata.airmass, comment: "Airmass" },
  ];

  const mappedKeys = new Set<string>();
  for (const entry of mapping) {
    if (entry.value === undefined || entry.value === null || entry.value === "") continue;
    cards.push({
      key: sanitizeHeaderKey(entry.key),
      card: formatCard(entry.key, entry.value as PrimitiveFitsValue, entry.comment),
    });
    mappedKeys.add(entry.key);
  }

  for (const [key, value] of Object.entries(metadata)) {
    const normalized = key.trim();
    if (!normalized || mappedKeys.has(normalized.toUpperCase())) continue;
    if (
      [
        "id",
        "filename",
        "filepath",
        "fileSize",
        "importDate",
        "lastViewed",
        "isFavorite",
        "tags",
        "albumIds",
      ].includes(normalized)
    ) {
      continue;
    }
    if (value === undefined || value === null) continue;
    unmapped.push(`${normalized}=${String(value)}`);
  }

  for (const item of unmapped) {
    cards.push({
      card: formatCard("HISTORY", undefined, `UNMAPPED_META ${item}`, true),
    });
  }

  return cards;
}

function buildHistoryLine(options: FitsWriteOptions): string {
  const timestamp = options.timestamp ?? new Date().toISOString();
  const source = options.sourceFormat ?? "unknown";
  const target = options.targetFormat ?? "fits";
  const mode = options.exportMode ?? "scientific";
  return `Converted ${source} -> ${target}; mode=${mode}; timestamp=${timestamp}`;
}

function toAsciiBytes(cards: string[]): Uint8Array {
  const headerText = cards.join("");
  const bytes = new Uint8Array(headerText.length);
  for (let i = 0; i < headerText.length; i++) {
    bytes[i] = headerText.charCodeAt(i) & 0x7f;
  }
  return bytes;
}

function validateImageInput(image: FitsWriteImageInput): void {
  if (image.width <= 0 || image.height <= 0) {
    throw new Error("Invalid FITS image dimensions");
  }
  const expected = image.width * image.height;
  if (image.kind === "mono2d") {
    if (image.pixels.length !== expected) {
      throw new Error("FITS mono image data length does not match dimensions");
    }
    return;
  }
  if (image.kind === "monoCube3d") {
    if (image.depth <= 0 || !Number.isFinite(image.depth)) {
      throw new Error("FITS mono cube depth must be positive");
    }
    if (image.pixels.length !== expected * image.depth) {
      throw new Error("FITS mono cube data length does not match dimensions/depth");
    }
    return;
  }
  if (image.r.length !== expected || image.g.length !== expected || image.b.length !== expected) {
    throw new Error("FITS RGB cube channel length does not match dimensions");
  }
}

export function writeFitsImage(options: FitsWriteOptions): Uint8Array {
  validateImageInput(options.image);

  const naxis = options.image.kind === "rgbCube3d" || options.image.kind === "monoCube3d" ? 3 : 2;
  const encoded = encodeImageData(options.image, options.bitpix, options);
  const cards: string[] = [];
  const seenKeys = new Set<string>();

  const pushKeyValueCard = (key: string, value: PrimitiveFitsValue, comment?: string) => {
    const normalized = sanitizeHeaderKey(key);
    if (!normalized || seenKeys.has(normalized)) return;
    seenKeys.add(normalized);
    cards.push(formatCard(normalized, value, comment));
  };

  const pushCommentCard = (text: string) => {
    cards.push(formatCard("COMMENT", undefined, text, true));
  };

  const pushHistoryCard = (text: string) => {
    cards.push(formatCard("HISTORY", undefined, text, true));
  };

  pushKeyValueCard("SIMPLE", true, "conforms to FITS standard");
  pushKeyValueCard("BITPIX", options.bitpix, "array data type");
  pushKeyValueCard("NAXIS", naxis, "number of data axes");
  pushKeyValueCard("NAXIS1", options.image.width, "axis length");
  pushKeyValueCard("NAXIS2", options.image.height, "axis length");
  if (naxis === 3) {
    const axis3 = options.image.kind === "monoCube3d" ? options.image.depth : 3;
    pushKeyValueCard(
      "NAXIS3",
      axis3,
      options.image.kind === "monoCube3d" ? "Frame depth" : "RGB planes",
    );
  }

  if (typeof encoded.bscale === "number" && encoded.bscale !== 1) {
    pushKeyValueCard("BSCALE", encoded.bscale, "physical = BZERO + BSCALE * array");
  }
  if (typeof encoded.bzero === "number" && encoded.bzero !== 0) {
    pushKeyValueCard("BZERO", encoded.bzero, "physical = BZERO + BSCALE * array");
  }

  if (options.preserveOriginalHeader && options.originalHeaderKeywords?.length) {
    for (const entry of options.originalHeaderKeywords) {
      const key = sanitizeHeaderKey(entry.key);
      if (!key || STRUCTURAL_KEYS.has(key)) continue;
      if (!options.preserveWcs && isWcsKey(key)) continue;

      if (key === "COMMENT") {
        if (typeof entry.value === "string") pushCommentCard(entry.value);
        continue;
      }
      if (key === "HISTORY") {
        if (typeof entry.value === "string") pushHistoryCard(entry.value);
        continue;
      }

      const value = entry.value as PrimitiveFitsValue;
      if (value === undefined) continue;
      pushKeyValueCard(key, value, entry.comment);
    }
  }

  if (options.metadata) {
    for (const item of mapMetadataToCards(options.metadata)) {
      if (!item.key) {
        cards.push(item.card);
        continue;
      }
      if (!seenKeys.has(item.key) && !STRUCTURAL_KEYS.has(item.key)) {
        seenKeys.add(item.key);
        cards.push(item.card);
      }
    }
  }

  for (const comment of options.comments ?? []) {
    if (comment) pushCommentCard(comment);
  }

  for (const history of options.history ?? []) {
    if (history) pushHistoryCard(history);
  }
  pushHistoryCard(buildHistoryLine(options));

  cards.push("END".padEnd(CARD_LENGTH, " "));

  const header = padToFitsBlock(toAsciiBytes(cards), 0x20);
  const data = padToFitsBlock(encoded.bytes, 0);
  return concatBytes([header, data]);
}
