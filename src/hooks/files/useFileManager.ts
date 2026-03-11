/**
 * 文件管理 Hook
 * 完整流水线: DocumentPicker → copy → parse → metadata → store → auto-detect target
 * 支持: 文件导入、文件夹导入、ZIP 导入、URL 下载、剪贴板导入
 */

import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { InteractionManager } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as Clipboard from "expo-clipboard";
import * as ImagePicker from "expo-image-picker";
import { File, Directory, Paths } from "expo-file-system";
import { convertHiPSToFITS } from "fitsjs-ng";
import { LOG_TAGS, Logger } from "../../lib/logger";
import { useFitsStore } from "../../stores/files/useFitsStore";
import { useSettingsStore } from "../../stores/app/useSettingsStore";
import { useAlbumStore } from "../../stores/gallery/useAlbumStore";
import { useSessionStore } from "../../stores/observation/useSessionStore";
import { useTrashStore } from "../../stores/files/useTrashStore";
import { useFileGroupStore } from "../../stores/files/useFileGroupStore";
import { useTargetStore } from "../../stores/observation/useTargetStore";
import { useTargets } from "../targets/useTargets";
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
  sanitizeFilename,
} from "../../lib/utils/fileManager";
import { getFreeDiskBytes } from "../../lib/utils/diskSpace";
import { computeQuickHash, findDuplicateOnImport } from "../../lib/gallery/duplicateDetector";
import { classifyWithDetail } from "../../lib/gallery/frameClassifier";
import { computeAlbumFileConsistencyPatches } from "../../lib/gallery/albumSync";
import { fitsToRGBA } from "../../lib/converter/formatConverter";
import { deleteThumbnails } from "../../lib/gallery/thumbnailCache";
import { saveThumbnailFromRGBA, saveThumbnailFromVideo } from "../../lib/gallery/thumbnailWorkflow";
import { LocationService } from "../sessions/useLocation";
import type { FitsMetadata, TrashedFitsRecord } from "../../lib/fits/types";
import {
  detectPreferredSupportedImageFormat,
  detectSupportedImageFormat,
  detectSupportedImageFormatByMimeType,
  getPrimaryExtensionForFormat,
  isDistributedXisfFilename,
  replaceFilenameExtension,
  toImageSourceFormat,
} from "../../lib/import/fileFormat";
import { parseImageBuffer } from "../../lib/import/imageParsePipeline";
import { parseHiPSCutoutRequest } from "../../lib/import/hipsUrl";
import { resolveImportSessionId } from "../../lib/sessions/sessionLinking";
import { reconcileSessionsFromLinkedFilesGraph } from "../../lib/sessions/sessionReconciliation";
import { evaluateFrameQuality } from "../../lib/stacking/frameQuality";
import { extractVideoMetadata, type VideoMetadataSnapshot } from "../../lib/video/metadata";
import { normalizeGeoLocation } from "../../lib/map/geo";
import { useFileOperations } from "./useFileOperations";

export interface ImportProgress {
  phase:
    | "picking"
    | "extracting"
    | "scanning"
    | "importing"
    | "downloading"
    | "clipboard"
    | "mediaLibrary"
    | "recording";
  percent: number;
  currentFile?: string;
  current: number;
  total: number;
  success?: number;
  failed?: number;
  skippedDuplicate?: number;
  skippedUnsupported?: number;
}

