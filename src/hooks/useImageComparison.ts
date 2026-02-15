/**
 * 图像对比模式状态管理
 */

import { useState, useCallback, useRef, useEffect } from "react";

export type CompareMode = "side-by-side" | "blink" | "overlay";

interface UseImageComparisonOptions {
  initialIds?: string[];
  initialMode?: CompareMode;
}

export function useImageComparison(options?: UseImageComparisonOptions) {
  const [imageIds, setImageIds] = useState<string[]>(options?.initialIds ?? []);
  const [mode, setMode] = useState<CompareMode>(options?.initialMode ?? "blink");
  const [activeIndex, setActiveIndex] = useState(0);
  const [blinkSpeed, setBlinkSpeed] = useState(1.5); // seconds
  const [overlayOpacity, setOverlayOpacity] = useState(0.5);
  const [isBlinkPlaying, setIsBlinkPlaying] = useState(false);
  const blinkTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const addImage = useCallback((id: string) => {
    setImageIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }, []);

  const removeImage = useCallback(
    (id: string) => {
      setImageIds((prev) => prev.filter((i) => i !== id));
      if (activeIndex >= imageIds.length - 1) {
        setActiveIndex(Math.max(0, imageIds.length - 2));
      }
    },
    [activeIndex, imageIds.length],
  );

  const nextImage = useCallback(() => {
    setActiveIndex((prev) => (prev + 1) % imageIds.length);
  }, [imageIds.length]);

  const prevImage = useCallback(() => {
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
    overlayOpacity,
    isBlinkPlaying,

    setImageIds,
    setMode,
    setActiveIndex,
    setBlinkSpeed,
    setOverlayOpacity,
    addImage,
    removeImage,
    nextImage,
    prevImage,
    toggleBlinkPlay,
  };
}
