/**
 * 图像对比模式状态管理
 */

import { useState, useCallback, useRef, useEffect } from "react";

export type CompareMode = "side-by-side" | "blink" | "split";
type LegacyCompareMode = CompareMode | "overlay";

interface UseImageComparisonOptions {
  initialIds?: string[];
  initialMode?: LegacyCompareMode;
}

function normalizeMode(mode: LegacyCompareMode | undefined): CompareMode {
  if (!mode) return "blink";
  return mode === "overlay" ? "split" : mode;
}

function normalizeIds(ids: string[]) {
  const unique: string[] = [];
  for (const id of ids) {
    if (id && !unique.includes(id)) unique.push(id);
    if (unique.length >= 2) break;
  }
  return unique;
}

export function useImageComparison(options?: UseImageComparisonOptions) {
  const [imageIds, _setImageIds] = useState<string[]>(normalizeIds(options?.initialIds ?? []));
  const [mode, setMode] = useState<CompareMode>(normalizeMode(options?.initialMode));
  const [activeIndex, setActiveIndex] = useState(0);
  const [blinkSpeed, setBlinkSpeed] = useState(1.5); // seconds
  const [splitPosition, setSplitPosition] = useState(0.5);
  const [isBlinkPlaying, setIsBlinkPlaying] = useState(false);
  const blinkTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const setImageIds = useCallback((ids: string[]) => {
    _setImageIds(normalizeIds(ids));
    setActiveIndex(0);
  }, []);

  const addImage = useCallback((id: string) => {
    _setImageIds((prev) => {
      if (prev.includes(id)) return prev;
      if (prev.length < 2) return [...prev, id];
      return [prev[0], id];
    });
    setActiveIndex(0);
  }, []);

  const removeImage = useCallback((id: string) => {
    _setImageIds((prev) => prev.filter((i) => i !== id));
    setActiveIndex(0);
  }, []);

  const nextImage = useCallback(() => {
    if (imageIds.length <= 1) return;
    setActiveIndex((prev) => (prev + 1) % imageIds.length);
  }, [imageIds.length]);

  const prevImage = useCallback(() => {
    if (imageIds.length <= 1) return;
    setActiveIndex((prev) => (prev - 1 + imageIds.length) % imageIds.length);
  }, [imageIds.length]);

  const toggleBlinkPlay = useCallback(() => {
    setIsBlinkPlaying((prev) => !prev);
  }, []);

  // Blink timer
  useEffect(() => {
    if (isBlinkPlaying && mode === "blink" && imageIds.length > 1) {
      blinkTimerRef.current = setInterval(() => {
        setActiveIndex((prev) => (prev + 1) % imageIds.length);
      }, blinkSpeed * 1000);
    }
    return () => {
      if (blinkTimerRef.current) {
        clearInterval(blinkTimerRef.current);
        blinkTimerRef.current = null;
      }
    };
  }, [isBlinkPlaying, mode, imageIds.length, blinkSpeed]);

  return {
    imageIds,
    mode,
    activeIndex,
    blinkSpeed,
    splitPosition,
    isBlinkPlaying,

    setImageIds,
    setMode,
    setActiveIndex,
    setBlinkSpeed,
    setSplitPosition,
    addImage,
    removeImage,
    nextImage,
    prevImage,
    toggleBlinkPlay,
  };
}
