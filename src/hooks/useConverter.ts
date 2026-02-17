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

      executeBatchConvert(
        task.id,
        files.map((f) => ({ filepath: f.filepath, filename: f.filename })),
        currentOptions,
        (taskId, updates) => updateBatchTask(taskId, updates),
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
