/**
 * Unified image export hook.
 * Supports PNG/JPEG/WebP/TIFF/BMP/FITS(.fits/.fits.gz)
 */

import { useState, useCallback } from "react";
import { Platform } from "react-native";
import { Skia, AlphaType, ColorType, ImageFormat } from "@shopify/react-native-skia";
import { File as FSFile } from "expo-file-system";
import * as Print from "expo-print";
import * as Clipboard from "expo-clipboard";
import { LOG_TAGS, Logger } from "../lib/logger";
import type { ExportFormat } from "../lib/fits/types";
import type {
  ExportRequest,
  ExportSourceContext,
  ExportDiagnostics,
} from "../lib/converter/exportCore";
import { encodeExportRequest } from "../lib/converter/exportCore";
import { splitFilenameExtension } from "../lib/import/fileFormat";
import {
  shareFile,
  saveToMediaLibrary,
  getExportDir,
  type ShareFileOptions,
} from "../lib/utils/imageExport";

export type { ExportRequest, ExportSourceContext, ExportDiagnostics };

function buildPrintHtml(base64: string, filename: string, width: number, height: number): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    @page { margin: 15mm; }
    body { text-align: center; margin: 0; padding: 0; font-family: -apple-system, sans-serif; }
    h2 { font-size: 16px; color: #333; margin-bottom: 8px; }
    img { max-width: 100%; height: auto; }
    .meta { font-size: 11px; color: #888; margin-top: 8px; }
  </style>
</head>
<body>
  <h2>${filename}</h2>
  <img src="data:image/png;base64,${base64}" />
  <p class="meta">${width} &times; ${height} px</p>
</body>
</html>`;
}

function encodeToBase64(bytes: Uint8Array): string {
  const CHUNK = 8192;
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const slice = bytes.subarray(i, Math.min(i + CHUNK, bytes.length));
    parts.push(String.fromCharCode.apply(null, slice as unknown as number[]));
  }
  return btoa(parts.join(""));
}

function encodeSkiaPng(
  rgbaData: Uint8ClampedArray,
  width: number,
  height: number,
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
  const bytes = skImage.encodeToBytes(ImageFormat.PNG, 100);
  if (!bytes || bytes.length === 0) return null;
  return bytes;
}

type LegacyExportArgs = [
  rgbaData: Uint8ClampedArray,
  width: number,
  height: number,
  filename: string,
  format: ExportFormat,
  quality?: number,
];

type ExportInput = ExportRequest | LegacyExportArgs;
type ExportInvokeArgs = [ExportRequest] | LegacyExportArgs;

function isExportRequest(value: ExportInput): value is ExportRequest {
  return (
    !Array.isArray(value) && typeof value === "object" && value !== null && "rgbaData" in value
  );
}

function normalizeRequest(input: ExportInput): ExportRequest {
  if (isExportRequest(input)) return input;
  const [rgbaData, width, height, filename, format, quality] = input;
  return { rgbaData, width, height, filename, format, quality };
}

export interface ExportImageDetailedResult {
  path: string | null;
  diagnostics: ExportDiagnostics;
}

interface ExportImageFn {
  (request: ExportRequest): Promise<string | null>;
  (
    rgbaData: Uint8ClampedArray,
    width: number,
    height: number,
    filename: string,
    format: ExportFormat,
    quality?: number,
  ): Promise<string | null>;
}

interface ShareImageFn {
  (request: ExportRequest): Promise<void>;
  (
    rgbaData: Uint8ClampedArray,
    width: number,
    height: number,
    filename: string,
    format: ExportFormat,
    quality?: number,
  ): Promise<void>;
}

interface SaveImageFn {
  (request: ExportRequest): Promise<string | null>;
  (
    rgbaData: Uint8ClampedArray,
    width: number,
    height: number,
    filename: string,
    format: ExportFormat,
    quality?: number,
  ): Promise<string | null>;
}

export type PdfPageSize = "letter" | "a4" | "a3" | "legal";

const PDF_PAGE_DIMENSIONS: Record<PdfPageSize, { width: number; height: number }> = {
  letter: { width: 612, height: 792 },
  a4: { width: 595, height: 842 },
  a3: { width: 842, height: 1191 },
  legal: { width: 612, height: 1008 },
};

export type ExportPhase =
  | "idle"
  | "encoding"
  | "writing"
  | "sharing"
  | "saving"
  | "copying"
  | "printing";

interface UseExportReturn {
  isExporting: boolean;
  exportPhase: ExportPhase;
  exportImage: ExportImageFn;
  exportImageDetailed: (request: ExportRequest) => Promise<ExportImageDetailedResult>;
  shareImage: ShareImageFn;
  saveImage: SaveImageFn;
  copyImageToClipboard: (
    rgbaData: Uint8ClampedArray,
    width: number,
    height: number,
  ) => Promise<boolean>;
  printImage: (
    rgbaData: Uint8ClampedArray,
    width: number,
    height: number,
    filename: string,
  ) => Promise<void>;
  printToPdf: (
    rgbaData: Uint8ClampedArray,
    width: number,
    height: number,
    filename: string,
    pageSize?: PdfPageSize,
  ) => Promise<void>;
}

export function useExport(): UseExportReturn {
  const [isExporting, setIsExporting] = useState(false);
  const [exportPhase, setExportPhase] = useState<ExportPhase>("idle");

  const createExportFileDetailed = useCallback(
    async (request: ExportRequest): Promise<ExportImageDetailedResult> => {
      const emptyDiagnostics: ExportDiagnostics = {
        fallbackApplied: false,
        warnings: [],
        annotationsDrawn: 0,
        watermarkApplied: false,
      };
      try {
        setExportPhase("encoding");
        const encoded = await encodeExportRequest(request);
        if (!encoded.bytes || encoded.bytes.length === 0 || !encoded.extension) {
          return { path: null, diagnostics: encoded.diagnostics };
        }

        setExportPhase("writing");
        const { baseName } = splitFilenameExtension(request.filename);
        const exportDir = getExportDir();
        const outFile = new FSFile(
          exportDir,
          `${(baseName || request.filename).trim()}_export.${encoded.extension}`,
        );
        outFile.write(encoded.bytes);
        return { path: outFile.uri, diagnostics: encoded.diagnostics };
      } catch (error) {
        Logger.warn(LOG_TAGS.Export, "Export failed", error);
        return { path: null, diagnostics: emptyDiagnostics };
      }
    },
    [],
  );

  const createExportFile = useCallback(
    async (request: ExportRequest): Promise<string | null> => {
      const detailed = await createExportFileDetailed(request);
      return detailed.path;
    },
    [createExportFileDetailed],
  );

  const exportImage = useCallback(
    async (...args: ExportInvokeArgs) => {
      setIsExporting(true);
      try {
        const request = normalizeRequest(args.length === 1 ? args[0] : args);
        return await createExportFile(request);
      } finally {
        setExportPhase("idle");
        setIsExporting(false);
      }
    },
    [createExportFile],
  ) as ExportImageFn;

  const exportImageDetailed = useCallback(
    async (request: ExportRequest) => {
      setIsExporting(true);
      try {
        return await createExportFileDetailed(request);
      } finally {
        setExportPhase("idle");
        setIsExporting(false);
      }
    },
    [createExportFileDetailed],
  );

  const shareImage = useCallback(
    async (...args: ExportInvokeArgs) => {
      setIsExporting(true);
      try {
        const request = normalizeRequest(args.length === 1 ? args[0] : args);
        const path = await createExportFile(request);
        if (!path) throw new Error("Failed to create image");
        setExportPhase("sharing");
        const shareOptions: ShareFileOptions = {
          format: request.format,
          filename: request.filename,
        };
        await shareFile(path, shareOptions);
      } finally {
        setExportPhase("idle");
        setIsExporting(false);
      }
    },
    [createExportFile],
  ) as ShareImageFn;

  const saveImage = useCallback(
    async (...args: ExportInvokeArgs) => {
      setIsExporting(true);
      try {
        const request = normalizeRequest(args.length === 1 ? args[0] : args);
        const path = await createExportFile(request);
        if (!path) return null;
        setExportPhase("saving");
        return await saveToMediaLibrary(path);
      } finally {
        setExportPhase("idle");
        setIsExporting(false);
      }
    },
    [createExportFile],
  ) as SaveImageFn;

  const copyImageToClipboard = useCallback(
    async (rgbaData: Uint8ClampedArray, width: number, height: number): Promise<boolean> => {
      setIsExporting(true);
      setExportPhase("copying");
      try {
        const bytes = encodeSkiaPng(rgbaData, width, height);
        if (!bytes || bytes.length === 0) return false;
        const base64 = encodeToBase64(bytes);
        await Clipboard.setImageAsync(base64);
        return true;
      } catch (error) {
        Logger.warn(LOG_TAGS.Export, "Copy to clipboard failed", error);
        return false;
      } finally {
        setExportPhase("idle");
        setIsExporting(false);
      }
    },
    [],
  );

  const createBase64Png = useCallback(
    (rgbaData: Uint8ClampedArray, width: number, height: number): string | null => {
      const bytes = encodeSkiaPng(rgbaData, width, height);
      if (!bytes || bytes.length === 0) return null;
      return encodeToBase64(bytes);
    },
    [],
  );

  const printImage = useCallback(
    async (
      rgbaData: Uint8ClampedArray,
      width: number,
      height: number,
      filename: string,
    ): Promise<void> => {
      setIsExporting(true);
      setExportPhase("printing");
      try {
        const base64 = createBase64Png(rgbaData, width, height);
        if (!base64) throw new Error("Failed to encode image");
        const html = buildPrintHtml(base64, filename, width, height);
        const orientation =
          width > height ? Print.Orientation.landscape : Print.Orientation.portrait;
        await Print.printAsync({
          html,
          ...(Platform.OS === "ios" ? { orientation } : {}),
        });
      } finally {
        setExportPhase("idle");
        setIsExporting(false);
      }
    },
    [createBase64Png],
  );

  const printToPdf = useCallback(
    async (
      rgbaData: Uint8ClampedArray,
      width: number,
      height: number,
      filename: string,
      pageSize: PdfPageSize = "letter",
    ): Promise<void> => {
      setIsExporting(true);
      try {
        const base64 = createBase64Png(rgbaData, width, height);
        if (!base64) throw new Error("Failed to encode image");
        const html = buildPrintHtml(base64, filename, width, height);
        const dims = PDF_PAGE_DIMENSIONS[pageSize];
        const { uri } = await Print.printToFileAsync({
          html,
          width: dims.width,
          height: dims.height,
        });
        await shareFile(uri);
      } finally {
        setExportPhase("idle");
        setIsExporting(false);
      }
    },
    [createBase64Png],
  );

  return {
    isExporting,
    exportPhase,
    exportImage,
    exportImageDetailed,
    shareImage,
    saveImage,
    copyImageToClipboard,
    printImage,
    printToPdf,
  };
}
