/**
 * 文件管理 Hook
 * 完整流水线: DocumentPicker → copy → FITS parse → metadata → store → auto-detect target
 * 支持: 文件导入、文件夹导入、ZIP 导入、URL 下载
 */

import { useState, useCallback, useRef } from "react";
import { InteractionManager } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { File, Directory, Paths } from "expo-file-system";
import { Logger } from "../lib/logger";
import { useFitsStore } from "../stores/useFitsStore";
import { useTargetStore } from "../stores/useTargetStore";
import { useSettingsStore } from "../stores/useSettingsStore";
import {
  importFile,
  deleteFile,
  deleteFiles,
  generateFileId,
  scanDirectoryForFits,
  getTempExtractDir,
  cleanTempExtractDir,
} from "../lib/utils/fileManager";
import { computeQuickHash, findDuplicateOnImport } from "../lib/gallery/duplicateDetector";
import {
  loadFitsFromBuffer,
  extractMetadata,
  getImagePixels,
  getImageDimensions,
} from "../lib/fits/parser";
import { fitsToRGBA } from "../lib/converter/formatConverter";
import {
  generateAndSaveThumbnail,
  deleteThumbnail,
  deleteThumbnails,
} from "../lib/gallery/thumbnailCache";
import { autoDetectTarget } from "../lib/targets/targetManager";
import { findKnownAliases } from "../lib/targets/targetMatcher";
import { LocationService } from "./useLocation";
import type { FitsMetadata } from "../lib/fits/types";

export interface ImportProgress {
  phase: "picking" | "extracting" | "scanning" | "importing" | "downloading";
  percent: number;
  currentFile?: string;
  current: number;
  total: number;
}

export interface ImportResult {
  success: number;
  failed: number;
  total: number;
}

