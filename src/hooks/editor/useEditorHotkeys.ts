import { useEffect } from "react";
import { Platform } from "react-native";

interface UseEditorHotkeysOptions {
  enabled?: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onCancelTool: () => void;
  onToggleOriginal: () => void;
  onToggleHistogram: () => void;
  onTogglePixelInfo: () => void;
  onToggleMinimap: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onResetView?: () => void;
  onOneToOne?: () => void;
  isCropMode?: boolean;
  onCropConfirm?: () => void;
  onCropCancel?: () => void;
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return target.isContentEditable || tag === "input" || tag === "textarea" || tag === "select";
}

export function useEditorHotkeys({
  enabled = true,
  onUndo,
  onRedo,
  onCancelTool,
  onToggleOriginal,
  onToggleHistogram,
  onTogglePixelInfo,
  onToggleMinimap,
  onZoomIn,
  onZoomOut,
  onResetView,
  onOneToOne,
  isCropMode,
  onCropConfirm,
  onCropCancel,
}: UseEditorHotkeysOptions) {
  useEffect(() => {
    if (!enabled || Platform.OS !== "web") return;
    const handler = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;
      const key = event.key.toLowerCase();
      const ctrl = event.ctrlKey || event.metaKey;

      if (isCropMode) {
        if (key === "enter" && onCropConfirm) {
          event.preventDefault();
          onCropConfirm();
          return;
        }
        if (key === "escape" && onCropCancel) {
          event.preventDefault();
          onCropCancel();
          return;
        }
      }

      if (ctrl && event.shiftKey && key === "z") {
        event.preventDefault();
        onRedo();
      } else if (ctrl && key === "z") {
        event.preventDefault();
        onUndo();
      } else if (key === "escape") {
        event.preventDefault();
        onCancelTool();
      } else if (key === " ") {
        event.preventDefault();
        onToggleOriginal();
      } else if (key === "h") {
        event.preventDefault();
        onToggleHistogram();
      } else if (key === "p") {
        event.preventDefault();
        onTogglePixelInfo();
      } else if (key === "m") {
        event.preventDefault();
        onToggleMinimap();
      } else if ((key === "+" || key === "=") && onZoomIn) {
        event.preventDefault();
        onZoomIn();
      } else if ((key === "-" || key === "_") && onZoomOut) {
        event.preventDefault();
        onZoomOut();
      } else if (key === "0" && onResetView) {
        event.preventDefault();
        onResetView();
      } else if (key === "1" && onOneToOne) {
        event.preventDefault();
        onOneToOne();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    enabled,
    onUndo,
    onRedo,
    onCancelTool,
    onToggleOriginal,
    onToggleHistogram,
    onTogglePixelInfo,
    onToggleMinimap,
    onZoomIn,
    onZoomOut,
    onResetView,
    onOneToOne,
    isCropMode,
    onCropConfirm,
    onCropCancel,
  ]);
}