export interface ImportResult {
  success: number;
  failed: number;
  total: number;
  skippedDuplicate: number;
  skippedUnsupported: number;
  failedEntries?: Array<{ name: string; reason: string }>;
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

export type {
  ExportFilesResult,
  GroupResult,
  RenameResult,
  ReclassifyFramesResult,
} from "./useFileOperations";

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
  return sanitizeFilename(name, `import_${Date.now()}`);
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

function resolvePickedAssetName(
  asset: Pick<ImagePicker.ImagePickerAsset, "fileName" | "mimeType" | "type">,
): string {
  if (asset.fileName && asset.fileName.trim()) {
    return sanitizeImportFilename(asset.fileName);
  }
  const ext = getPrimaryExtensionForFormat(
    detectSupportedImageFormatByMimeType(asset.mimeType ?? undefined),
  );
  const inferredExt = ext || (asset.type === "video" ? ".mp4" : ".jpg");
  return `picked_${Date.now()}${inferredExt}`;
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
  const videoThumbnailTimeMs = useSettingsStore((s) => s.videoThumbnailTimeMs);
  const frameClassificationConfig = useSettingsStore((s) => s.frameClassificationConfig);

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
    const undoTimers = undoTimersRef.current;
    const undoMap = undoMapRef.current;
    return () => {
      for (const timer of undoTimers.values()) {
        clearTimeout(timer);
      }
      undoTimers.clear();
      undoMap.clear();
    };
  }, []);

  const cancelImport = useCallback(() => {
    cancelRef.current = true;
  }, []);

  const fetchLocationForImport = useCallback(async () => {
    const loc = await LocationService.getCurrentLocation();
    return normalizeGeoLocation(loc) ?? undefined;
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

  const reconcileSessionsFromLinkedFiles = useCallback((sessionIds: string[]) => {
    const state = useSessionStore.getState();
    const { sessions, logEntries, summary } = reconcileSessionsFromLinkedFilesGraph({
      sessionIds,
      sessions: state.sessions,
      files: useFitsStore.getState().files,
      logEntries: state.logEntries,
      targetCatalog: useTargetStore.getState().targets,
    });

    if (summary.changed) {
      useSessionStore.setState({
        sessions,
        logEntries,
      });
    }
  }, []);

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

      const affectedSessionIds = [
        ...new Set(
          restoredFiles
            .map((file) => file.sessionId)
            .filter((sessionId): sessionId is string => Boolean(sessionId)),
        ),
      ];
      reconcileSessionsFromLinkedFiles(affectedSessionIds);

      for (const file of restoredFiles) {
        try {
          const syncResult = upsertAndLinkFileTarget(
            file.id,
            {
              object: file.object,
              ra: file.ra,
              dec: file.dec,
            },
            "import",
          );
          if (
            syncResult &&
            (syncResult.outcome === "ambiguous" || syncResult.outcome === "skipped")
          ) {
            Logger.info(
              LOG_TAGS.FileManager,
              `Target relink skipped for restored file ${file.filename} (${syncResult.outcome}:${syncResult.reasonCode})`,
            );
          }
        } catch (error) {
          Logger.warn(
            LOG_TAGS.FileManager,
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
    [reconcileSessionsFromLinkedFiles, reconcileTargetGraph, updateFile, upsertAndLinkFileTarget],
  );

  const processAndImportFile = useCallback(
    async (
      uri: string,
      name: string,
      size?: number,
      options?: {
        sourceFormatOverride?: FitsMetadata["sourceFormat"];
      },
    ): Promise<ImportFileOutcome> => {
      let importedFile: File | null = null;
      try {
        importedFile = importFile(uri, name);
        let importedUri = importedFile.uri;
        const buffer = await importedFile.arrayBuffer();
        let finalName = name;

        const formatByName = detectSupportedImageFormat(finalName);
        const detectedFormat = detectPreferredSupportedImageFormat({
          filename: finalName,
          payload: buffer,
        });
        if (!detectedFormat) {
          if (isDistributedXisfFilename(finalName)) {
            Logger.info(
              LOG_TAGS.FileManager,
              `Skipping unsupported distributed XISF file: ${name}`,
            );
            if (importedFile.exists) {
              importedFile.delete();
            }
            return {
              status: "unsupported",
              reason:
                "Distributed XISF (.xish + .xisb) is not supported. Please import a monolithic .xisf file.",
            };
          }
          Logger.info(LOG_TAGS.FileManager, `Skipping unsupported file: ${name}`);
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
              importedUri = importedFile.uri;
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
              LOG_TAGS.FileManager,
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
        const sessionId = resolveImportSessionId(useSessionStore.getState().activeSession);

        // Defer thumbnail generation and quality evaluation to avoid blocking UI
        const capturedThumbSize = thumbnailSize;
        const capturedThumbQuality = thumbnailQuality;
        const capturedVideoThumbTimeMs = videoThumbnailTimeMs;

        if (detectedFormat.sourceType === "fits" || detectedFormat.sourceType === "raster") {
          const parsed = await parseImageBuffer({
            buffer,
            filename: finalName,
            filepath: importedUri,
            fileSize: size ?? buffer.byteLength,
            frameClassificationConfig,
            allowDecodeFailureMetadata: true,
            detectedFormat,
          });

          fullMeta = {
            ...parsed.metadataBase,
            id: fileId,
            importDate: Date.now(),
            isFavorite: false,
            tags: [],
            albumIds: [],
            sessionId,
            location,
            thumbnailUri: undefined,
            hash,
            sourceType: parsed.sourceType,
            sourceFormat: options?.sourceFormatOverride ?? parsed.sourceFormat,
            mediaKind: "image",
            decodeStatus: parsed.decodeStatus,
            decodeError: parsed.decodeError,
            ...(parsed.serInfo ? { serInfo: parsed.serInfo } : {}),
          };

          addFile(fullMeta);

          if (
            parsed.decodeStatus !== "failed" &&
            parsed.pixels &&
            parsed.dimensions &&
            parsed.dimensions.width > 0 &&
            parsed.dimensions.height > 0
          ) {
            const parsedPixels = parsed.pixels;
            const parsedDimensions = parsed.dimensions;
            InteractionManager.runAfterInteractions(() => {
              const updates: Partial<FitsMetadata> = {};
              try {
                if (parsed.sourceType === "fits") {
                  const rgba = fitsToRGBA(
                    parsedPixels,
                    parsedDimensions.width,
                    parsedDimensions.height,
                    {
                      stretch: "asinh",
                      colormap: "grayscale",
                      blackPoint: 0,
                      whitePoint: 1,
                      gamma: 1,
                    },
                  );
                  const thumbUri = saveThumbnailFromRGBA(
                    fileId,
                    rgba,
                    parsedDimensions.width,
                    parsedDimensions.height,
                    {
                      thumbnailSize: capturedThumbSize,
                      thumbnailQuality: capturedThumbQuality,
                    },
                  );
                  if (thumbUri) updates.thumbnailUri = thumbUri;
                } else if (parsed.rgba) {
                  const rgba = new Uint8ClampedArray(
                    parsed.rgba.buffer,
                    parsed.rgba.byteOffset,
                    parsed.rgba.byteLength,
                  );
                  const thumbUri = saveThumbnailFromRGBA(
                    fileId,
                    rgba,
                    parsedDimensions.width,
                    parsedDimensions.height,
                    {
                      thumbnailSize: capturedThumbSize,
                      thumbnailQuality: capturedThumbQuality,
                    },
                  );
                  if (thumbUri) updates.thumbnailUri = thumbUri;
                }

                const meta = useFitsStore.getState().getFileById(fileId);
                if (meta && meta.frameType === "light") {
                  const quality = evaluateFrameQuality(
                    parsedPixels,
                    parsedDimensions.width,
                    parsedDimensions.height,
                  );
                  updates.qualityScore = quality.score;
                }

                if (Object.keys(updates).length > 0) {
                  useFitsStore.getState().updateFile(fileId, updates);
                }
              } catch {
                // Thumbnail generation failure is non-critical
              }
            });
          }
        } else if (detectedFormat.sourceType === "video") {
          const classifiedVideoFrame = classifyWithDetail(
            undefined,
            undefined,
            finalName,
            frameClassificationConfig,
          );
          let videoMeta: VideoMetadataSnapshot = {};
          try {
            videoMeta = await extractVideoMetadata(importedUri);
          } catch {
            // Metadata extraction is best-effort.
          }
          const width = videoMeta.videoWidth;
          const height = videoMeta.videoHeight;
          const durationMs =
            typeof videoMeta.durationMs === "number" && Number.isFinite(videoMeta.durationMs)
              ? videoMeta.durationMs
              : undefined;

          fullMeta = {
            id: fileId,
            filename: finalName,
            filepath: importedUri,
            fileSize: size ?? buffer.byteLength,
            importDate: Date.now(),
            frameType: classifiedVideoFrame.type,
            frameTypeSource: classifiedVideoFrame.source,
            isFavorite: false,
            tags: [],
            albumIds: [],
            sessionId,
            location,
            thumbnailUri: undefined,
            hash,
            sourceType: "video",
            sourceFormat: toImageSourceFormat(detectedFormat),
            mediaKind: "video",
            durationMs,
            frameRate: videoMeta.frameRate,
            videoWidth: width,
            videoHeight: height,
            videoCodec: videoMeta.videoCodec,
            audioCodec: videoMeta.audioCodec,
            bitrateKbps: videoMeta.bitrateKbps,
            rotationDeg: videoMeta.rotationDeg,
            hasAudioTrack: videoMeta.hasAudioTrack,
            thumbnailAtMs: capturedVideoThumbTimeMs,
            naxis: 2,
            naxis1: width,
            naxis2: height,
            naxis3: 1,
            bitpix: 8,
          };

          addFile(fullMeta);

          InteractionManager.runAfterInteractions(async () => {
            const thumbUri = await saveThumbnailFromVideo(
              fileId,
              importedUri,
              capturedVideoThumbTimeMs,
              {
                thumbnailQuality: capturedThumbQuality,
                videoThumbnailTimeMs: capturedVideoThumbTimeMs,
              },
            );
            if (thumbUri) {
              useFitsStore.getState().updateFile(fileId, { thumbnailUri: thumbUri });
            }
          });
        } else {
          const classifiedAudioFrame = classifyWithDetail(
            undefined,
            undefined,
            finalName,
            frameClassificationConfig,
          );
          let audioMeta: VideoMetadataSnapshot = {};
          try {
            audioMeta = await extractVideoMetadata(importedUri);
          } catch {
            // Metadata extraction is best-effort.
          }
          const durationMs =
            typeof audioMeta.durationMs === "number" && Number.isFinite(audioMeta.durationMs)
              ? audioMeta.durationMs
              : undefined;

          fullMeta = {
            id: fileId,
            filename: finalName,
            filepath: importedUri,
            fileSize: size ?? buffer.byteLength,
            importDate: Date.now(),
            frameType: classifiedAudioFrame.type,
            frameTypeSource: classifiedAudioFrame.source,
            isFavorite: false,
            tags: [],
            albumIds: [],
            sessionId,
            location,
            thumbnailUri: undefined,
            hash,
            sourceType: "audio",
            sourceFormat: toImageSourceFormat(detectedFormat),
            mediaKind: "audio",
            durationMs,
            audioCodec: audioMeta.audioCodec,
            bitrateKbps: audioMeta.bitrateKbps,
            hasAudioTrack: true,
          };

          addFile(fullMeta);
        }

        if (autoGroupByObject) {
          try {
            const resolution = upsertAndLinkFileTarget(
              fileId,
              {
                object: fullMeta.object,
                ra: fullMeta.ra,
                dec: fullMeta.dec,
              },
              "import",
            );
            if (
              resolution &&
              (resolution.outcome === "ambiguous" || resolution.outcome === "skipped")
            ) {
              Logger.info(
                LOG_TAGS.FileManager,
                `Auto target resolution ${resolution.outcome} for ${finalName} (${resolution.reasonCode})`,
              );
            }
          } catch (e) {
            Logger.warn(LOG_TAGS.FileManager, `Auto target detection failed for ${finalName}`, e);
          }
        }

        return { status: "imported" };
      } catch (err) {
        if (importedFile?.exists) {
          importedFile.delete();
        }
        Logger.warn(LOG_TAGS.FileManager, `Failed to import ${name}`, err);
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
      frameClassificationConfig,
      thumbnailSize,
      thumbnailQuality,
      videoThumbnailTimeMs,
      fetchLocationForImport,
      upsertAndLinkFileTarget,
    ],
  );

  const importBatch = useCallback(
    async (
      fileEntries: Array<{ uri: string; name: string; size?: number }>,
    ): Promise<ImportResult> => {
      const totalRequested = fileEntries.length;

      const totalRequestedBytes = fileEntries.reduce((sum, e) => sum + (e.size ?? 0), 0);
      if (totalRequestedBytes > 0) {
        const free = await getFreeDiskBytes();
        if (free !== null && free < totalRequestedBytes * 1.2) {
          return {
            success: 0,
            failed: totalRequested,
            total: totalRequested,
            skippedDuplicate: 0,
            skippedUnsupported: 0,
            failedEntries: [{ name: "batch", reason: "insufficient_disk_space" }],
          };
        }
      }

      let processed = 0;
      let success = 0;
      let failed = 0;
      let skippedDuplicate = 0;
      let skippedUnsupported = 0;
      const failedEntries: Array<{ name: string; reason: string }> = [];
      let lastProgressTs = 0;
      const PROGRESS_THROTTLE_MS = 300;

      const emitProgress = (currentFile: string, force: boolean) => {
        const now = Date.now();
        if (!force && now - lastProgressTs < PROGRESS_THROTTLE_MS) return;
        lastProgressTs = now;
        setImportProgress({
          phase: "importing",
          percent: Math.round((processed / totalRequested) * 100),
          currentFile,
          current: processed,
          total: totalRequested,
          success,
          failed,
          skippedDuplicate,
          skippedUnsupported,
        });
      };

      for (let i = 0; i < totalRequested; i++) {
        if (cancelRef.current) break;
        processed++;

        const entry = fileEntries[i];
        emitProgress(entry.name, i === 0);

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

        emitProgress(entry.name, i === totalRequested - 1);
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
        type: ["image/*", "video/*", "application/fits", "application/x-fits"],
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

  const pickAndImportFromMediaLibrary = useCallback(async () => {
    setIsImporting(true);
    setImportError(null);
    setLastImportResult(null);
    cancelRef.current = false;

    try {
      setImportProgress({
        phase: "mediaLibrary",
        percent: 0,
        current: 0,
        total: 0,
      });

      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setImportError("mediaLibraryPermissionDenied");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images", "videos"],
        allowsMultipleSelection: true,
        quality: 1,
      });
      if (result.canceled || !result.assets || result.assets.length === 0) return;

      const entries = result.assets.map((asset) => ({
        uri: asset.uri,
        name: resolvePickedAssetName(asset),
        size: asset.fileSize ?? undefined,
      }));
      const importResult = await importBatch(entries);
      setLastImportResult(importResult);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Media library import failed");
    } finally {
      setIsImporting(false);
    }
  }, [importBatch]);

  const recordAndImportVideo = useCallback(async () => {
    setIsImporting(true);
    setImportError(null);
    setLastImportResult(null);
    cancelRef.current = false;

    try {
      setImportProgress({
        phase: "recording",
        percent: 0,
        current: 0,
        total: 1,
      });

      const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
      if (!cameraPermission.granted) {
        setImportError("cameraPermissionDenied");
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["videos"],
        quality: 1,
      });
      if (result.canceled || !result.assets || result.assets.length === 0) return;

      const entries = result.assets.map((asset) => ({
        uri: asset.uri,
        name: resolvePickedAssetName(asset),
        size: asset.fileSize ?? undefined,
      }));
      const importResult = await importBatch(entries);
      setLastImportResult(importResult);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Video capture import failed");
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
        const hipsRequest = parseHiPSCutoutRequest(trimmed);
        if (hipsRequest) {
          const safeName = sanitizeImportFilename(hipsRequest.suggestedFilename);
          setImportProgress({
            phase: "downloading",
            percent: 0,
            currentFile: safeName,
            current: 0,
            total: 1,
            success: 0,
            failed: 0,
            skippedDuplicate: 0,
            skippedUnsupported: 0,
          });

          const fitsBuffer = await convertHiPSToFITS(hipsRequest.hipsInput, hipsRequest.options);
          const fitsBytes = new Uint8Array(fitsBuffer);
          const destFile = new File(Paths.cache, safeName);
          if (destFile.exists) {
            destFile.delete();
          }
          destFile.write(fitsBytes);

          setImportProgress({
            phase: "importing",
            percent: 50,
            currentFile: safeName,
            current: 1,
            total: 1,
            success: 0,
            failed: 0,
            skippedDuplicate: 0,
            skippedUnsupported: 0,
          });

          const outcome = await processAndImportFile(destFile.uri, safeName, fitsBytes.byteLength, {
            sourceFormatOverride: "hips",
          });
          const result = buildSingleImportResult(safeName, outcome);
          setImportProgress({
            phase: "importing",
            percent: 100,
            currentFile: safeName,
            current: 1,
            total: 1,
            success: result.success,
            failed: result.failed,
            skippedDuplicate: result.skippedDuplicate,
            skippedUnsupported: result.skippedUnsupported,
          });
          setLastImportResult(result);

          if (destFile.exists) {
            destFile.delete();
          }
        } else {
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
            success: 0,
            failed: 0,
            skippedDuplicate: 0,
            skippedUnsupported: 0,
          });

          const destFile = new File(Paths.cache, safeName);

          await File.downloadFileAsync(trimmed, destFile);

          setImportProgress({
            phase: "importing",
            percent: 50,
            currentFile: safeName,
            current: 1,
            total: 1,
            success: 0,
            failed: 0,
            skippedDuplicate: 0,
            skippedUnsupported: 0,
          });

          const outcome = await processAndImportFile(
            destFile.uri,
            safeName,
            destFile.size ?? undefined,
          );
          const result = buildSingleImportResult(safeName, outcome);
          setImportProgress({
            phase: "importing",
            percent: 100,
            currentFile: safeName,
            current: 1,
            total: 1,
            success: result.success,
            failed: result.failed,
            skippedDuplicate: result.skippedDuplicate,
            skippedUnsupported: result.skippedUnsupported,
          });
          setLastImportResult(result);

          if (destFile.exists) {
            destFile.delete();
          }
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
        success: 0,
        failed: 0,
        skippedDuplicate: 0,
        skippedUnsupported: 0,
      });

      let hasImage = false;
      try {
        hasImage = await Clipboard.hasImageAsync();
      } catch (error) {
        Logger.warn(LOG_TAGS.FileManager, "Clipboard image availability check failed", error);
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
              success: 0,
              failed: 0,
              skippedDuplicate: 0,
              skippedUnsupported: 0,
            });

            const outcome = await processAndImportFile(
              clipboardTempFile.uri,
              filename,
              clipboardTempFile.size ?? undefined,
            );
            const result = buildSingleImportResult(filename, outcome);
            setImportProgress({
              phase: "importing",
              percent: 100,
              currentFile: filename,
              current: 1,
              total: 1,
              success: result.success,
              failed: result.failed,
              skippedDuplicate: result.skippedDuplicate,
              skippedUnsupported: result.skippedUnsupported,
            });
            setLastImportResult(result);
            return;
          }
        } catch (error) {
          Logger.warn(
            LOG_TAGS.FileManager,
            "Clipboard image import failed, fallback to text",
            error,
          );
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
          success: 0,
          failed: 0,
          skippedDuplicate: 0,
          skippedUnsupported: 0,
        });

        const outcome = await processAndImportFile(
          clipboardTempFile.uri,
          filename,
          clipboardTempFile.size ?? undefined,
        );
        const result = buildSingleImportResult(filename, outcome);
        setImportProgress({
          phase: "importing",
          percent: 100,
          currentFile: filename,
          current: 1,
          total: 1,
          success: result.success,
          failed: result.failed,
          skippedDuplicate: result.skippedDuplicate,
          skippedUnsupported: result.skippedUnsupported,
        });
        setLastImportResult(result);
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
          success: 0,
          failed: 0,
          skippedDuplicate: 0,
          skippedUnsupported: 0,
        });

        const outcome = await processAndImportFile(sanitizedUri, filename);
        const result = buildSingleImportResult(filename, outcome);
        setImportProgress({
          phase: "importing",
          percent: 100,
          currentFile: filename,
          current: 1,
          total: 1,
          success: result.success,
          failed: result.failed,
          skippedDuplicate: result.skippedDuplicate,
          skippedUnsupported: result.skippedUnsupported,
        });
        setLastImportResult(result);
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
    (fileIds: string[], removedFiles: FitsMetadata[] = []) => {
      if (fileIds.length === 0) return;
      const idSet = new Set(fileIds);
      const sessionsWithRemovedImages = useSessionStore
        .getState()
        .sessions.filter((session) => session.imageIds.some((imageId) => idSet.has(imageId)))
        .map((session) => session.id);

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

      const affectedSessionIds = [
        ...new Set([
          ...removedFiles
            .map((file) => file.sessionId)
            .filter((sessionId): sessionId is string => Boolean(sessionId)),
          ...sessionsWithRemovedImages,
        ]),
      ];
      reconcileSessionsFromLinkedFiles(affectedSessionIds);

      useAlbumStore.getState().reconcileWithFiles(useFitsStore.getState().files.map((f) => f.id));
      const syncedAlbums = useAlbumStore.getState().albums;
      const syncedFiles = useFitsStore.getState().files;
      const fileAlbumPatches = computeAlbumFileConsistencyPatches(syncedFiles, syncedAlbums);
      for (const patch of fileAlbumPatches) {
        updateFile(patch.fileId, { albumIds: patch.albumIds });
      }
      reconcileTargetGraph();
    },
    [reconcileSessionsFromLinkedFiles, reconcileTargetGraph, updateFile],
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
        cleanupReferences(
          removedIds,
          trashRecords.map((record) => record.file),
        );
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

  const ops = useFileOperations();

  return {
    isImporting,
    importProgress,
    importError,
    lastImportResult,
    isZipImportAvailable,
    pickAndImportFile,
    pickAndImportFromMediaLibrary,
    recordAndImportVideo,
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
    exportFiles: ops.exportFiles,
    groupFiles: ops.groupFiles,
    reclassifyAllFrames: ops.reclassifyAllFrames,
    handleRenameFiles: ops.handleRenameFiles,
  };
}
