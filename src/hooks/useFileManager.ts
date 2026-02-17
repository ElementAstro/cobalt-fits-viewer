/**
 * 文件管理 Hook
 * 完整流水线: DocumentPicker → copy → parse → metadata → store → auto-detect target
 * 支持: 文件导入、文件夹导入、ZIP 导入、URL 下载、剪贴板导入
 */

import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { InteractionManager } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as Clipboard from "expo-clipboard";
import { File, Directory, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Logger } from "../lib/logger";
import { useFitsStore } from "../stores/useFitsStore";
import { useSettingsStore } from "../stores/useSettingsStore";
import { useAlbumStore } from "../stores/useAlbumStore";
import { useSessionStore } from "../stores/useSessionStore";
import { useTrashStore } from "../stores/useTrashStore";
import { useFileGroupStore } from "../stores/useFileGroupStore";
import { useTargets } from "./useTargets";
import {
  importFile,
  deleteFilesPermanently,
  moveFileToTrash,
  renameFitsFile,
  restoreFileFromTrash,
  generateFileId,
  scanDirectoryForSupportedImages,
  getTempExtractDir,
  cleanTempExtractDir,
} from "../lib/utils/fileManager";
import { computeQuickHash, findDuplicateOnImport } from "../lib/gallery/duplicateDetector";
import { computeAlbumFileConsistencyPatches } from "../lib/gallery/albumSync";
import {
  loadFitsFromBuffer,
  extractMetadata,
  getImagePixels,
  getImageDimensions,
} from "../lib/fits/parser";
import { fitsToRGBA } from "../lib/converter/formatConverter";
import { generateAndSaveThumbnail, deleteThumbnails } from "../lib/gallery/thumbnailCache";
import { LocationService } from "./useLocation";
import type { FitsMetadata, TrashedFitsRecord } from "../lib/fits/types";
import {
  detectPreferredSupportedImageFormat,
  detectSupportedImageFormat,
  detectSupportedImageFormatByMimeType,
  getPrimaryExtensionForFormat,
  replaceFilenameExtension,
  splitFilenameExtension,
  toImageSourceFormat,
} from "../lib/import/fileFormat";
import { extractRasterMetadata, parseRasterFromBuffer } from "../lib/image/rasterParser";

