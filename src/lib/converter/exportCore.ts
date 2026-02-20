import { Skia, AlphaType, ColorType, ImageFormat } from "@shopify/react-native-skia";
import type { AstrometryAnnotation } from "../astrometry/types";
import type {
  ExportFormat,
  FitsExportMode,
  FitsMetadata,
  FitsTargetOptions,
  HeaderKeyword,
  StarAnnotationPoint,
  TiffTargetOptions,
} from "../fits/types";
import { DEFAULT_FITS_TARGET_OPTIONS, DEFAULT_TIFF_TARGET_OPTIONS } from "../fits/types";
import { writeFitsImage } from "../fits/writer";
import {
  getImageChannels,
  getImageDimensions,
  getImagePixels,
  isRgbCube,
  loadFitsFromBufferAuto,
} from "../fits/parser";
import { gzipFitsBytes, normalizeFitsCompression } from "../fits/compression";
import { encodeTiff, encodeTiffDocument, type TiffEncodePage } from "../image/encoders/tiff";
import { createTiffFrameProvider } from "../image/tiff/decoder";
import { encodeBmp24 } from "../image/encoders/bmp";
import { getExtension as getExtUtil } from "../utils/imageExport";
import { LOG_TAGS, Logger } from "../logger";
import {
  applyExportDecorations,
  type ExportRenderOptions,
  type ExportDecorationSource,
} from "./exportDecorations";

export type ExportFallbackReasonCode =
  | "scientific_unavailable"
  | "scientific_with_decorations_requires_rendered";

export interface ExportDiagnostics {
  requestedFitsMode?: FitsExportMode;
  effectiveFitsMode?: FitsExportMode;
  scientificAvailable?: boolean;
  fallbackApplied: boolean;
  fallbackReasonCode?: ExportFallbackReasonCode;
  fallbackReasonMessageKey?: string;
  warnings: string[];
  annotationsDrawn: number;
  watermarkApplied: boolean;
}

export interface ExportSourceContext extends ExportDecorationSource {
  sourceType?: FitsMetadata["sourceType"];
  sourceFormat?: string;
  originalBuffer?: ArrayBuffer | Uint8Array | null;
  scientificPixels?: Float32Array | null;
  rgbChannels?: { r: Float32Array; g: Float32Array; b: Float32Array } | null;
  metadata?: Partial<FitsMetadata> | null;
  headerKeywords?: HeaderKeyword[] | null;
  comments?: string[] | null;
  history?: string[] | null;
  sourceFileId?: string;
  astrometryAnnotations?: AstrometryAnnotation[] | null;
  starAnnotations?: StarAnnotationPoint[] | null;
}

export interface ExportRequest {
  rgbaData: Uint8ClampedArray;
  width: number;
  height: number;
  filename: string;
  format: ExportFormat;
  quality?: number;
  bitDepth?: 8 | 16 | 32;
  fits?: Partial<FitsTargetOptions>;
  tiff?: Partial<TiffTargetOptions>;
  source?: ExportSourceContext;
  renderOptions?: ExportRenderOptions;
}

export interface EncodedExportResult {
  bytes: Uint8Array | null;
  extension: string | null;
  diagnostics: ExportDiagnostics;
}

function toArrayBuffer(value: ArrayBuffer | Uint8Array): ArrayBuffer {
  if (value instanceof ArrayBuffer) return value;
  const copy = new Uint8Array(value.byteLength);
  copy.set(value);
  return copy.buffer;
}

function resolveSkiaFormat(format: ExportFormat): (typeof ImageFormat)[keyof typeof ImageFormat] {
  switch (format) {
    case "jpeg":
      return ImageFormat.JPEG;
    case "webp":
      return ImageFormat.WEBP;
    case "png":
    default:
      return ImageFormat.PNG;
  }
}

function resolveQuality(format: ExportFormat, quality?: number): number {
  switch (format) {
    case "jpeg":
      return quality ?? 85;
    case "webp":
      return quality ?? 80;
    default:
      return 100;
  }
}

function normalizeToByte(values: Float32Array): Uint8Array {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (!Number.isFinite(v)) continue;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) {
    return new Uint8Array(values.length).fill(128);
  }
  const output = new Uint8Array(values.length);
  for (let i = 0; i < values.length; i++) {
    const normalized = Math.max(0, Math.min(1, (values[i] - min) / (max - min)));
    output[i] = Math.round(normalized * 255);
  }
  return output;
}

