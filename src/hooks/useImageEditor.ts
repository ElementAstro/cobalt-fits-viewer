/**
 * 图像编辑器 Hook
 * 管理编辑状态、操作历史和撤销/重做
 */

import { useState, useCallback, useRef } from "react";
import { InteractionManager } from "react-native";
import { applyOperation, type ImageEditOperation } from "../lib/utils/imageOperations";
import { fitsToRGBA } from "../lib/converter/formatConverter";
import type { StretchType, ColormapType } from "../lib/fits/types";

interface ImageState {
  pixels: Float32Array;
  width: number;
  height: number;
}

interface EditorState {
  current: ImageState | null;
  rgbaData: Uint8ClampedArray | null;
  isProcessing: boolean;
  error: string | null;
  canUndo: boolean;
  canRedo: boolean;
  historyLength: number;
  historyIndex: number;
}

const MAX_HISTORY = 10;

export function useImageEditor() {
  const [current, setCurrent] = useState<ImageState | null>(null);
  const [rgbaData, setRgbaData] = useState<Uint8ClampedArray | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const historyRef = useRef<ImageState[]>([]);
  const historyIndexRef = useRef(-1);

  const [historyLength, setHistoryLength] = useState(0);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const stretchRef = useRef<StretchType>("linear");
  const colormapRef = useRef<ColormapType>("grayscale");

  const updateRGBA = useCallback((state: ImageState) => {
    try {
      const rgba = fitsToRGBA(state.pixels, state.width, state.height, {
        stretch: stretchRef.current,
        colormap: colormapRef.current,
        blackPoint: 0,
        whitePoint: 1,
        gamma: 1,
      });
      setRgbaData(rgba);
    } catch (e) {
      setError(e instanceof Error ? e.message : "RGBA conversion failed");
    }
  }, []);

  const pushHistory = useCallback((state: ImageState) => {
    const history = historyRef.current;
    const idx = historyIndexRef.current;

    // 丢弃 redo 分支
    historyRef.current = history.slice(0, idx + 1);
    historyRef.current.push(state);

    // 限制历史长度
    if (historyRef.current.length > MAX_HISTORY) {
      historyRef.current = historyRef.current.slice(-MAX_HISTORY);
    }

    historyIndexRef.current = historyRef.current.length - 1;
    setHistoryLength(historyRef.current.length);
    setHistoryIndex(historyIndexRef.current);
  }, []);

  const initialize = useCallback(
    (
      pixels: Float32Array,
      width: number,
      height: number,
      stretch: StretchType = "linear",
      colormap: ColormapType = "grayscale",
    ) => {
      const state: ImageState = { pixels, width, height };
      stretchRef.current = stretch;
      colormapRef.current = colormap;

      historyRef.current = [state];
      historyIndexRef.current = 0;
      setHistoryLength(1);
      setHistoryIndex(0);

      setCurrent(state);
      updateRGBA(state);
      setError(null);
    },
    [updateRGBA],
  );

  const applyEdit = useCallback(
    (op: ImageEditOperation) => {
      if (!current) return;

      setIsProcessing(true);
      setError(null);

      // Defer heavy computation to avoid blocking UI animations
      InteractionManager.runAfterInteractions(() => {
        try {
          const result = applyOperation(current.pixels, current.width, current.height, op);
          const newState: ImageState = {
            pixels: result.pixels,
            width: result.width,
            height: result.height,
          };

          pushHistory(newState);
          setCurrent(newState);
          updateRGBA(newState);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Edit operation failed");
        } finally {
          setIsProcessing(false);
        }
      });
    },
    [current, pushHistory, updateRGBA],
  );

  const undo = useCallback(() => {
    const idx = historyIndexRef.current;
    if (idx <= 0) return;

    const newIdx = idx - 1;
    historyIndexRef.current = newIdx;
    setHistoryIndex(newIdx);

    const state = historyRef.current[newIdx];
    setCurrent(state);
    updateRGBA(state);
  }, [updateRGBA]);

  const redo = useCallback(() => {
    const idx = historyIndexRef.current;
    if (idx >= historyRef.current.length - 1) return;

    const newIdx = idx + 1;
    historyIndexRef.current = newIdx;
    setHistoryIndex(newIdx);

    const state = historyRef.current[newIdx];
    setCurrent(state);
    updateRGBA(state);
  }, [updateRGBA]);

  const updateDisplay = useCallback(
    (stretch: StretchType, colormap: ColormapType) => {
      stretchRef.current = stretch;
      colormapRef.current = colormap;
      if (current) {
        updateRGBA(current);
      }
    },
    [current, updateRGBA],
  );

  const state: EditorState = {
    current,
    rgbaData,
    isProcessing,
    error,
    canUndo: historyIndex > 0,
    canRedo: historyIndex < historyLength - 1,
    historyLength,
    historyIndex,
  };

  return {
    ...state,
    initialize,
    applyEdit,
    undo,
    redo,
    updateDisplay,
  };
}
