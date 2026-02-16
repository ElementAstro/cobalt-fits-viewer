/**
 * 文件管理 Hook
 * 完整流水线: DocumentPicker → copy → parse → metadata → store → auto-detect target
 * 支持: 文件导入、文件夹导入、ZIP 导入、URL 下载
 */

import { useState, useCallback, useRef, useMemo } from "react";
import { InteractionManager } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { File, Directory, Paths } from "expo-file-system";
import { Logger } from "../lib/logger";
import { useFitsStore } from "../stores/useFitsStore";
import { useTargetStore } from "../stores/useTargetStore";
import { useSettingsStore } from "../stores/useSettingsStore";
import { useAlbumStore } from "../stores/useAlbumStore";
import { useSessionStore } from "../stores/useSessionStore";
import {
  importFile,
  deleteFile,
  deleteFiles,
  renameFitsFile,
  generateFileId,
  scanDirectoryForSupportedImages,
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
import { detectSupportedImageFormat, toImageSourceFormat } from "../lib/import/fileFormat";
import { extractRasterMetadata, parseRasterFromBuffer } from "../lib/image/rasterParser";

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
  skippedDuplicate: number;
  skippedUnsupported: number;
  failedEntries?: Array<{ name: string; reason: string }>;
}

interface RenameOperation {
  fileId: string;
  filename: string;
}

interface RenameResult {
  success: number;
  failed: number;
}

type ImportFileStatus = "imported" | "duplicate" | "unsupported" | "failed";

interface ImportFileOutcome {
  status: ImportFileStatus;
  reason?: string;
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
  const updateFile = useFitsStore((s) => s.updateFile);
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

  const isZipImportAvailable = useMemo(() => {
    try {
      require("react-native-zip-archive");
      return true;
    } catch {
      return false;
    }
  }, []);

  const cancelImport = useCallback(() => {
    cancelRef.current = true;
  }, []);

  const fetchLocationForImport = useCallback(async () => {
    const loc = await LocationService.getCurrentLocation();
    return loc ?? undefined;
  }, []);