function monoPixelsToRgba(pixels: Float32Array): Uint8ClampedArray {
  const mono = normalizeToByte(pixels);
  const rgba = new Uint8ClampedArray(mono.length * 4);
  for (let i = 0; i < mono.length; i++) {
    const offset = i * 4;
    rgba[offset] = mono[i];
    rgba[offset + 1] = mono[i];
    rgba[offset + 2] = mono[i];
    rgba[offset + 3] = 255;
  }
  return rgba;
}

function rgbChannelsToRgba(channels: {
  r: Float32Array;
  g: Float32Array;
  b: Float32Array;
}): Uint8ClampedArray {
  const r = normalizeToByte(channels.r);
  const g = normalizeToByte(channels.g);
  const b = normalizeToByte(channels.b);
  const rgba = new Uint8ClampedArray(r.length * 4);
  for (let i = 0; i < r.length; i++) {
    const offset = i * 4;
    rgba[offset] = r[i];
    rgba[offset + 1] = g[i];
    rgba[offset + 2] = b[i];
    rgba[offset + 3] = 255;
  }
  return rgba;
}

function rgbaToLuma(rgba: Uint8ClampedArray): Float32Array {
  const totalPixels = Math.floor(rgba.length / 4);
  const output = new Float32Array(totalPixels);
  for (let i = 0, p = 0; i < rgba.length; i += 4, p++) {
    output[p] = (rgba[i] * 0.2126 + rgba[i + 1] * 0.7152 + rgba[i + 2] * 0.0722) / 255;
  }
  return output;
}

function rgbaToRgbChannels(rgba: Uint8ClampedArray): {
  r: Float32Array;
  g: Float32Array;
  b: Float32Array;
} {
  const totalPixels = Math.floor(rgba.length / 4);
  const r = new Float32Array(totalPixels);
  const g = new Float32Array(totalPixels);
  const b = new Float32Array(totalPixels);
  for (let i = 0, p = 0; i < rgba.length; i += 4, p++) {
    r[p] = rgba[i] / 255;
    g[p] = rgba[i + 1] / 255;
    b[p] = rgba[i + 2] / 255;
  }
  return { r, g, b };
}

function normalizeTiffBitDepth(value: number | undefined, fallback: 8 | 16 | 32): 8 | 16 | 32 {
  if (value === 8 || value === 16 || value === 32) return value;
  return fallback;
}

export function canUseScientificFitsExport(source?: ExportSourceContext | null): boolean {
  if (!source) return false;
  if (source.sourceType === "fits") {
    return !!source.originalBuffer || !!source.scientificPixels || !!source.rgbChannels;
  }
  if (source.sourceType === "raster" && source.sourceFormat === "tiff") {
    return !!source.originalBuffer || !!source.scientificPixels || !!source.rgbChannels;
  }
  return false;
}

function hasDecorations(request: ExportRequest): boolean {
  const opts = request.renderOptions;
  return !!(opts?.includeAnnotations || opts?.includeWatermark);
}

function fallbackMessageKey(code: ExportFallbackReasonCode): string {
  switch (code) {
    case "scientific_with_decorations_requires_rendered":
      return "converter.fitsFallbackDecorations";
    case "scientific_unavailable":
    default:
      return "converter.fitsFallbackScientificUnavailable";
  }
}

function shouldUseScientificFastPath(request: ExportRequest): boolean {
  const source = request.source;
  if (!source || source.sourceType !== "fits" || !source.originalBuffer) return false;
  if (hasDecorations(request)) return false;

  const mode = request.fits?.mode ?? DEFAULT_FITS_TARGET_OPTIONS.mode;
  if (mode !== "scientific") return false;

  const preserveHeader =
    request.fits?.preserveOriginalHeader ?? DEFAULT_FITS_TARGET_OPTIONS.preserveOriginalHeader;
  const preserveWcs = request.fits?.preserveWcs ?? DEFAULT_FITS_TARGET_OPTIONS.preserveWcs;
  if (!preserveHeader || !preserveWcs) return false;

  const requestedBitpix = request.fits?.bitpix;
  const sourceBitpix =
    typeof source.metadata?.bitpix === "number"
      ? (source.metadata.bitpix as FitsTargetOptions["bitpix"])
      : undefined;
  if (
    requestedBitpix !== undefined &&
    sourceBitpix !== undefined &&
    requestedBitpix !== sourceBitpix
  ) {
    return false;
  }

  return true;
}

