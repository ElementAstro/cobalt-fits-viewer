/**
 * FITS 文件加载 Hook
 */

import { useState, useCallback } from "react";
import { FITS } from "fitsjs-ng";
import {
  loadFitsFromBuffer,
  extractMetadata,
  getHeaderKeywords,
  getImagePixels,
  getImageDimensions,
  getHDUList,
} from "../lib/fits/parser";
import type { FitsMetadata, HeaderKeyword } from "../lib/fits/types";
import { readFileAsArrayBuffer } from "../lib/utils/fileManager";
import { generateFileId } from "../lib/utils/fileManager";
import { LOG_TAGS, Logger } from "../lib/logger";
import {
  detectPreferredSupportedImageFormat,
  detectSupportedImageFormat,
  toImageSourceFormat,
} from "../lib/import/fileFormat";
import { extractRasterMetadata, parseRasterFromBuffer } from "../lib/image/rasterParser";

interface UseFitsFileReturn {
  fits: FITS | null;
  metadata: FitsMetadata | null;
  headers: HeaderKeyword[];
  pixels: Float32Array | null;
  dimensions: { width: number; height: number; depth: number; isDataCube: boolean } | null;
  hduList: Array<{ index: number; type: string | null; hasData: boolean }>;
  isLoading: boolean;
  error: string | null;
  loadFromPath: (filepath: string, filename: string, fileSize: number) => Promise<void>;
  loadFromBuffer: (buffer: ArrayBuffer, filename: string, fileSize: number) => Promise<void>;
  loadFrame: (frame: number, hduIndex?: number) => Promise<void>;
  reset: () => void;
}

