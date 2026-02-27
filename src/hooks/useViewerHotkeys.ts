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
  onOneToOne?: () => void;
  onFit?: () => void;
  onPan?: (dx: number, dy: number) => void;
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
  onOneToOne,
  onFit,
  onPan,
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
      } else if (key === "1" && onOneToOne) {
        event.preventDefault();
        onOneToOne();
      } else if (key === "f" && onFit) {
        event.preventDefault();
        onFit();
      } else if (key === "arrowleft" && onPan) {
        event.preventDefault();
        onPan(-50, 0);
      } else if (key === "arrowright" && onPan) {
        event.preventDefault();
        onPan(50, 0);
      } else if (key === "arrowup" && onPan) {
        event.preventDefault();
        onPan(0, -50);
      } else if (key === "arrowdown" && onPan) {
        event.preventDefault();
        onPan(0, 50);
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
    onOneToOne,
    onFit,
    onPan,
  ]);
}