function encodeSkiaImage(
  rgbaData: Uint8ClampedArray,
  width: number,
  height: number,
  format: ExportFormat,
  quality?: number,
): Uint8Array | null {
  const data = Skia.Data.fromBytes(
    new Uint8Array(rgbaData.buffer, rgbaData.byteOffset, rgbaData.byteLength),
  );
  const skImage = Skia.Image.MakeImage(
    {
      width,
      height,
      alphaType: AlphaType.Unpremul,
      colorType: ColorType.RGBA_8888,
    },
    data,
    width * 4,
  );
  if (!skImage) return null;

  const bytes = skImage.encodeToBytes(resolveSkiaFormat(format), resolveQuality(format, quality));
  if (!bytes || bytes.length === 0) return null;
  return bytes;
}

async function buildPreservedTiffPages(request: ExportRequest): Promise<TiffEncodePage[] | null> {
  const source = request.source;
  const sourceBuffer = source?.originalBuffer;
  if (!source || !sourceBuffer) return null;
  const tiffOptions: TiffTargetOptions = {
    ...DEFAULT_TIFF_TARGET_OPTIONS,
    ...(request.tiff ?? {}),
  };
  if (tiffOptions.multipage !== "preserve") return null;

  if (source.sourceType === "fits") {
    const fitsObj = loadFitsFromBufferAuto(toArrayBuffer(sourceBuffer));
    const dims = getImageDimensions(fitsObj);
    if (!dims) return null;

    if (isRgbCube(fitsObj).isRgb) {
      const rgb = await getImageChannels(fitsObj);
      if (!rgb) return null;
      return [
        {
          width: rgb.width,
          height: rgb.height,
          channels: { r: rgb.r, g: rgb.g, b: rgb.b },
          rgba: rgbChannelsToRgba({ r: rgb.r, g: rgb.g, b: rgb.b }),
          bitDepth: request.bitDepth ?? 32,
          sampleFormat: "float",
          colorMode: "rgb",
        },
      ];
    }

    if (!dims.isDataCube || dims.depth <= 1) return null;
    const pages: TiffEncodePage[] = [];
    for (let frame = 0; frame < dims.depth; frame++) {
      const pixels = await getImagePixels(fitsObj, undefined, frame);
      if (!pixels) continue;
      pages.push({
        width: dims.width,
        height: dims.height,
        pixels,
        rgba: monoPixelsToRgba(pixels),
        bitDepth: request.bitDepth ?? 32,
        sampleFormat: "float",
        colorMode: "mono",
      });
    }
    return pages.length > 1 ? pages : null;
  }

  if (source.sourceType === "raster" && source.sourceFormat === "tiff") {
    const provider = await createTiffFrameProvider(toArrayBuffer(sourceBuffer), 3);
    if (provider.pageCount <= 1) return null;
    const pages: TiffEncodePage[] = [];
    for (let index = 0; index < provider.pageCount; index++) {
      const frame = await provider.getFrame(index);
      pages.push({
        width: frame.width,
        height: frame.height,
        rgba: new Uint8ClampedArray(frame.rgba),
        pixels: frame.channels ? undefined : frame.pixels,
        channels: frame.channels ?? undefined,
        bitDepth: normalizeTiffBitDepth(frame.bitDepth, request.bitDepth ?? 8),
        sampleFormat: frame.sampleFormat === "float" ? "float" : "uint",
        colorMode: frame.channels ? "rgb" : "mono",
      });
    }
    return pages.length > 1 ? pages : null;
  }

  return null;
}

