import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform } from "react-native";
import * as VideoThumbnails from "expo-video-thumbnails";
import { File } from "expo-file-system";
import { useVideoTaskStore } from "../stores/useVideoTaskStore";
import { useSettingsStore } from "../stores/useSettingsStore";
import { useFitsStore } from "../stores/useFitsStore";
import {
  getVideoProcessingEngine,
  type VideoProcessingCapabilities,
  type VideoProcessingRequest,
} from "../lib/video/engine";
import { extractVideoMetadata } from "../lib/video/metadata";
import { detectSupportedMediaFormat, toImageSourceFormat } from "../lib/import/fileFormat";
import { generateFileId, importFile } from "../lib/utils/fileManager";
import { copyThumbnailToCache, generateAndSaveThumbnail } from "../lib/gallery/thumbnailCache";
import { classifyWithDetail } from "../lib/gallery/frameClassifier";
import { parseRasterFromBuffer, extractRasterMetadata } from "../lib/image/rasterParser";
import type { FitsMetadata } from "../lib/fits/types";

function deriveOutputEntries(taskOutput: string, extraOutputs?: string[]): string[] {
  return [taskOutput, ...(extraOutputs ?? [])];
}

interface EnqueueProcessingResult {
  taskId: string | null;
  errorCode?: string;
  errorMessage?: string;
}

function parseEngineError(error: unknown): { message: string; code?: string } {
  if (error instanceof Error) {
    const code = /^(?:ffmpeg_|encoder_|video_processing_)[a-z0-9_.-]+$/i.test(error.message)
      ? error.message
      : undefined;
    return {
      message: error.message,
      code,
    };
  }
  return {
    message: "video_processing_failed",
  };
}

