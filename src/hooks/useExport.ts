/**
 * FITS 图像导出 Hook
 * 支持导出为 PNG/JPEG 并保存到设备或分享
 */

import { useState, useCallback } from "react";
import { Platform } from "react-native";
import { Skia, AlphaType, ColorType, ImageFormat } from "@shopify/react-native-skia";
import { File as FSFile } from "expo-file-system";
import * as Print from "expo-print";
import { LOG_TAGS, Logger } from "../lib/logger";
import type { ExportFormat } from "../lib/fits/types";
import {
  shareFile,
  saveToMediaLibrary,
  getExportDir,
  getExtension as getExtUtil,
  type ShareFileOptions,
} from "../lib/utils/imageExport";

function resolveSkiaFormat(format: ExportFormat): {
  fmt: (typeof ImageFormat)[keyof typeof ImageFormat];
  fallbackExt: string;
} {
  switch (format) {
    case "jpeg":
      return { fmt: ImageFormat.JPEG, fallbackExt: "jpg" };
    case "webp":
      return { fmt: ImageFormat.WEBP, fallbackExt: "webp" };
    case "png":
    default:
      // TIFF/BMP not natively supported by Skia — fall back to PNG
      return { fmt: ImageFormat.PNG, fallbackExt: "png" };
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
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

interface UseExportReturn {
  isExporting: boolean;
  exportImage: (
    rgbaData: Uint8ClampedArray,
    width: number,
    height: number,
    filename: string,
    format: ExportFormat,
    quality?: number,
  ) => Promise<string | null>;
  shareImage: (
    rgbaData: Uint8ClampedArray,
    width: number,
    height: number,
    filename: string,
    format: ExportFormat,
    quality?: number,
  ) => Promise<void>;
  saveImage: (
    rgbaData: Uint8ClampedArray,
    width: number,
    height: number,
    filename: string,
    format: ExportFormat,
    quality?: number,
  ) => Promise<string | null>;
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
  ) => Promise<void>;
}

export function useExport(): UseExportReturn {
  const [isExporting, setIsExporting] = useState(false);

  const createImageFile = useCallback(
    async (
      rgbaData: Uint8ClampedArray,
      width: number,
      height: number,
      filename: string,
      format: ExportFormat,
      quality?: number,
    ): Promise<string | null> => {
      try {
        const data = Skia.Data.fromBytes(new Uint8Array(rgbaData.buffer));
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

        const { fmt } = resolveSkiaFormat(format);
        const q = resolveQuality(format, quality);
        const bytes = skImage.encodeToBytes(fmt, q);

        if (!bytes || bytes.length === 0) return null;

        const ext = getExtUtil(format);
        const baseName = filename.replace(/\.[^.]+$/, "");
        const exportDir = getExportDir();
        const outFile = new FSFile(exportDir, `${baseName}_export.${ext}`);
        outFile.write(bytes);

        return outFile.uri;
      } catch (e) {
        Logger.warn(LOG_TAGS.Export, "Export failed", e);
        return null;
      }
    },
    [],
  );

  const exportImage = useCallback(
    async (
      rgbaData: Uint8ClampedArray,
      width: number,
      height: number,
      filename: string,
      format: ExportFormat,
      quality?: number,
    ): Promise<string | null> => {
      setIsExporting(true);
      try {
        return await createImageFile(rgbaData, width, height, filename, format, quality);
      } finally {
        setIsExporting(false);
      }
    },
    [createImageFile],
  );

  const shareImage = useCallback(
    async (
      rgbaData: Uint8ClampedArray,
      width: number,
      height: number,
      filename: string,
      format: ExportFormat,
      quality?: number,
    ): Promise<void> => {
      setIsExporting(true);
      try {
        const path = await createImageFile(rgbaData, width, height, filename, format, quality);
        if (!path) throw new Error("Failed to create image");
        const shareOptions: ShareFileOptions = {
          format,
          filename,
        };
        await shareFile(path, shareOptions);
      } finally {
        setIsExporting(false);
      }
    },
    [createImageFile],
  );

  const saveImage = useCallback(
    async (
      rgbaData: Uint8ClampedArray,
      width: number,
      height: number,
      filename: string,
      format: ExportFormat,
      quality?: number,
    ): Promise<string | null> => {
      setIsExporting(true);
      try {
        const path = await createImageFile(rgbaData, width, height, filename, format, quality);
        if (!path) return null;
        return await saveToMediaLibrary(path);
      } finally {
        setIsExporting(false);
      }
    },
    [createImageFile],
  );

  const createBase64Png = useCallback(
    (rgbaData: Uint8ClampedArray, width: number, height: number): string | null => {
      try {
        const data = Skia.Data.fromBytes(new Uint8Array(rgbaData.buffer));
        const skImage = Skia.Image.MakeImage(
          { width, height, alphaType: AlphaType.Unpremul, colorType: ColorType.RGBA_8888 },
          data,
          width * 4,
        );
        if (!skImage) return null;
        const bytes = skImage.encodeToBytes(ImageFormat.PNG, 100);
        if (!bytes || bytes.length === 0) return null;
        return encodeToBase64(bytes);
      } catch (e) {
        Logger.warn(LOG_TAGS.Export, "Base64 encoding failed", e);
        return null;
      }
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
    ): Promise<void> => {
      setIsExporting(true);
      try {
        const base64 = createBase64Png(rgbaData, width, height);
        if (!base64) throw new Error("Failed to encode image");
        const html = buildPrintHtml(base64, filename, width, height);
        const { uri } = await Print.printToFileAsync({
          html,
          width: 612,
          height: 792,
        });
        await shareFile(uri);
      } finally {
        setIsExporting(false);
      }
    },
    [createBase64Png],
  );

  return {
    isExporting,
    exportImage,
    shareImage,
    saveImage,
    printImage,
    printToPdf,
  };
}