async function encodeFits(
  request: ExportRequest,
  diagnostics: ExportDiagnostics,
): Promise<Uint8Array> {
  const source = request.source;
  const fitsOptions: FitsTargetOptions = {
    ...DEFAULT_FITS_TARGET_OPTIONS,
    ...(request.fits ?? {}),
  };
  const tiffOptions: TiffTargetOptions = {
    ...DEFAULT_TIFF_TARGET_OPTIONS,
    ...(request.tiff ?? {}),
  };

  const scientificAvailable = canUseScientificFitsExport(source);
  diagnostics.scientificAvailable = scientificAvailable;
  diagnostics.requestedFitsMode = fitsOptions.mode;

  let effectiveMode = fitsOptions.mode;
  if (effectiveMode === "scientific" && !scientificAvailable) {
    effectiveMode = "rendered";
    if (!diagnostics.fallbackApplied) {
      diagnostics.fallbackApplied = true;
      diagnostics.fallbackReasonCode = "scientific_unavailable";
      diagnostics.fallbackReasonMessageKey = fallbackMessageKey("scientific_unavailable");
    }
  }
  diagnostics.effectiveFitsMode = effectiveMode;

  if (shouldUseScientificFastPath({ ...request, fits: { ...fitsOptions, mode: effectiveMode } })) {
    return normalizeFitsCompression(
      source!.originalBuffer as ArrayBuffer | Uint8Array,
      fitsOptions.compression,
    );
  }

  const sourceFormat = source?.sourceFormat ?? "unknown";
  const targetFormat = fitsOptions.compression === "gzip" ? "fits.gz" : "fits";
  const history = [...(source?.history ?? [])];

  let image: Parameters<typeof writeFitsImage>[0]["image"];
  const preferRgbCube = fitsOptions.colorLayout === "rgbCube3d";
  const useScientificData = effectiveMode === "scientific";

  if (
    useScientificData &&
    source?.sourceType === "raster" &&
    source.sourceFormat === "tiff" &&
    source.originalBuffer &&
    tiffOptions.multipage === "preserve"
  ) {
    const provider = await createTiffFrameProvider(toArrayBuffer(source.originalBuffer), 3);
    if (provider.pageCount > 1) {
      const first = await provider.getFrame(0);
      const width = first.width;
      const height = first.height;
      let monoOnly = !first.channels;
      const cube = new Float32Array(width * height * provider.pageCount);
      cube.set(first.pixels, 0);
      for (let frame = 1; frame < provider.pageCount; frame++) {
        const current = await provider.getFrame(frame);
        if (current.width !== width || current.height !== height || current.channels) {
          monoOnly = false;
          break;
        }
        cube.set(current.pixels, frame * width * height);
      }
      if (monoOnly) {
        image = {
          kind: "monoCube3d",
          width,
          height,
          depth: provider.pageCount,
          pixels: cube,
        };
      } else {
        const warning =
          "TIFF multipage structure is not fully representable in FITS, exported first frame.";
        history.push(warning);
        diagnostics.warnings.push(warning);
        Logger.warn(LOG_TAGS.Export, warning);
        image = {
          kind: "mono2d",
          width,
          height,
          pixels: first.pixels,
        };
      }
    } else {
      image = {
        kind: "mono2d",
        width: request.width,
        height: request.height,
        pixels:
          useScientificData && source?.scientificPixels
            ? source.scientificPixels
            : rgbaToLuma(request.rgbaData),
      };
    }
  } else if (preferRgbCube) {
    const channels =
      useScientificData && source?.rgbChannels
        ? source.rgbChannels
        : rgbaToRgbChannels(request.rgbaData);
    image = {
      kind: "rgbCube3d",
      width: request.width,
      height: request.height,
      r: channels.r,
      g: channels.g,
      b: channels.b,
    };
  } else {
    const mono =
      useScientificData && source?.scientificPixels
        ? source.scientificPixels
        : rgbaToLuma(request.rgbaData);
    image = {
      kind: "mono2d",
      width: request.width,
      height: request.height,
      pixels: mono,
    };
  }

  const fitsBytes = writeFitsImage({
    image,
    bitpix: fitsOptions.bitpix,
    preserveOriginalHeader: fitsOptions.preserveOriginalHeader,
    preserveWcs: fitsOptions.preserveWcs,
    originalHeaderKeywords: source?.headerKeywords ?? undefined,
    comments: source?.comments ?? undefined,
    history,
    metadata: source?.metadata ?? undefined,
    exportMode: effectiveMode,
    sourceFormat,
    targetFormat,
  });

  if (fitsOptions.compression === "gzip") {
    return gzipFitsBytes(fitsBytes);
  }
  return fitsBytes;
}

function getOutputExtension(request: ExportRequest): string {
  if (request.format !== "fits") {
    return getExtUtil(request.format);
  }
  const fitsCompression = request.fits?.compression ?? DEFAULT_FITS_TARGET_OPTIONS.compression;
  return fitsCompression === "gzip" ? "fits.gz" : "fits";
}