export interface ImportProgress {
  phase: "picking" | "extracting" | "scanning" | "importing" | "downloading" | "clipboard";
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

export interface DeleteActionResult {
  success: number;
  failed: number;
  token?: string;
}

export interface UndoResult {
  success: boolean;
  restored: number;
  failed: number;
  error?: string;
}

export interface RestoreResult {
  success: number;
  failed: number;
}

export interface EmptyTrashResult {
  deleted: number;
  failed: number;
}

export interface ExportFilesResult {
  success: boolean;
  exported: number;
  failed: number;
  shared: boolean;
  error?: string;
}

export interface GroupResult {
  success: number;
  failed: number;
}

type ImportFileStatus = "imported" | "duplicate" | "unsupported" | "failed";

interface ImportFileOutcome {
  status: ImportFileStatus;
  reason?: string;
}

interface UndoOperation {
  token: string;
  trashIds: string[];
  expireAt: number;
}

const TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const DELETE_UNDO_WINDOW_MS = 6000;

function isHttpUrl(value: string): boolean {
  return /^https?:\/\/.+/i.test(value.trim());
}

function isLocalUri(value: string): boolean {
  return /^(file|content):\/\/.+/i.test(value.trim());
}

function sanitizeImportFilename(name: string): string {
  const normalized = name
    .replace(/[<>:"/\\|?*]/g, "_")
    .split("")
    .map((char) => (char.charCodeAt(0) <= 31 ? "_" : char))
    .join("")
    .trim();
  return normalized || `import_${Date.now()}`;
}

function decodeUriComponentSafe(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function withDetectedExtension(filename: string, extension: string): string {
  const safe = sanitizeImportFilename(filename);
  if (!extension) return safe;
  const normalizedExt = extension.startsWith(".") ? extension : `.${extension}`;
  if (safe.toLowerCase().endsWith(normalizedExt.toLowerCase())) {
    return safe;
  }

  const current = detectSupportedImageFormat(safe);
  if (current) return safe;

  return replaceFilenameExtension(safe, normalizedExt);
}

function buildSingleImportResult(name: string, outcome: ImportFileOutcome): ImportResult {
  return {
    success: outcome.status === "imported" ? 1 : 0,
    failed: outcome.status === "failed" ? 1 : 0,
    total: 1,
    skippedDuplicate: outcome.status === "duplicate" ? 1 : 0,
    skippedUnsupported: outcome.status === "unsupported" ? 1 : 0,
    failedEntries:
      outcome.status === "failed"
        ? [{ name, reason: outcome.reason ?? "unknown_error" }]
        : undefined,
  };
}

function parseClipboardDataUrl(payload: string): { base64: string; extension: string } | null {
  const trimmed = payload.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^data:([^;,]+);base64,(.+)$/i);
  if (!match) return null;

  const format = detectSupportedImageFormatByMimeType(match[1]);
  if (!format) return null;

  const extension = getPrimaryExtensionForFormat(format);
  if (!extension) return null;

  return {
    base64: match[2].trim(),
    extension,
  };
}

function parseClipboardImageData(payload: string): { base64: string; extension: string } | null {
  const trimmed = payload.trim();
  if (!trimmed) return null;

  const parsedDataUrl = parseClipboardDataUrl(trimmed);
  if (parsedDataUrl) return parsedDataUrl;

  return {
    base64: trimmed,
    extension: ".png",
  };
}

function resolveUniqueExportName(rawName: string, usedNames: Set<string>): string {
  const safeName = sanitizeImportFilename(rawName || `export_${Date.now()}`);
  if (!usedNames.has(safeName)) {
    usedNames.add(safeName);
    return safeName;
  }

  const { baseName, extension } = splitFilenameExtension(safeName);
  const base = baseName || "export";
  const ext = extension || "";
  let index = 1;
  let candidate = `${base}_${index}${ext}`;
  while (usedNames.has(candidate)) {
    index++;
    candidate = `${base}_${index}${ext}`;
  }
  usedNames.add(candidate);
  return candidate;
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
  const addFiles = useFitsStore((s) => s.addFiles);
  const updateFile = useFitsStore((s) => s.updateFile);
  const removeFiles = useFitsStore((s) => s.removeFiles);
  const addTrashItems = useTrashStore((s) => s.addItems);
  const removeTrashItems = useTrashStore((s) => s.removeByTrashIds);
  const getTrashItemsById = useTrashStore((s) => s.getByTrashIds);
  const { upsertAndLinkFileTarget, reconcileTargetGraph } = useTargets();
  const undoMapRef = useRef<Map<string, UndoOperation>>(new Map());
  const undoTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

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

  useEffect(() => {
    const expired = useTrashStore.getState().clearExpired(Date.now());
    if (expired.length === 0) return;
    deleteFilesPermanently(expired.map((item) => item.trashedFilepath));
    deleteThumbnails(expired.map((item) => item.file.id));
  }, []);

  useEffect(() => {
    return () => {
      for (const timer of undoTimersRef.current.values()) {
        clearTimeout(timer);
      }
      undoTimersRef.current.clear();
      undoMapRef.current.clear();
    };
  }, []);

  const cancelImport = useCallback(() => {
    cancelRef.current = true;
  }, []);

  const fetchLocationForImport = useCallback(async () => {
    const loc = await LocationService.getCurrentLocation();
    return loc ?? undefined;
  }, []);

  const clearUndoToken = useCallback((token: string) => {
    const timer = undoTimersRef.current.get(token);
    if (timer) {
      clearTimeout(timer);
      undoTimersRef.current.delete(token);
    }
    undoMapRef.current.delete(token);
  }, []);

  const registerUndoOperation = useCallback(
    (trashIds: string[]): string => {
      const token = `undo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const expireAt = Date.now() + DELETE_UNDO_WINDOW_MS;
      undoMapRef.current.set(token, { token, trashIds, expireAt });
      const timer = setTimeout(() => {
        clearUndoToken(token);
      }, DELETE_UNDO_WINDOW_MS + 200);
      undoTimersRef.current.set(token, timer);
      return token;
    },
    [clearUndoToken],
  );

  const restoreReferences = useCallback(
    (restoredFiles: FitsMetadata[]) => {
      if (restoredFiles.length === 0) return;

      useAlbumStore.setState((state) => ({
        albums: state.albums.map((album) => {
          const toAdd = restoredFiles
            .filter((file) => file.albumIds.includes(album.id))
            .map((file) => file.id);
          if (toAdd.length === 0) return album;
          const nextIds = [...album.imageIds];
          let changed = false;
          for (const imageId of toAdd) {
            if (!nextIds.includes(imageId)) {
              nextIds.push(imageId);
              changed = true;
            }
          }
          if (!changed) return album;
          return {
            ...album,
            imageIds: nextIds,
            updatedAt: Date.now(),
          };
        }),
      }));

      useSessionStore.setState((state) => ({
        sessions: state.sessions.map((session) => {
          const toAdd = restoredFiles
            .filter((file) => file.sessionId && file.sessionId === session.id)
            .map((file) => file.id);
          if (toAdd.length === 0) return session;
          const nextIds = [...session.imageIds];
          let changed = false;
          for (const imageId of toAdd) {
            if (!nextIds.includes(imageId)) {
              nextIds.push(imageId);
              changed = true;
            }
          }
          if (!changed) return session;
          return {
            ...session,
            imageIds: nextIds,
          };
        }),
      }));

      for (const file of restoredFiles) {
        try {
          upsertAndLinkFileTarget(
            file.id,
            {
              object: file.object,
              ra: file.ra,
              dec: file.dec,
            },
            "import",
          );
        } catch (error) {
          Logger.warn(
            "FileManager",
            `Target relink failed for restored file ${file.filename}`,
            error,
          );
        }
      }

      useAlbumStore.getState().reconcileWithFiles(useFitsStore.getState().files.map((f) => f.id));
      const syncedAlbums = useAlbumStore.getState().albums;
      const syncedFiles = useFitsStore.getState().files;
      const fileAlbumPatches = computeAlbumFileConsistencyPatches(syncedFiles, syncedAlbums);
      for (const patch of fileAlbumPatches) {
        updateFile(patch.fileId, { albumIds: patch.albumIds });
      }
      reconcileTargetGraph();
    },
    [reconcileTargetGraph, updateFile, upsertAndLinkFileTarget],
  );

  const processAndImportFile = useCallback(
    async (uri: string, name: string, size?: number): Promise<ImportFileOutcome> => {
      let importedFile: File | null = null;
      try {
        importedFile = importFile(uri, name);
        const buffer = await importedFile.arrayBuffer();
        let finalName = name;

        const formatByName = detectSupportedImageFormat(finalName);
        const detectedFormat = detectPreferredSupportedImageFormat({
          filename: finalName,
          payload: buffer,
        });
        if (!detectedFormat) {
          Logger.info("FileManager", `Skipping unsupported file: ${name}`);
          if (importedFile.exists) {
            importedFile.delete();
          }
          return { status: "unsupported", reason: "unsupported_format" };
        }

        const shouldNormalizeName = !formatByName || formatByName.id !== detectedFormat.id;
        if (shouldNormalizeName) {
          const extension = getPrimaryExtensionForFormat(detectedFormat);
          const resolvedName = withDetectedExtension(finalName, extension);
          if (resolvedName !== finalName) {
            const renamed = renameFitsFile(importedFile.uri, resolvedName);
            if (renamed.success) {
              importedFile = new File(renamed.filepath);
              finalName = renamed.filename;
            }
          }
        }

        // Duplicate detection
        const hash = computeQuickHash(buffer, size ?? buffer.byteLength);
        if (autoDetectDuplicates) {
          const currentFiles = useFitsStore.getState().files;
          const duplicate = findDuplicateOnImport(hash, currentFiles);
          if (duplicate) {
            Logger.info(
              "FileManager",
              `Skipping duplicate: ${finalName} (matches ${duplicate.filename})`,
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
            filename: finalName,
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
              filename: finalName,
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
            upsertAndLinkFileTarget(
              fileId,
              {
                object: fullMeta.object,
                ra: fullMeta.ra,
                dec: fullMeta.dec,
              },
              "import",
            );
          } catch (e) {
            Logger.warn("FileManager", `Auto target detection failed for ${finalName}`, e);
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
      upsertAndLinkFileTarget,
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
      if (!isHttpUrl(trimmed)) {
        setImportError("Invalid URL. Only HTTP and HTTPS URLs are supported.");
        return;
      }

      setIsImporting(true);
      setImportError(null);
      setLastImportResult(null);
      cancelRef.current = false;

      try {
        const parsed = new URL(trimmed);
        const rawName = decodeUriComponentSafe(parsed.pathname.split("/").pop() ?? "").trim();
        const safeNameBase = rawName || `download_${Date.now()}`;
        const safeName = sanitizeImportFilename(safeNameBase);

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
        setLastImportResult(buildSingleImportResult(safeName, outcome));

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

  const importFromClipboard = useCallback(async () => {
    setIsImporting(true);
    setImportError(null);
    setLastImportResult(null);
    cancelRef.current = false;

    let clipboardTempFile: File | null = null;

    try {
      setImportProgress({
        phase: "clipboard",
        percent: 0,
        current: 0,
        total: 1,
      });

      let hasImage = false;
      try {
        hasImage = await Clipboard.hasImageAsync();
      } catch (error) {
        Logger.warn("FileManager", "Clipboard image availability check failed", error);
      }

      if (hasImage) {
        try {
          const image = await Clipboard.getImageAsync({ format: "png" });
          const parsed = image?.data ? parseClipboardImageData(image.data) : null;
          if (parsed) {
            const suffix = parsed.extension.startsWith(".")
              ? parsed.extension
              : `.${parsed.extension}`;
            const filename = `clipboard_${Date.now()}${suffix}`;
            clipboardTempFile = new File(Paths.cache, filename);
            clipboardTempFile.write(parsed.base64, {
              encoding: "base64",
            });

            setImportProgress({
              phase: "importing",
              percent: 50,
              currentFile: filename,
              current: 1,
              total: 1,
            });

            const outcome = await processAndImportFile(
              clipboardTempFile.uri,
              filename,
              clipboardTempFile.size ?? undefined,
            );
            setLastImportResult(buildSingleImportResult(filename, outcome));
            return;
          }
        } catch (error) {
          Logger.warn("FileManager", "Clipboard image import failed, fallback to text", error);
        }
      }

      const clipboardText = (await Clipboard.getStringAsync()).trim();
      if (isHttpUrl(clipboardText)) {
        setIsImporting(false);
        await importFromUrl(clipboardText);
        return;
      }

      const clipboardDataUrl = parseClipboardDataUrl(clipboardText);
      if (clipboardDataUrl) {
        const suffix = clipboardDataUrl.extension.startsWith(".")
          ? clipboardDataUrl.extension
          : `.${clipboardDataUrl.extension}`;
        const filename = `clipboard_${Date.now()}${suffix}`;
        clipboardTempFile = new File(Paths.cache, filename);
        clipboardTempFile.write(clipboardDataUrl.base64, {
          encoding: "base64",
        });

        setImportProgress({
          phase: "importing",
          percent: 50,
          currentFile: filename,
          current: 1,
          total: 1,
        });

        const outcome = await processAndImportFile(
          clipboardTempFile.uri,
          filename,
          clipboardTempFile.size ?? undefined,
        );
        setLastImportResult(buildSingleImportResult(filename, outcome));
        return;
      }

      if (isLocalUri(clipboardText)) {
        const sanitizedUri = clipboardText.split("?")[0].split("#")[0].trim();
        const decodedName = decodeUriComponentSafe(sanitizedUri.split("/").pop() ?? "").trim();
        const fallbackName = decodedName || `clipboard_${Date.now()}`;
        const filename = sanitizeImportFilename(fallbackName);

        setImportProgress({
          phase: "importing",
          percent: 50,
          currentFile: filename,
          current: 1,
          total: 1,
        });

        const outcome = await processAndImportFile(sanitizedUri, filename);
        setLastImportResult(buildSingleImportResult(filename, outcome));
        return;
      }

      setImportError("clipboardNoSupportedContent");
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Clipboard import failed");
    } finally {
      if (clipboardTempFile?.exists) {
        clipboardTempFile.delete();
      }
      setIsImporting(false);
    }
  }, [importFromUrl, processAndImportFile]);

  const cleanupReferences = useCallback(
    (fileIds: string[]) => {
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

      useAlbumStore.getState().reconcileWithFiles(useFitsStore.getState().files.map((f) => f.id));
      const syncedAlbums = useAlbumStore.getState().albums;
      const syncedFiles = useFitsStore.getState().files;
      const fileAlbumPatches = computeAlbumFileConsistencyPatches(syncedFiles, syncedAlbums);
      for (const patch of fileAlbumPatches) {
        updateFile(patch.fileId, { albumIds: patch.albumIds });
      }
      reconcileTargetGraph();
    },
    [reconcileTargetGraph, updateFile],
  );

  const handleSoftDeleteFiles = useCallback(
    (fileIds: string[]): DeleteActionResult => {
      if (fileIds.length === 0) return { success: 0, failed: 0 };

      const currentFiles = useFitsStore.getState().files;
      const trashRecords: TrashedFitsRecord[] = [];
      const removedIds: string[] = [];
      let failed = 0;
      const now = Date.now();
      const reason: TrashedFitsRecord["deleteReason"] = fileIds.length > 1 ? "batch" : "single";

      for (const fileId of fileIds) {
        const file = currentFiles.find((item) => item.id === fileId);
        if (!file) {
          failed++;
          continue;
        }

        const moved = moveFileToTrash(file.filepath, file.filename);
        if (!moved.success) {
          failed++;
          continue;
        }

        trashRecords.push({
          trashId: `trash_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          file,
          originalFilepath: file.filepath,
          trashedFilepath: moved.filepath,
          deletedAt: now,
          expireAt: now + TRASH_RETENTION_MS,
          groupIds: useFileGroupStore.getState().getFileGroupIds(file.id),
          deleteReason: reason,
        });
        removedIds.push(file.id);
      }

      if (removedIds.length > 0) {
        removeFiles(removedIds);
        cleanupReferences(removedIds);
        useFileGroupStore.getState().removeFileMappings(removedIds);
        addTrashItems(trashRecords);
      }

      const token =
        trashRecords.length > 0
          ? registerUndoOperation(trashRecords.map((r) => r.trashId))
          : undefined;
      return {
        success: removedIds.length,
        failed,
        token,
      };
    },
    [addTrashItems, cleanupReferences, registerUndoOperation, removeFiles],
  );

