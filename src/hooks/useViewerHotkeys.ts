import { useEffect } from "react";
import { Platform } from "react-native";

interface UseViewerHotkeysOptions {
  enabled?: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  onToggleGrid: () => void;
  onToggleCrosshair: () => void;
  onToggleMinimap: () => void;
  onTogglePixelInfo: () => void;
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return target.isContentEditable || tag === "input" || tag === "textarea" || tag === "select";
}

export function useViewerHotkeys({
  enabled = true,
  onZoomIn,
  onZoomOut,
  onResetView,
  onToggleGrid,
  onToggleCrosshair,
  onToggleMinimap,
  onTogglePixelInfo,
}: UseViewerHotkeysOptions) {
  useEffect(() => {
    if (!enabled || Platform.OS !== "web") return;
    const handler = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;
      const key = event.key.toLowerCase();
      if (key === "+" || key === "=") {
        event.preventDefault();
        onZoomIn();
      } else if (key === "-" || key === "_") {
        event.preventDefault();
        onZoomOut();
      } else if (key === "0") {
        event.preventDefault();
        onResetView();
      } else if (key === "g") {
        event.preventDefault();
        onToggleGrid();
      } else if (key === "c") {
        event.preventDefault();
        onToggleCrosshair();
      } else if (key === "m") {
        event.preventDefault();
        onToggleMinimap();
      } else if (key === "p") {
        event.preventDefault();
        onTogglePixelInfo();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    enabled,
    onZoomIn,
    onZoomOut,
    onResetView,
    onToggleGrid,
    onToggleCrosshair,
    onToggleMinimap,
    onTogglePixelInfo,
  ]);
}