function withFitsFallback(request: ExportRequest, diagnostics: ExportDiagnostics): ExportRequest {
  if (request.format !== "fits") return request;
  const fitsOptions: FitsTargetOptions = {
    ...DEFAULT_FITS_TARGET_OPTIONS,
    ...(request.fits ?? {}),
  };
  diagnostics.requestedFitsMode = fitsOptions.mode;
  diagnostics.effectiveFitsMode = fitsOptions.mode;
  diagnostics.scientificAvailable = canUseScientificFitsExport(request.source);

  if (fitsOptions.mode !== "scientific") return request;

  if (!diagnostics.scientificAvailable) {
    diagnostics.fallbackApplied = true;
    diagnostics.fallbackReasonCode = "scientific_unavailable";
    diagnostics.fallbackReasonMessageKey = fallbackMessageKey("scientific_unavailable");
    diagnostics.effectiveFitsMode = "rendered";
    Logger.warn(LOG_TAGS.Export, "FITS scientific export unavailable; fallback to rendered", {
      sourceType: request.source?.sourceType,
      sourceFormat: request.source?.sourceFormat,
      file: request.filename,
    });
    return {
      ...request,
      fits: {
        ...fitsOptions,
        mode: "rendered",
      },
    };
  }

  if (hasDecorations(request)) {
    diagnostics.fallbackApplied = true;
    diagnostics.fallbackReasonCode = "scientific_with_decorations_requires_rendered";
    diagnostics.fallbackReasonMessageKey = fallbackMessageKey(
      "scientific_with_decorations_requires_rendered",
    );
    diagnostics.effectiveFitsMode = "rendered";
    Logger.info(LOG_TAGS.Export, "FITS scientific export with decorations requested; fallback", {
      file: request.filename,
      includeAnnotations: !!request.renderOptions?.includeAnnotations,
      includeWatermark: !!request.renderOptions?.includeWatermark,
    });
    return {
      ...request,
      fits: {
        ...fitsOptions,
        mode: "rendered",
      },
    };
  }

  return request;
}

export async function encodeExportRequest(request: ExportRequest): Promise<EncodedExportResult> {
  const diagnostics: ExportDiagnostics = {
    fallbackApplied: false,
    warnings: [],
    annotationsDrawn: 0,
    watermarkApplied: false,
  };

  let effectiveRequest = withFitsFallback(request, diagnostics);

  if (hasDecorations(effectiveRequest)) {
    const decorated = applyExportDecorations({
      rgbaData: effectiveRequest.rgbaData,
      width: effectiveRequest.width,
      height: effectiveRequest.height,
      filename: effectiveRequest.filename,
      format: effectiveRequest.format,
      options: effectiveRequest.renderOptions,
      source: effectiveRequest.source,
    });
    diagnostics.annotationsDrawn = decorated.annotationsDrawn;
    diagnostics.watermarkApplied = decorated.watermarkApplied;
    diagnostics.warnings.push(...decorated.warnings);
    effectiveRequest = {
      ...effectiveRequest,
      rgbaData: decorated.rgbaData,
    };
  }

  switch (effectiveRequest.format) {
    case "png":
    case "jpeg":
    case "webp": {
      const bytes = encodeSkiaImage(
        effectiveRequest.rgbaData,
        effectiveRequest.width,
        effectiveRequest.height,
        effectiveRequest.format,
        effectiveRequest.quality,
      );
      return {
        bytes,
        extension: bytes ? getOutputExtension(effectiveRequest) : null,
        diagnostics,
      };
    }
    case "tiff": {
      const tiffOptions: TiffTargetOptions = {
        ...DEFAULT_TIFF_TARGET_OPTIONS,
        ...(effectiveRequest.tiff ?? {}),
      };
      const preservedPages = await buildPreservedTiffPages(effectiveRequest);
      if (preservedPages && preservedPages.length > 1) {
        return {
          bytes: encodeTiffDocument(preservedPages, {
            bitDepth: effectiveRequest.bitDepth ?? 8,
            colorMode: "auto",
            compression: tiffOptions.compression,
          }),
          extension: getOutputExtension(effectiveRequest),
          diagnostics,
        };
      }
      return {
        bytes: encodeTiff(
          effectiveRequest.rgbaData,
          effectiveRequest.width,
          effectiveRequest.height,
          {
            bitDepth: effectiveRequest.bitDepth ?? 8,
            colorMode: "auto",
            compression: tiffOptions.compression,
          },
        ),
        extension: getOutputExtension(effectiveRequest),
        diagnostics,
      };
    }
    case "bmp":
      return {
        bytes: encodeBmp24(
          effectiveRequest.rgbaData,
          effectiveRequest.width,
          effectiveRequest.height,
        ),
        extension: getOutputExtension(effectiveRequest),
        diagnostics,
      };
    case "fits":
      return {
        bytes: await encodeFits(effectiveRequest, diagnostics),
        extension: getOutputExtension(effectiveRequest),
        diagnostics,
      };
    default:
      return {
        bytes: null,
        extension: null,
        diagnostics,
      };
  }
}