  const handleDeleteFile = useCallback(
    (fileId: string): DeleteActionResult => {
      return handleSoftDeleteFiles([fileId]);
    },
    [handleSoftDeleteFiles],
  );

  const handleDeleteFiles = useCallback(
    (fileIds: string[]): DeleteActionResult => {
      return handleSoftDeleteFiles(fileIds);
    },
    [handleSoftDeleteFiles],
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

  const restoreFromTrash = useCallback(
    (trashIds: string[]): RestoreResult => {
      if (trashIds.length === 0) return { success: 0, failed: 0 };
      const records = getTrashItemsById(trashIds);
      if (records.length === 0) return { success: 0, failed: trashIds.length };

      const restoredFiles: FitsMetadata[] = [];
      const restoredTrashIds: string[] = [];
      let failed = 0;

      for (const record of records) {
        const restored = restoreFileFromTrash(record.trashedFilepath, record.file.filename);
        if (!restored.success) {
          failed++;
          continue;
        }

        restoredFiles.push({
          ...record.file,
          filename: restored.filename,
          filepath: restored.filepath,
        });
        restoredTrashIds.push(record.trashId);
      }

      if (restoredFiles.length > 0) {
        addFiles(restoredFiles);
        for (const restoredFile of restoredFiles) {
          const restoredRecord = records.find((item) => item.file.id === restoredFile.id);
          if (!restoredRecord || restoredRecord.groupIds.length === 0) continue;
          for (const groupId of restoredRecord.groupIds) {
            useFileGroupStore.getState().assignFilesToGroup([restoredFile.id], groupId);
          }
        }
        restoreReferences(restoredFiles);
        removeTrashItems(restoredTrashIds);
      }

      return {
        success: restoredFiles.length,
        failed: failed + Math.max(0, trashIds.length - records.length),
      };
    },
    [addFiles, getTrashItemsById, removeTrashItems, restoreReferences],
  );

  const undoLastDelete = useCallback(
    (token: string): UndoResult => {
      const operation = undoMapRef.current.get(token);
      if (!operation) {
        return {
          success: false,
          restored: 0,
          failed: 0,
          error: "undoTokenMissing",
        };
      }

      if (Date.now() > operation.expireAt) {
        clearUndoToken(token);
        return {
          success: false,
          restored: 0,
          failed: operation.trashIds.length,
          error: "undoExpired",
        };
      }

      clearUndoToken(token);
      const restored = restoreFromTrash(operation.trashIds);
      return {
        success: restored.success > 0 && restored.failed === 0,
        restored: restored.success,
        failed: restored.failed,
      };
    },
    [clearUndoToken, restoreFromTrash],
  );

  const emptyTrash = useCallback(
    (trashIds?: string[]): EmptyTrashResult => {
      const targets =
        trashIds && trashIds.length > 0
          ? getTrashItemsById(trashIds)
          : useTrashStore.getState().items;
      if (targets.length === 0) return { deleted: 0, failed: 0 };

      const deletedTrashIds: string[] = [];
      const deletedFileIds: string[] = [];

      for (const item of targets) {
        const trashedFile = new File(item.trashedFilepath);
        if (!trashedFile.exists) {
          deletedTrashIds.push(item.trashId);
          deletedFileIds.push(item.file.id);
          continue;
        }

        try {
          trashedFile.delete();
          deletedTrashIds.push(item.trashId);
          deletedFileIds.push(item.file.id);
        } catch {
          // Keep failed entries in trash so user can retry or restore later.
        }
      }

      const deletedCount = deletedTrashIds.length;
      const failed = targets.length - deletedCount;

      if (deletedFileIds.length > 0) {
        deleteThumbnails(deletedFileIds);
        removeTrashItems(deletedTrashIds);
      }

      return { deleted: deletedCount, failed };
    },
    [getTrashItemsById, removeTrashItems],
  );

  const exportFiles = useCallback(async (fileIds: string[]): Promise<ExportFilesResult> => {
    if (fileIds.length === 0) {
      return { success: false, exported: 0, failed: 0, shared: false, error: "emptySelection" };
    }

    const selectedFiles = useFitsStore.getState().files.filter((file) => fileIds.includes(file.id));
    if (selectedFiles.length === 0) {
      return {
        success: false,
        exported: 0,
        failed: fileIds.length,
        shared: false,
        error: "missingFiles",
      };
    }

    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) {
      return {
        success: false,
        exported: 0,
        failed: selectedFiles.length,
        shared: false,
        error: "shareUnavailable",
      };
    }

    if (selectedFiles.length === 1) {
      try {
        await Sharing.shareAsync(selectedFiles[0].filepath);
        return { success: true, exported: 1, failed: 0, shared: true };
      } catch (error) {
        return {
          success: false,
          exported: 0,
          failed: 1,
          shared: false,
          error: error instanceof Error ? error.message : "shareFailed",
        };
      }
    }

    let zipFn: ((source: string, target: string) => Promise<string>) | null = null;
    try {
      const zipArchive = require("react-native-zip-archive");
      zipFn = zipArchive.zip;
    } catch {
      return {
        success: false,
        exported: 0,
        failed: selectedFiles.length,
        shared: false,
        error: "zipExportUnavailable",
      };
    }
    if (!zipFn) {
      return {
        success: false,
        exported: 0,
        failed: selectedFiles.length,
        shared: false,
        error: "zipExportUnavailable",
      };
    }

    const exportDir = new Directory(Paths.cache, `file_export_${Date.now()}`);
    if (!exportDir.exists) {
      exportDir.create();
    }

    const usedNames = new Set<string>();
    let copied = 0;
    let failed = 0;

    for (const file of selectedFiles) {
      try {
        const source = new File(file.filepath);
        if (!source.exists) {
          failed++;
          continue;
        }
        const exportName = resolveUniqueExportName(file.filename, usedNames);
        const target = new File(exportDir, exportName);
        source.copy(target);
        copied++;
      } catch {
        failed++;
      }
    }

    if (copied === 0) {
      if (exportDir.exists) exportDir.delete();
      return { success: false, exported: 0, failed, shared: false, error: "noExportedFiles" };
    }

    const zipFile = new File(Paths.cache, `files_export_${Date.now()}.zip`);
    try {
      await zipFn(exportDir.uri, zipFile.uri);
      await Sharing.shareAsync(zipFile.uri, {
        mimeType: "application/zip",
        UTI: "public.zip-archive",
      });
      return { success: true, exported: copied, failed, shared: true };
    } catch (error) {
      return {
        success: false,
        exported: copied,
        failed,
        shared: false,
        error: error instanceof Error ? error.message : "zipShareFailed",
      };
    } finally {
      if (exportDir.exists) exportDir.delete();
      if (zipFile.exists) zipFile.delete();
    }
  }, []);

  const groupFiles = useCallback((fileIds: string[], groupId: string): GroupResult => {
    if (fileIds.length === 0 || !groupId) return { success: 0, failed: fileIds.length };
    const group = useFileGroupStore.getState().getGroupById(groupId);
    if (!group) return { success: 0, failed: fileIds.length };
    const existingIds = new Set(useFitsStore.getState().files.map((file) => file.id));
    const validIds = fileIds.filter((id) => existingIds.has(id));
    useFileGroupStore.getState().assignFilesToGroup(validIds, groupId);
    return {
      success: validIds.length,
      failed: fileIds.length - validIds.length,
    };
  }, []);

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
    importFromClipboard,
    cancelImport,
    handleDeleteFile,
    handleDeleteFiles,
    undoLastDelete,
    restoreFromTrash,
    emptyTrash,
    exportFiles,
    groupFiles,
    handleRenameFiles,
  };
}