export function useFitsFile(): UseFitsFileReturn {
  const [fits, setFits] = useState<FITS | null>(null);
  const [metadata, setMetadata] = useState<FitsMetadata | null>(null);
  const [headers, setHeaders] = useState<HeaderKeyword[]>([]);
  const [pixels, setPixels] = useState<Float32Array | null>(null);
  const [dimensions, setDimensions] = useState<ReturnType<typeof getImageDimensions>>(null);
  const [hduList, setHduList] = useState<
    Array<{ index: number; type: string | null; hasData: boolean }>
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const processFits = useCallback(
    (
      fitsObj: FITS,
      filename: string,
      filepath: string,
      fileSize: number,
      sourceFormat?: FitsMetadata["sourceFormat"],
    ) => {
      setFits(fitsObj);

      const meta = extractMetadata(fitsObj, { filename, filepath, fileSize });
      const fullMeta: FitsMetadata = {
        ...meta,
        id: generateFileId(),
        importDate: Date.now(),
        isFavorite: false,
        tags: [],
        albumIds: [],
        sourceType: "fits",
        sourceFormat: sourceFormat ?? "unknown",
      };
      setMetadata(fullMeta);
      setHeaders(getHeaderKeywords(fitsObj));
      setHduList(getHDUList(fitsObj));

      const dims = getImageDimensions(fitsObj);
      setDimensions(dims);

      return { fitsObj, fullMeta };
    },
    [],
  );

  const processRaster = useCallback(
    (
      buffer: ArrayBuffer,
      filename: string,
      filepath: string,
      fileSize: number,
      sourceFormat?: FitsMetadata["sourceFormat"],
    ) => {
      const decoded = parseRasterFromBuffer(buffer);
      setFits(null);
      setHeaders([]);
      setHduList([]);
      setDimensions({
        width: decoded.width,
        height: decoded.height,
        depth: 1,
        isDataCube: false,
      });
      setPixels(decoded.pixels);

      const detectedFormat = detectSupportedImageFormat(filename);
      const meta = extractRasterMetadata(
        { filename, filepath, fileSize },
        { width: decoded.width, height: decoded.height },
      );
      const fullMeta: FitsMetadata = {
        ...meta,
        id: generateFileId(),
        importDate: Date.now(),
        isFavorite: false,
        tags: [],
        albumIds: [],
        sourceType: "raster",
        sourceFormat: sourceFormat ?? toImageSourceFormat(detectedFormat),
      };
      setMetadata(fullMeta);
    },
    [],
  );

  const loadFromPath = useCallback(
    async (filepath: string, filename: string, fileSize: number) => {
      setIsLoading(true);
      setError(null);
      try {
        const buffer = await readFileAsArrayBuffer(filepath);
        const detectedFormat = detectPreferredSupportedImageFormat({ filename, payload: buffer });
        if (!detectedFormat) {
          throw new Error("Unsupported image format");
        }

        if (detectedFormat.sourceType === "fits") {
          const fitsObj = loadFitsFromBuffer(buffer);
          const sourceFormat = toImageSourceFormat(detectedFormat);
          const { fitsObj: f } = processFits(fitsObj, filename, filepath, fileSize, sourceFormat);
          const px = await getImagePixels(f);
          setPixels(px);
        } else {
          processRaster(buffer, filename, filepath, fileSize, toImageSourceFormat(detectedFormat));
        }
        Logger.info(LOG_TAGS.FitsFile, `Loaded: ${filename}`, {
          fileSize,
          format: detectedFormat.id,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to load image file";
        Logger.error(LOG_TAGS.FitsFile, `Load failed: ${filename}`, e);
        setError(msg);
      } finally {
        setIsLoading(false);
      }
    },
    [processFits, processRaster],
  );

  const loadFromBuffer = useCallback(
    async (buffer: ArrayBuffer, filename: string, fileSize: number) => {
      setIsLoading(true);
      setError(null);
      try {
        const detectedFormat = detectPreferredSupportedImageFormat({ filename, payload: buffer });
        if (!detectedFormat) {
          throw new Error("Unsupported image format");
        }

        if (detectedFormat.sourceType === "fits") {
          const fitsObj = loadFitsFromBuffer(buffer);
          const sourceFormat = toImageSourceFormat(detectedFormat);
          const { fitsObj: f } = processFits(
            fitsObj,
            filename,
            `memory://${filename}`,
            fileSize,
            sourceFormat,
          );
          const px = await getImagePixels(f);
          setPixels(px);
        } else {
          processRaster(
            buffer,
            filename,
            `memory://${filename}`,
            fileSize,
            toImageSourceFormat(detectedFormat),
          );
        }
        Logger.info(LOG_TAGS.FitsFile, `Loaded from buffer: ${filename}`, {
          format: detectedFormat.id,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to parse image data";
        Logger.error(LOG_TAGS.FitsFile, `Buffer load failed: ${filename}`, e);
        setError(msg);
      } finally {
        setIsLoading(false);
      }
    },
    [processFits, processRaster],
  );

  const loadFrame = useCallback(
    async (frame: number, hduIndex?: number) => {
      if (!fits) return;
      setIsLoading(true);
      try {
        const dims = getImageDimensions(fits, hduIndex);
        if (dims) setDimensions(dims);
        const px = await getImagePixels(fits, hduIndex, frame);
        setPixels(px);
        Logger.debug(LOG_TAGS.FitsFile, `Frame loaded: ${frame}`, { hduIndex });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to load frame";
        Logger.error(LOG_TAGS.FitsFile, `Frame load failed: ${frame}`, e);
        setError(msg);
      } finally {
        setIsLoading(false);
      }
    },
    [fits],
  );

  const reset = useCallback(() => {
    setFits(null);
    setMetadata(null);
    setHeaders([]);
    setPixels(null);
    setDimensions(null);
    setHduList([]);
    setError(null);
  }, []);

  return {
    fits,
    metadata,
    headers,
    pixels,
    dimensions,
    hduList,
    isLoading,
    error,
    loadFromPath,
    loadFromBuffer,
    loadFrame,
    reset,
  };
}
