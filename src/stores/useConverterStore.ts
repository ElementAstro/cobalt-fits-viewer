/**
 * 格式转换状态管理
 */

import { create } from "zustand";
import type { ExportFormat, ConvertOptions, ConvertPreset, BatchTask } from "../lib/fits/types";
import {
  DEFAULT_CONVERT_PRESETS,
  DEFAULT_FITS_TARGET_OPTIONS,
  DEFAULT_TIFF_TARGET_OPTIONS,
} from "../lib/fits/types";

interface ConverterStoreState {
  // 当前转换设置
  currentOptions: ConvertOptions;
  presets: ConvertPreset[];

  // 批量任务
  batchTasks: BatchTask[];

  // Actions
  setFormat: (format: ExportFormat) => void;
  setQuality: (quality: number) => void;
  setBitDepth: (depth: 8 | 16 | 32) => void;
  setDpi: (dpi: number) => void;
  setOptions: (options: Partial<ConvertOptions>) => void;
  applyPreset: (presetId: string) => void;

  addPreset: (preset: ConvertPreset) => void;
  removePreset: (id: string) => void;

  addBatchTask: (task: BatchTask) => void;
  updateBatchTask: (id: string, updates: Partial<BatchTask>) => void;
  removeBatchTask: (id: string) => void;
  clearCompletedTasks: () => void;
}

const DEFAULT_OPTIONS: ConvertOptions = {
  format: "png",
  quality: 90,
  bitDepth: 8,
  dpi: 72,
  tiff: { ...DEFAULT_TIFF_TARGET_OPTIONS },
  fits: DEFAULT_FITS_TARGET_OPTIONS,
  stretch: "asinh",
  colormap: "grayscale",
  blackPoint: 0,
  whitePoint: 1,
  gamma: 1,
  brightness: 0,
  contrast: 1,
  mtfMidtone: 0.25,
  curvePreset: "linear",
  outputBlack: 0,
  outputWhite: 1,
  includeAnnotations: false,
  includeWatermark: false,
};

export const useConverterStore = create<ConverterStoreState>((set, get) => ({
  currentOptions: { ...DEFAULT_OPTIONS },
  presets: [],
  batchTasks: [],

  setFormat: (format) => set((s) => ({ currentOptions: { ...s.currentOptions, format } })),

  setQuality: (quality) => set((s) => ({ currentOptions: { ...s.currentOptions, quality } })),

  setBitDepth: (bitDepth) => set((s) => ({ currentOptions: { ...s.currentOptions, bitDepth } })),

  setDpi: (dpi) => set((s) => ({ currentOptions: { ...s.currentOptions, dpi } })),

  setOptions: (options) =>
    set((s) => ({
      currentOptions: { ...s.currentOptions, ...options },
    })),

  applyPreset: (presetId) => {
    const allPresets = [...DEFAULT_CONVERT_PRESETS, ...get().presets];
    const preset = allPresets.find((p) => p.id === presetId);
    if (preset) {
      set({ currentOptions: { ...preset.options } });
    }
  },

  addPreset: (preset) => set((s) => ({ presets: [...s.presets, preset] })),

  removePreset: (id) => set((s) => ({ presets: s.presets.filter((p) => p.id !== id) })),

  addBatchTask: (task) => set((s) => ({ batchTasks: [...s.batchTasks, task] })),

  updateBatchTask: (id, updates) =>
    set((s) => ({
      batchTasks: s.batchTasks.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    })),

  removeBatchTask: (id) => set((s) => ({ batchTasks: s.batchTasks.filter((t) => t.id !== id) })),

  clearCompletedTasks: () =>
    set((s) => ({
      batchTasks: s.batchTasks.filter((t) => t.status !== "completed" && t.status !== "failed"),
    })),
}));
