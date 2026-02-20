/**
 * 格式转换 Hook
 */

import { useCallback, useEffect, useRef } from "react";
import { useConverterStore } from "../stores/useConverterStore";
import { useSettingsStore } from "../stores/useSettingsStore";
import { fitsToRGBA, estimateFileSize } from "../lib/converter/formatConverter";
import {
  createBatchTask,
  generateOutputFilename,
  executeBatchConvert,
} from "../lib/converter/batchProcessor";
import {
  getAllPresets,
  getDefaultOptionsForFormat,
  supportsQuality,
  getSupportedBitDepths,
} from "../lib/converter/convertPresets";
import type { ExportFormat } from "../lib/fits/types";
import { LOG_TAGS, Logger } from "../lib/logger";

interface BatchFileInfo {
  id: string;
  filepath: string;
  filename: string;
  sourceType?: "fits" | "raster" | "video" | "audio";
  mediaKind?: "image" | "video" | "audio";
}

export function useConverter() {
  const currentOptions = useConverterStore((s) => s.currentOptions);
  const setFormat = useConverterStore((s) => s.setFormat);
  const setQuality = useConverterStore((s) => s.setQuality);
  const setBitDepth = useConverterStore((s) => s.setBitDepth);
  const setDpi = useConverterStore((s) => s.setDpi);
  const setOptions = useConverterStore((s) => s.setOptions);
  const applyPreset = useConverterStore((s) => s.applyPreset);
  const presets = useConverterStore((s) => s.presets);
  const batchTasks = useConverterStore((s) => s.batchTasks);
  const addBatchTask = useConverterStore((s) => s.addBatchTask);
  const updateBatchTask = useConverterStore((s) => s.updateBatchTask);
  const clearCompletedTasks = useConverterStore((s) => s.clearCompletedTasks);
  const defaultConverterFormat = useSettingsStore((s) => s.defaultConverterFormat);
  const defaultConverterQuality = useSettingsStore((s) => s.defaultConverterQuality);
  const batchNamingRule = useSettingsStore((s) => s.batchNamingRule);

  const abortControllers = useRef<Map<string, AbortController>>(new Map());
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const initialFormat = defaultConverterFormat as ExportFormat;
    const defaults = getDefaultOptionsForFormat(initialFormat);
    setFormat(initialFormat);
    setOptions({
      ...defaults,
      format: initialFormat,
      quality: defaultConverterQuality,
    });
  }, [defaultConverterFormat, defaultConverterQuality, setFormat, setOptions]);

  const changeFormat = useCallback(
    (format: ExportFormat) => {
      setFormat(format);
      const defaults = getDefaultOptionsForFormat(format);
      setOptions(defaults);
      Logger.debug(LOG_TAGS.Converter, `Format changed: ${format}`);
    },
    [setFormat, setOptions],
  );

  const convertPixels = useCallback(
    (pixels: Float32Array, width: number, height: number) => {
      return fitsToRGBA(pixels, width, height, {
        stretch: currentOptions.stretch,
        colormap: currentOptions.colormap,
        blackPoint: currentOptions.blackPoint,
        whitePoint: currentOptions.whitePoint,
        gamma: currentOptions.gamma ?? 1,
      });
    },
    [currentOptions],
  );

  const getEstimatedSize = useCallback(
    (width: number, height: number) => {
      return estimateFileSize(width, height, currentOptions);
    },
    [currentOptions],
  );

  const startBatchConvert = useCallback(
    (files: BatchFileInfo[]) => {
      const fileIds = files.map((f) => f.id);
      const task = createBatchTask(fileIds, currentOptions);
      addBatchTask(task);

      const controller = new AbortController();
      abortControllers.current.set(task.id, controller);

      Logger.info(LOG_TAGS.Converter, `Batch convert started: ${files.length} files`, {
        format: currentOptions.format,
        taskId: task.id,
      });

      const preSkipped = files.filter(
        (file) =>
          (file.mediaKind && file.mediaKind !== "image") ||
          file.sourceType === "video" ||
          file.sourceType === "audio",
      );
      const executableFiles = files.filter((file) => !preSkipped.includes(file));
      const preSkippedWarnings = preSkipped.map(
        (file) => `${file.filename}: prefiltered non-image source`,
      );

      if (preSkipped.length > 0) {
        updateBatchTask(task.id, {
          skipped: preSkipped.length,
          warnings: preSkippedWarnings,
          progress: Math.round((preSkipped.length / Math.max(files.length, 1)) * 100),
        });
      }

      if (executableFiles.length === 0) {
        updateBatchTask(task.id, {
          status: "completed",
          progress: 100,
          completed: 0,
          failed: 0,
          skipped: preSkipped.length,
          warnings: preSkippedWarnings,
          finishedAt: Date.now(),
          error:
            preSkippedWarnings.length > 0
              ? `Skipped (${preSkippedWarnings.length}):\n${preSkippedWarnings.join("\n")}`
              : undefined,
        });
        abortControllers.current.delete(task.id);
        return task.id;
      }

      executeBatchConvert(
        task.id,
        executableFiles.map((f) => ({
          id: f.id,
          filepath: f.filepath,
          filename: f.filename,
          sourceType: f.sourceType,
          mediaKind: f.mediaKind,
        })),
        currentOptions,
        (taskId, updates) => {
          const mergedSkipped = preSkipped.length + (updates.skipped ?? 0);
          const mergedWarnings = [...preSkippedWarnings, ...(updates.warnings ?? [])];
          const completed = updates.completed ?? 0;
          const failed = updates.failed ?? 0;
          const progress = Math.round(
            ((completed + failed + mergedSkipped) / Math.max(files.length, 1)) * 100,
          );
          updateBatchTask(taskId, {
            ...updates,
            skipped: mergedSkipped,
            warnings: mergedWarnings,
            progress,
          });
        },
        controller.signal,
        {
          rule: batchNamingRule,
        },
      ).finally(() => {
        abortControllers.current.delete(task.id);
      });

      return task.id;
    },
    [currentOptions, addBatchTask, updateBatchTask, batchNamingRule],
  );

  const getOutputFilename = useCallback(
    (originalName: string) => {
      return generateOutputFilename(originalName, currentOptions.format, batchNamingRule);
    },
    [currentOptions.format, batchNamingRule],
  );

  const cancelTask = useCallback(
    (taskId: string) => {
      const controller = abortControllers.current.get(taskId);
      if (controller) {
        controller.abort();
      }
      updateBatchTask(taskId, { status: "cancelled" });
      Logger.info(LOG_TAGS.Converter, `Batch task cancelled: ${taskId}`);
    },
    [updateBatchTask],
  );

  const retryTask = useCallback(
    (taskId: string) => {
      updateBatchTask(taskId, {
        status: "pending",
        progress: 0,
        completed: 0,
        failed: 0,
        skipped: 0,
        warnings: [],
        error: undefined,
      });
    },
    [updateBatchTask],
  );

  return {
    currentOptions,
    setFormat: changeFormat,
    setQuality,
    setBitDepth,
    setDpi,
    setOptions,
    applyPreset,
    presets,
    allPresets: getAllPresets(presets),
    batchTasks,
    addBatchTask,
    updateBatchTask,
    clearCompletedTasks,
    convertPixels,
    getEstimatedSize,
    startBatchConvert,
    getOutputFilename,
    cancelTask,
    retryTask,
    supportsQuality: (fmt: ExportFormat) => supportsQuality(fmt),
    getSupportedBitDepths: (fmt: ExportFormat) => getSupportedBitDepths(fmt),
  };
}