  const processAndImportFile = useCallback(
    async (uri: string, name: string, size?: number): Promise<ImportFileOutcome> => {
      const detectedFormat = detectSupportedImageFormat(name);
      if (!detectedFormat) {
        Logger.info("FileManager", `Skipping unsupported file: ${name}`);
        return { status: "unsupported", reason: "unsupported_format" };
      }

      let importedFile: File | null = null;
      try {
        importedFile = importFile(uri, name);
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
            if (importedFile.exists) {
              importedFile.delete();
            }
            return { status: "duplicate", reason: "duplicate" };
          }
        }

        let fullMeta: FitsMetadata;
        const fileId = generateFileId();
        const location = autoTagLocation ? await fetchLocationForImport() : undefined;

        // Defer thumbnail generation and quality evaluation to avoid blocking UI
        const capturedThumbSize = thumbnailSize;
        const capturedThumbQuality = thumbnailQuality;

        if (detectedFormat.sourceType === "fits") {
          const fitsObj = loadFitsFromBuffer(buffer);
          const partialMeta = extractMetadata(fitsObj, {
            filename: name,
            filepath: importedFile.uri,
            fileSize: size ?? buffer.byteLength,
          });

          fullMeta = {
            ...partialMeta,
            id: fileId,
            importDate: Date.now(),
            isFavorite: false,
            tags: [],
            albumIds: [],
            location,
            thumbnailUri: undefined,
            hash,
            sourceType: "fits",
            sourceFormat: toImageSourceFormat(detectedFormat),
          };

          addFile(fullMeta);

          InteractionManager.runAfterInteractions(async () => {
            try {
              const dims = getImageDimensions(fitsObj);
              if (!dims) return;
              const pixels = await getImagePixels(fitsObj);
              if (!pixels) return;

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
              if (thumbUri) updates.thumbnailUri = thumbUri;

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
            } catch {
              // Thumbnail generation failure is non-critical
            }
          });
        } else {
          const decoded = parseRasterFromBuffer(buffer);
          const partialMeta = extractRasterMetadata(
            {
              filename: name,
              filepath: importedFile.uri,
              fileSize: size ?? buffer.byteLength,
            },
            { width: decoded.width, height: decoded.height },
          );

          fullMeta = {
            ...partialMeta,
            id: fileId,
            importDate: Date.now(),
            isFavorite: false,
            tags: [],
            albumIds: [],
            location,
            thumbnailUri: undefined,
            hash,
            sourceType: "raster",
            sourceFormat: toImageSourceFormat(detectedFormat),
          };

          addFile(fullMeta);

          const rgba = new Uint8ClampedArray(
            decoded.rgba.buffer,
            decoded.rgba.byteOffset,
            decoded.rgba.byteLength,
          );
          InteractionManager.runAfterInteractions(() => {
            const thumbUri = generateAndSaveThumbnail(
              fileId,
              rgba,
              decoded.width,
              decoded.height,
              capturedThumbSize,
              capturedThumbQuality,
            );

            const updates: Partial<FitsMetadata> = {};
            if (thumbUri) updates.thumbnailUri = thumbUri;

            try {
              const meta = useFitsStore.getState().getFileById(fileId);
              if (meta && meta.frameType === "light") {
                const { evaluateFrameQuality } = require("../lib/stacking/frameQuality");
                const quality = evaluateFrameQuality(decoded.pixels, decoded.width, decoded.height);
                updates.qualityScore = quality.score;
              }
            } catch {
              // Quality evaluation failure is non-critical
            }

            if (Object.keys(updates).length > 0) {
              useFitsStore.getState().updateFile(fileId, updates);
            }
          });
        }

        if (autoGroupByObject) {
          try {
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
          } catch (e) {
            Logger.warn("FileManager", `Auto target detection failed for ${name}`, e);
          }
        }

        return { status: "imported" };
      } catch (err) {
        if (importedFile?.exists) {
          importedFile.delete();
        }
        Logger.warn("FileManager", `Failed to import ${name}`, err);
        return {
          status: "failed",
          reason: err instanceof Error ? err.message : "unknown_error",
        };
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
      const totalRequested = fileEntries.length;
      let processed = 0;
      let success = 0;
      let failed = 0;
      let skippedDuplicate = 0;
      let skippedUnsupported = 0;
      const failedEntries: Array<{ name: string; reason: string }> = [];

      for (let i = 0; i < totalRequested; i++) {
        if (cancelRef.current) break;
        processed++;

        const entry = fileEntries[i];
        setImportProgress({
          phase: "importing",
          percent: Math.round((processed / totalRequested) * 100),
          currentFile: entry.name,
          current: processed,
          total: totalRequested,
        });

        const outcome = await processAndImportFile(entry.uri, entry.name, entry.size);
        if (outcome.status === "imported") {
          success++;
        } else if (outcome.status === "duplicate") {
          skippedDuplicate++;
        } else if (outcome.status === "unsupported") {
          skippedUnsupported++;
        } else {
          failed++;
          failedEntries.push({
            name: entry.name,
            reason: outcome.reason ?? "unknown_error",
          });
        }
      }

      return {
        success,
        failed,
        total: processed,
        skippedDuplicate,
        skippedUnsupported,
        failedEntries: failedEntries.length > 0 ? failedEntries : undefined,
      };
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

      const imageFiles = scanDirectoryForSupportedImages(picked);
      if (imageFiles.length === 0) {
        setImportError("noSupportedInFolder");
        setIsImporting(false);
        return;
      }

      const entries = imageFiles.map((f) => ({
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
    if (!isZipImportAvailable) {
      setImportError("zipImportUnavailable");
      return;
    }

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
        setImportError("zipImportUnavailable");
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

      const imageFiles = scanDirectoryForSupportedImages(tempDir);
      if (imageFiles.length === 0) {
        cleanTempExtractDir();
        setImportError("noSupportedInZip");
        setIsImporting(false);
        return;
      }

      const entries = imageFiles.map((f) => ({
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
  }, [importBatch, isZipImportAvailable]);

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
        const parsed = new URL(trimmed);
        const rawName = decodeURIComponent(parsed.pathname.split("/").pop() ?? "").trim();
        const safeNameBase = rawName || `download_${Date.now()}`;
        const safeName = safeNameBase
          .replace(/[<>:"/\\|?*]/g, "_")
          .split("")
          .map((char) => (char.charCodeAt(0) <= 31 ? "_" : char))
          .join("");

        setImportProgress({
          phase: "downloading",
          percent: 0,
          currentFile: safeName,
          current: 0,
          total: 1,
        });

        const destFile = new File(Paths.cache, safeName);

        await File.downloadFileAsync(trimmed, destFile);

        setImportProgress({
          phase: "importing",
          percent: 50,
          currentFile: safeName,
          current: 1,
          total: 1,
        });

        const outcome = await processAndImportFile(
          destFile.uri,
          safeName,
          destFile.size ?? undefined,
        );
        const success = outcome.status === "imported" ? 1 : 0;
        const failed = outcome.status === "failed" ? 1 : 0;
        setLastImportResult({
          success,
          failed,
          total: 1,
          skippedDuplicate: outcome.status === "duplicate" ? 1 : 0,
          skippedUnsupported: outcome.status === "unsupported" ? 1 : 0,
          failedEntries:
            outcome.status === "failed"
              ? [{ name: safeName, reason: outcome.reason ?? "unknown_error" }]
              : undefined,
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

  const cleanupReferences = useCallback((fileIds: string[]) => {
    if (fileIds.length === 0) return;
    const idSet = new Set(fileIds);

    useAlbumStore.setState((state) => ({
      albums: state.albums.map((album) => {
        const nextImageIds = album.imageIds.filter((id) => !idSet.has(id));
        const coverRemoved = album.coverImageId ? idSet.has(album.coverImageId) : false;
        if (nextImageIds.length === album.imageIds.length && !coverRemoved) return album;
        return {
          ...album,
          imageIds: nextImageIds,
          coverImageId: coverRemoved ? undefined : album.coverImageId,
          updatedAt:
            nextImageIds.length !== album.imageIds.length || coverRemoved
              ? Date.now()
              : album.updatedAt,
        };
      }),
    }));

    useTargetStore.setState((state) => ({
      targets: state.targets.map((target) => {
        const nextImageIds = target.imageIds.filter((id) => !idSet.has(id));
        const nextRatings = { ...target.imageRatings };
        let ratingsChanged = false;
        for (const removedId of fileIds) {
          if (removedId in nextRatings) {
            delete nextRatings[removedId];
            ratingsChanged = true;
          }
        }
        const bestImageRemoved = !!target.bestImageId && idSet.has(target.bestImageId);
        if (
          nextImageIds.length === target.imageIds.length &&
          !ratingsChanged &&
          !bestImageRemoved
        ) {
          return target;
        }
        return {
          ...target,
          imageIds: nextImageIds,
          imageRatings: nextRatings,
          bestImageId: bestImageRemoved ? undefined : target.bestImageId,
          updatedAt: Date.now(),
        };
      }),
    }));

    useSessionStore.setState((state) => ({
      sessions: state.sessions.map((session) => {
        const nextImageIds = session.imageIds.filter((id) => !idSet.has(id));
        if (nextImageIds.length === session.imageIds.length) return session;
        return {
          ...session,
          imageIds: nextImageIds,
        };
      }),
      logEntries: state.logEntries.filter((entry) => !idSet.has(entry.imageId)),
    }));
  }, []);

  const handleDeleteFile = useCallback(
    (fileId: string) => {
      const file = files.find((f) => f.id === fileId);
      if (file) {
        deleteFile(file.filepath);
        deleteThumbnail(fileId);
        cleanupReferences([fileId]);
        removeFile(fileId);
      }
    },
    [files, cleanupReferences, removeFile],
  );

  const handleDeleteFiles = useCallback(
    (fileIds: string[]) => {
      const paths = files.filter((f) => fileIds.includes(f.id)).map((f) => f.filepath);
      deleteFiles(paths);
      deleteThumbnails(fileIds);
      cleanupReferences(fileIds);
      removeFiles(fileIds);
    },
    [files, cleanupReferences, removeFiles],
  );

  const handleRenameFiles = useCallback(
    (operations: RenameOperation[]): RenameResult => {
      if (operations.length === 0) return { success: 0, failed: 0 };

      let success = 0;
      let failed = 0;

      for (const op of operations) {
        const current = useFitsStore.getState().getFileById(op.fileId);
        if (!current) {
          failed++;
          continue;
        }
        const result = renameFitsFile(current.filepath, op.filename);
        if (!result.success) {
          failed++;
          continue;
        }
        updateFile(op.fileId, {
          filename: result.filename,
          filepath: result.filepath,
        });
        success++;
      }

      return { success, failed };
    },
    [updateFile],
  );

  return {
    isImporting,
    importProgress,
    importError,
    lastImportResult,
    isZipImportAvailable,
    pickAndImportFile,
    pickAndImportFolder,
    pickAndImportZip,
    importFromUrl,
    cancelImport,
    handleDeleteFile,
    handleDeleteFiles,
    handleRenameFiles,
  };
}