export function useFileManager() {
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<ImportProgress>({
    phase: "picking",
    percent: 0,
    current: 0,
    total: 0,
  });
  const [importError, setImportError] = useState<string | null>(null);
  const [lastImportResult, setLastImportResult] = useState<ImportResult | null>(null);
  const cancelRef = useRef(false);

  const addFile = useFitsStore((s) => s.addFile);
  const removeFile = useFitsStore((s) => s.removeFile);
  const removeFiles = useFitsStore((s) => s.removeFiles);
  const files = useFitsStore((s) => s.files);

  const addTarget = useTargetStore((s) => s.addTarget);
  const addImageToTarget = useTargetStore((s) => s.addImageToTarget);
  const addAlias = useTargetStore((s) => s.addAlias);

  const autoGroupByObject = useSettingsStore((s) => s.autoGroupByObject);
  const autoTagLocation = useSettingsStore((s) => s.autoTagLocation);
  const autoDetectDuplicates = useSettingsStore((s) => s.autoDetectDuplicates);
  const thumbnailSize = useSettingsStore((s) => s.thumbnailSize);
  const thumbnailQuality = useSettingsStore((s) => s.thumbnailQuality);
  const cancelImport = useCallback(() => {
    cancelRef.current = true;
  }, []);

  const fetchLocationForImport = useCallback(async () => {
    const loc = await LocationService.getCurrentLocation();
    return loc ?? undefined;
  }, []);

  const processAndImportFile = useCallback(
    async (uri: string, name: string, size?: number): Promise<boolean> => {
      try {
        const importedFile = importFile(uri, name);
        const buffer = await importedFile.arrayBuffer();

        // Duplicate detection
        const hash = computeQuickHash(buffer, size ?? buffer.byteLength);
        if (autoDetectDuplicates) {
          const currentFiles = useFitsStore.getState().files;
          const duplicate = findDuplicateOnImport(hash, currentFiles);
          if (duplicate) {
            Logger.info(
              "FileManager",
              `Skipping duplicate: ${name} (matches ${duplicate.filename})`,
            );
            return false;
          }
        }

        const fitsObj = loadFitsFromBuffer(buffer);
        const partialMeta = extractMetadata(fitsObj, {
          filename: name,
          filepath: importedFile.uri,
          fileSize: size ?? buffer.byteLength,
        });

        const fileId = generateFileId();
        const location = autoTagLocation ? await fetchLocationForImport() : undefined;

        const fullMeta: FitsMetadata = {
          ...partialMeta,
          id: fileId,
          importDate: Date.now(),
          isFavorite: false,
          tags: [],
          albumIds: [],
          location,
          thumbnailUri: undefined,
          hash,
        };

        addFile(fullMeta);

        // Defer thumbnail generation and quality evaluation to avoid blocking UI
        const capturedThumbSize = thumbnailSize;
        const capturedThumbQuality = thumbnailQuality;
        InteractionManager.runAfterInteractions(async () => {
          try {
            const dims = getImageDimensions(fitsObj);
            if (dims) {
              const pixels = await getImagePixels(fitsObj);
              if (pixels) {
                const rgba = fitsToRGBA(pixels, dims.width, dims.height, {
                  stretch: "asinh",
                  colormap: "grayscale",
                  blackPoint: 0,
                  whitePoint: 1,
                  gamma: 1,
                });
                const thumbUri = generateAndSaveThumbnail(
                  fileId,
                  rgba,
                  dims.width,
                  dims.height,
                  capturedThumbSize,
                  capturedThumbQuality,
                );
                const updates: Partial<FitsMetadata> = {};
                if (thumbUri) {
                  updates.thumbnailUri = thumbUri;
                }

                // Quality evaluation (only for light frames)
                try {
                  const meta = useFitsStore.getState().getFileById(fileId);
                  if (meta && meta.frameType === "light" && pixels instanceof Float32Array) {
                    const { evaluateFrameQuality } = require("../lib/stacking/frameQuality");
                    const quality = evaluateFrameQuality(pixels, dims.width, dims.height);
                    updates.qualityScore = quality.score;
                  }
                } catch {
                  // Quality evaluation failure is non-critical
                }

                if (Object.keys(updates).length > 0) {
                  useFitsStore.getState().updateFile(fileId, updates);
                }
              }
            }
          } catch {
            // Thumbnail generation failure is non-critical
          }
        });

        if (autoGroupByObject) {
          const currentTargets = useTargetStore.getState().targets;
          const detection = autoDetectTarget(fullMeta, currentTargets);
          if (detection) {
            if (detection.isNew) {
              addTarget(detection.target);
              addImageToTarget(detection.target.id, fileId);
              const aliases = findKnownAliases(detection.target.name);
              for (const alias of aliases) {
                addAlias(detection.target.id, alias);
              }
            } else {
              addImageToTarget(detection.target.id, fileId);
            }
          }
        }

        return true;
      } catch (err) {
        Logger.warn("FileManager", `Failed to import ${name}`, err);
        return false;
      }
    },
    [
      addFile,
      autoGroupByObject,
      autoTagLocation,
      autoDetectDuplicates,
      thumbnailSize,
      thumbnailQuality,
      fetchLocationForImport,
      addTarget,
      addImageToTarget,
      addAlias,
    ],
  );

  const importBatch = useCallback(
    async (
      fileEntries: Array<{ uri: string; name: string; size?: number }>,
    ): Promise<ImportResult> => {
      const total = fileEntries.length;
      let success = 0;
      let failed = 0;

      for (let i = 0; i < total; i++) {
        if (cancelRef.current) break;

        const entry = fileEntries[i];
        setImportProgress({
          phase: "importing",
          percent: Math.round(((i + 1) / total) * 100),
          currentFile: entry.name,
          current: i + 1,
          total,
        });

        const ok = await processAndImportFile(entry.uri, entry.name, entry.size);
        if (ok) success++;
        else failed++;
      }

      return { success, failed, total };
    },
    [processAndImportFile],
  );

  const pickAndImportFile = useCallback(async () => {
    setIsImporting(true);
    setImportError(null);
    setLastImportResult(null);
    cancelRef.current = false;

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
        multiple: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        setIsImporting(false);
        return;
      }

      const entries = result.assets.map((a) => ({
        uri: a.uri,
        name: a.name,
        size: a.size,
      }));

      const importResult = await importBatch(entries);
      setLastImportResult(importResult);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setIsImporting(false);
    }
  }, [importBatch]);

  const pickAndImportFolder = useCallback(async () => {
    setIsImporting(true);
    setImportError(null);
    setLastImportResult(null);
    cancelRef.current = false;

    try {
      setImportProgress({
        phase: "scanning",
        percent: 0,
        current: 0,
        total: 0,
      });

      const picked = await (
        Directory as unknown as {
          pickDirectoryAsync: (initialUri?: string) => Promise<Directory | null>;
        }
      ).pickDirectoryAsync();
      if (!picked) {
        setIsImporting(false);
        return;
      }

      const fitsFiles = scanDirectoryForFits(picked);
      if (fitsFiles.length === 0) {
        setImportError("noFitsInFolder");
        setIsImporting(false);
        return;
      }

      const entries = fitsFiles.map((f) => ({
        uri: f.uri,
        name: f.name,
        size: f.size ?? undefined,
      }));

      const importResult = await importBatch(entries);
      setLastImportResult(importResult);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Folder import failed");
    } finally {
      setIsImporting(false);
    }
  }, [importBatch]);

  const pickAndImportZip = useCallback(async () => {
    setIsImporting(true);
    setImportError(null);
    setLastImportResult(null);
    cancelRef.current = false;

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/zip",
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        setIsImporting(false);
        return;
      }

      const zipAsset = result.assets[0];

      setImportProgress({
        phase: "extracting",
        percent: 0,
        currentFile: zipAsset.name,
        current: 0,
        total: 0,
      });

      let unzipFn: (source: string, target: string) => Promise<string>;
      try {
        const zipArchive = require("react-native-zip-archive");
        unzipFn = zipArchive.unzip;
      } catch {
        setImportError(
          "react-native-zip-archive is not installed. Please install it to use ZIP import.",
        );
        setIsImporting(false);
        return;
      }

      const tempDir = getTempExtractDir();
      await unzipFn(zipAsset.uri, tempDir.uri);

      setImportProgress({
        phase: "scanning",
        percent: 50,
        currentFile: zipAsset.name,
        current: 0,
        total: 0,
      });

      const fitsFiles = scanDirectoryForFits(tempDir);
      if (fitsFiles.length === 0) {
        cleanTempExtractDir();
        setImportError("noFitsInZip");
        setIsImporting(false);
        return;
      }

      const entries = fitsFiles.map((f) => ({
        uri: f.uri,
        name: f.name,
        size: f.size ?? undefined,
      }));

      const importResult = await importBatch(entries);
      setLastImportResult(importResult);

      cleanTempExtractDir();
    } catch (err) {
      cleanTempExtractDir();
      setImportError(err instanceof Error ? err.message : "ZIP import failed");
    } finally {
      setIsImporting(false);
    }
  }, [importBatch]);

  const importFromUrl = useCallback(
    async (url: string) => {
      const trimmed = url.trim();
      if (!/^https?:\/\/.+/i.test(trimmed)) {
        setImportError("Invalid URL. Only HTTP and HTTPS URLs are supported.");
        return;
      }

      setIsImporting(true);
      setImportError(null);
      setLastImportResult(null);
      cancelRef.current = false;

      try {
        setImportProgress({
          phase: "downloading",
          percent: 0,
          currentFile: url.split("/").pop() ?? "download",
          current: 0,
          total: 1,
        });

        const filename = url.split("/").pop() ?? `download_${Date.now()}.fits`;
        const destFile = new File(Paths.cache, filename);

        await File.downloadFileAsync(url, destFile);

        setImportProgress({
          phase: "importing",
          percent: 50,
          currentFile: filename,
          current: 1,
          total: 1,
        });

        const ok = await processAndImportFile(destFile.uri, filename, destFile.size ?? undefined);
        setLastImportResult({
          success: ok ? 1 : 0,
          failed: ok ? 0 : 1,
          total: 1,
        });

        if (destFile.exists) {
          destFile.delete();
        }
      } catch (err) {
        setImportError(err instanceof Error ? err.message : "Download failed");
      } finally {
        setIsImporting(false);
      }
    },
    [processAndImportFile],
  );

  const handleDeleteFile = useCallback(
    (fileId: string) => {
      const file = files.find((f) => f.id === fileId);
      if (file) {
        deleteFile(file.filepath);
        deleteThumbnail(fileId);
        removeFile(fileId);
      }
    },
    [files, removeFile],
  );

  const handleDeleteFiles = useCallback(
    (fileIds: string[]) => {
      const paths = files.filter((f) => fileIds.includes(f.id)).map((f) => f.filepath);
      deleteFiles(paths);
      deleteThumbnails(fileIds);
      removeFiles(fileIds);
    },
    [files, removeFiles],
  );

  return {
    isImporting,
    importProgress,
    importError,
    lastImportResult,
    pickAndImportFile,
    pickAndImportFolder,
    pickAndImportZip,
    importFromUrl,
    cancelImport,
    handleDeleteFile,
    handleDeleteFiles,
  };
}