export function useVideoProcessing() {
  const tasks = useVideoTaskStore((s) => s.tasks);
  const enqueueTask = useVideoTaskStore((s) => s.enqueueTask);
  const updateTask = useVideoTaskStore((s) => s.updateTask);
  const markRunning = useVideoTaskStore((s) => s.markRunning);
  const markCompleted = useVideoTaskStore((s) => s.markCompleted);
  const markFailed = useVideoTaskStore((s) => s.markFailed);
  const markCancelled = useVideoTaskStore((s) => s.markCancelled);
  const retryTask = useVideoTaskStore((s) => s.retryTask);
  const removeTask = useVideoTaskStore((s) => s.removeTask);
  const clearFinished = useVideoTaskStore((s) => s.clearFinished);

  const addFile = useFitsStore((s) => s.addFile);
  const sourceFiles = useFitsStore((s) => s.files);
  const frameClassificationConfig = useSettingsStore((s) => s.frameClassificationConfig);
  const concurrency = useSettingsStore((s) => s.videoProcessingConcurrency);
  const videoProcessingEnabled = useSettingsStore((s) => s.videoProcessingEnabled);

  const engine = useMemo(() => getVideoProcessingEngine(), []);
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());
  const [isEngineAvailable, setIsEngineAvailable] = useState(false);
  const [engineCapabilities, setEngineCapabilities] = useState<VideoProcessingCapabilities | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    void engine
      .getCapabilities()
      .then((capabilities) => {
        if (cancelled) return;
        setEngineCapabilities(capabilities);
        setIsEngineAvailable(capabilities.available);
      })
      .catch(() => {
        if (cancelled) return;
        setEngineCapabilities({
          available: false,
          encoderNames: [],
          h264Encoders: [],
          hevcEncoders: [],
          unavailableReason: "ffmpeg_capabilities_unavailable",
        });
        setIsEngineAvailable(false);
      });
    return () => {
      cancelled = true;
    };
  }, [engine]);

  const importOutputUri = useCallback(
    async (request: VideoProcessingRequest, outputUri: string): Promise<string> => {
      const outputFile = new File(outputUri);
      const source = sourceFiles.find((file) => file.id === request.sourceId);
      const filename = outputFile.name || `${request.sourceFilename}_processed`;
      const imported = importFile(outputUri, filename);
      const importedFile = new File(imported.uri);
      const format = detectSupportedMediaFormat(importedFile.name);
      const sourceType =
        request.operation === "extract-audio" ? "audio" : (format?.sourceType ?? "video");
      const fileId = generateFileId();
      const fileSize = importedFile.size ?? 0;
      const now = Date.now();
      let thumbnailUri: string | undefined;

      if (sourceType === "video") {
        const frameClassified = classifyWithDetail(
          undefined,
          undefined,
          importedFile.name,
          frameClassificationConfig,
        );
        let videoMeta = {};
        try {
          videoMeta = await extractVideoMetadata(importedFile.uri);
        } catch {
          // best effort
        }

        if (Platform.OS !== "web") {
          try {
            const thumb = await VideoThumbnails.getThumbnailAsync(importedFile.uri, {
              time: Math.max(0, source?.thumbnailAtMs ?? 1000),
              quality: 0.8,
            });
            thumbnailUri = copyThumbnailToCache(fileId, thumb.uri) ?? undefined;
          } catch {
            // ignore thumbnail failures
          }
        }

        const meta = videoMeta as {
          durationMs?: number;
          frameRate?: number;
          videoWidth?: number;
          videoHeight?: number;
          videoCodec?: string;
          audioCodec?: string;
          bitrateKbps?: number;
          rotationDeg?: number;
          hasAudioTrack?: boolean;
        };
        const next: FitsMetadata = {
          id: fileId,
          filename: importedFile.name,
          filepath: importedFile.uri,
          fileSize,
          importDate: now,
          frameType: frameClassified.type,
          frameTypeSource: frameClassified.source,
          isFavorite: false,
          tags: [],
          albumIds: [],
          sessionId: source?.sessionId,
          location: source?.location,
          sourceType: "video",
          sourceFormat: toImageSourceFormat(format),
          mediaKind: "video",
          thumbnailUri,
          durationMs: meta.durationMs,
          frameRate: meta.frameRate,
          videoWidth: meta.videoWidth,
          videoHeight: meta.videoHeight,
          videoCodec: meta.videoCodec,
          audioCodec: meta.audioCodec,
          bitrateKbps: meta.bitrateKbps,
          rotationDeg: meta.rotationDeg,
          hasAudioTrack: meta.hasAudioTrack,
          thumbnailAtMs: source?.thumbnailAtMs ?? 1000,
          derivedFromId: source?.id,
          processingTag: request.operation,
          naxis: 2,
          naxis1: meta.videoWidth,
          naxis2: meta.videoHeight,
          naxis3: 1,
          bitpix: 8,
        };
        addFile(next);
        return fileId;
      }

      if (sourceType === "audio") {
        const frameClassified = classifyWithDetail(
          undefined,
          undefined,
          importedFile.name,
          frameClassificationConfig,
        );
        let audioMeta = {};
        try {
          audioMeta = await extractVideoMetadata(importedFile.uri);
        } catch {
          // best effort
        }

        const meta = audioMeta as {
          durationMs?: number;
          audioCodec?: string;
          bitrateKbps?: number;
          hasAudioTrack?: boolean;
        };
        const next: FitsMetadata = {
          id: fileId,
          filename: importedFile.name,
          filepath: importedFile.uri,
          fileSize,
          importDate: now,
          frameType: frameClassified.type,
          frameTypeSource: frameClassified.source,
          isFavorite: false,
          tags: [],
          albumIds: [],
          sessionId: source?.sessionId,
          location: source?.location,
          sourceType: "audio",
          sourceFormat: toImageSourceFormat(format),
          mediaKind: "audio",
          durationMs: meta.durationMs,
          audioCodec: meta.audioCodec,
          bitrateKbps: meta.bitrateKbps,
          hasAudioTrack: meta.hasAudioTrack ?? true,
          derivedFromId: source?.id,
          processingTag: request.operation,
        };
        addFile(next);
        return fileId;
      }

      const buffer = await importedFile.arrayBuffer();
      const parsed = parseRasterFromBuffer(buffer);
      const rgba = new Uint8ClampedArray(
        parsed.rgba.buffer,
        parsed.rgba.byteOffset,
        parsed.rgba.byteLength,
      );
      thumbnailUri =
        generateAndSaveThumbnail(fileId, rgba, parsed.width, parsed.height, 256, 80) ?? undefined;

      const partial = extractRasterMetadata(
        {
          filename: importedFile.name,
          filepath: importedFile.uri,
          fileSize,
        },
        {
          width: parsed.width,
          height: parsed.height,
        },
        frameClassificationConfig,
      );
      const next: FitsMetadata = {
        ...partial,
        id: fileId,
        importDate: now,
        isFavorite: false,
        tags: [],
        albumIds: [],
        sessionId: source?.sessionId,
        location: source?.location,
        sourceType: "raster",
        sourceFormat: toImageSourceFormat(format),
        mediaKind: "image",
        thumbnailUri,
        derivedFromId: source?.id,
        processingTag: request.operation,
      };
      addFile(next);
      return fileId;
    },
    [addFile, frameClassificationConfig, sourceFiles],
  );

  const runTask = useCallback(
    async (taskId: string) => {
      const task = useVideoTaskStore.getState().tasks.find((item) => item.id === taskId);
      if (!task || task.status !== "pending") return;

      const controller = new AbortController();
      abortControllersRef.current.set(taskId, controller);
      markRunning(taskId);

      try {
        const result = await engine.run(task.request, {
          signal: controller.signal,
          onProgress: (progress) => {
            updateTask(taskId, {
              progress: progress.ratio,
              processedMs: progress.processedMs,
              durationMs: progress.durationMs,
            });
          },
        });
        const outputEntries = deriveOutputEntries(result.outputUri, result.extraOutputUris);
        const outputFileIds: string[] = [];
        for (const outputUri of outputEntries) {
          outputFileIds.push(await importOutputUri(task.request, outputUri));
        }
        markCompleted(taskId, outputEntries, outputFileIds, result.logLines);
      } catch (error) {
        if (controller.signal.aborted) {
          markCancelled(taskId);
        } else {
          const parsed = parseEngineError(error);
          markFailed(taskId, parsed.message, [], parsed.code);
        }
      } finally {
        abortControllersRef.current.delete(taskId);
      }
    },
    [engine, importOutputUri, markCancelled, markCompleted, markFailed, markRunning, updateTask],
  );

  useEffect(() => {
    if (!videoProcessingEnabled || !isEngineAvailable) return;

    const runningCount = tasks.filter((task) => task.status === "running").length;
    const pendingTasks = tasks
      .filter((task) => task.status === "pending")
      .sort((a, b) => a.createdAt - b.createdAt);
    const availableSlots = Math.max(0, concurrency - runningCount);
    if (!availableSlots || !pendingTasks.length) return;

    for (const task of pendingTasks.slice(0, availableSlots)) {
      void runTask(task.id);
    }
  }, [concurrency, isEngineAvailable, runTask, tasks, videoProcessingEnabled]);

  useEffect(() => {
    if (!videoProcessingEnabled || isEngineAvailable) return;
    const errorCode = engineCapabilities?.unavailableReason ?? "ffmpeg_executor_unavailable";
    for (const task of tasks) {
      if (task.status !== "pending") continue;
      markFailed(task.id, errorCode, [], errorCode);
    }
  }, [engineCapabilities, isEngineAvailable, markFailed, tasks, videoProcessingEnabled]);

  const enqueueProcessingTask = useCallback(
    (request: VideoProcessingRequest): EnqueueProcessingResult => {
      if (!videoProcessingEnabled) {
        return {
          taskId: null,
          errorCode: "video_processing_disabled",
          errorMessage: "Video processing is disabled by settings.",
        };
      }
      if (!isEngineAvailable) {
        const errorCode = engineCapabilities?.unavailableReason ?? "ffmpeg_executor_unavailable";
        return {
          taskId: null,
          errorCode,
          errorMessage: "Local FFmpeg engine is unavailable in this build.",
        };
      }
      return { taskId: enqueueTask(request) };
    },
    [engineCapabilities, enqueueTask, isEngineAvailable, videoProcessingEnabled],
  );

  const cancelTask = useCallback(
    (taskId: string) => {
      const controller = abortControllersRef.current.get(taskId);
      if (controller) {
        controller.abort();
        markCancelled(taskId);
        return;
      }
      markCancelled(taskId);
    },
    [markCancelled],
  );

  return {
    tasks,
    isEngineAvailable,
    engineCapabilities,
    enqueueProcessingTask,
    retryTask,
    removeTask,
    clearFinished,
    cancelTask,
  };
}
