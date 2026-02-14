/**
 * FITS 图像查看器状态管理
 */

import { create } from "zustand";
import type { StretchType, ColormapType, Annotation } from "../lib/fits/types";

interface ViewerStoreState {
  // 当前文件
  currentFileId: string | null;
  isLoading: boolean;
  error: string | null;

  // 显示参数
  stretch: StretchType;
  colormap: ColormapType;
  blackPoint: number;
  whitePoint: number;
  gamma: number;

  // HDU & Frame
  currentHDU: number;
  currentFrame: number;
  totalFrames: number;

  // 叠加层
  showGrid: boolean;
  showCrosshair: boolean;
  showPixelInfo: boolean;
  showMiniMap: boolean;

  // 标注
  annotations: Annotation[];
  activeAnnotationId: string | null;

  // 像素信息
  cursorX: number;
  cursorY: number;
  cursorValue: number | null;

  // Actions
  setCurrentFile: (id: string | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  setStretch: (stretch: StretchType) => void;
  setColormap: (colormap: ColormapType) => void;
  setBlackPoint: (value: number) => void;
  setWhitePoint: (value: number) => void;
  setGamma: (value: number) => void;

  setCurrentHDU: (index: number) => void;
  setCurrentFrame: (frame: number) => void;
  setTotalFrames: (total: number) => void;

  toggleGrid: () => void;
  toggleCrosshair: () => void;
  togglePixelInfo: () => void;
  toggleMiniMap: () => void;

  addAnnotation: (annotation: Annotation) => void;
  removeAnnotation: (id: string) => void;
  updateAnnotation: (id: string, updates: Partial<Annotation>) => void;
  setActiveAnnotation: (id: string | null) => void;
  clearAnnotations: () => void;

  setCursorPosition: (x: number, y: number, value: number | null) => void;

  resetViewerState: () => void;
}

const DEFAULT_STATE = {
  currentFileId: null,
  isLoading: false,
  error: null,
  stretch: "asinh" as StretchType,
  colormap: "grayscale" as ColormapType,
  blackPoint: 0,
  whitePoint: 1,
  gamma: 1,
  currentHDU: 0,
  currentFrame: 0,
  totalFrames: 1,
  showGrid: false,
  showCrosshair: false,
  showPixelInfo: true,
  showMiniMap: false,
  annotations: [] as Annotation[],
  activeAnnotationId: null,
  cursorX: 0,
  cursorY: 0,
  cursorValue: null,
};

export const useViewerStore = create<ViewerStoreState>((set) => ({
  ...DEFAULT_STATE,

  setCurrentFile: (id) => set({ currentFileId: id, error: null }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),

  setStretch: (stretch) => set({ stretch }),
  setColormap: (colormap) => set({ colormap }),
  setBlackPoint: (value) => set({ blackPoint: value }),
  setWhitePoint: (value) => set({ whitePoint: value }),
  setGamma: (value) => set({ gamma: value }),

  setCurrentHDU: (index) => set({ currentHDU: index }),
  setCurrentFrame: (frame) => set({ currentFrame: frame }),
  setTotalFrames: (total) => set({ totalFrames: total }),

  toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
  toggleCrosshair: () => set((s) => ({ showCrosshair: !s.showCrosshair })),
  togglePixelInfo: () => set((s) => ({ showPixelInfo: !s.showPixelInfo })),
  toggleMiniMap: () => set((s) => ({ showMiniMap: !s.showMiniMap })),

  addAnnotation: (annotation) => set((s) => ({ annotations: [...s.annotations, annotation] })),

  removeAnnotation: (id) =>
    set((s) => ({
      annotations: s.annotations.filter((a) => a.id !== id),
      activeAnnotationId: s.activeAnnotationId === id ? null : s.activeAnnotationId,
    })),

  updateAnnotation: (id, updates) =>
    set((s) => ({
      annotations: s.annotations.map((a) => (a.id === id ? { ...a, ...updates } : a)),
    })),

  setActiveAnnotation: (id) => set({ activeAnnotationId: id }),

  clearAnnotations: () => set({ annotations: [], activeAnnotationId: null }),

  setCursorPosition: (x, y, value) => set({ cursorX: x, cursorY: y, cursorValue: value }),

  resetViewerState: () => set(DEFAULT_STATE),
}));
