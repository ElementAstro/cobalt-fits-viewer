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
    (fitsObj: FITS, filename: string, filepath: string, fileSize: number) => {
      setFits(fitsObj);

      const meta = extractMetadata(fitsObj, { filename, filepath, fileSize });
      const fullMeta: FitsMetadata = {
        ...meta,
        id: generateFileId(),
        importDate: Date.now(),
        isFavorite: false,
        tags: [],
        albumIds: [],
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

  const loadFromPath = useCallback(
    async (filepath: string, filename: string, fileSize: number) => {
      setIsLoading(true);
      setError(null);
      try {
        const buffer = await readFileAsArrayBuffer(filepath);
        const fitsObj = loadFitsFromBuffer(buffer);
        const { fitsObj: f } = processFits(fitsObj, filename, filepath, fileSize);

        const px = await getImagePixels(f);
        setPixels(px);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load FITS file");
      } finally {
        setIsLoading(false);
      }
    },
    [processFits],
  );

  const loadFromBuffer = useCallback(
    async (buffer: ArrayBuffer, filename: string, fileSize: number) => {
      setIsLoading(true);
      setError(null);
      try {
        const fitsObj = loadFitsFromBuffer(buffer);
        const { fitsObj: f } = processFits(fitsObj, filename, `memory://${filename}`, fileSize);

        const px = await getImagePixels(f);
        setPixels(px);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to parse FITS data");
      } finally {
        setIsLoading(false);
      }
    },
    [processFits],
  );

  const loadFrame = useCallback(
    async (frame: number, hduIndex?: number) => {
      if (!fits) return;
      setIsLoading(true);
      try {
        const px = await getImagePixels(fits, hduIndex, frame);
        setPixels(px);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load frame");
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
