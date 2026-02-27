import { useEffect, useRef } from "react";
import { Platform } from "react-native";

interface VideoKeyboardHandlers {
  onPlayPause: () => void;
  onSeekBy: (sec: number) => void;
  onToggleMute: () => void;
  onToggleLoop: () => void;
  onVolumeChange: (v: number) => void;
  onFullscreen: () => void;
  volume: number;
}

export function useVideoKeyboard(handlers: VideoKeyboardHandlers) {
  const ref = useRef(handlers);
  ref.current = handlers;

  useEffect(() => {
    if (Platform.OS !== "web") return;

    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      const h = ref.current;
      switch (e.code) {
        case "Space":
          e.preventDefault();
          h.onPlayPause();
          break;
        case "ArrowLeft":
          h.onSeekBy(-5);
          break;
        case "ArrowRight":
          h.onSeekBy(5);
          break;
        case "ArrowUp":
          e.preventDefault();
          h.onVolumeChange(Math.min(1, h.volume + 0.1));
          break;
        case "ArrowDown":
          e.preventDefault();
          h.onVolumeChange(Math.max(0, h.volume - 0.1));
          break;
        case "KeyM":
          h.onToggleMute();
          break;
        case "KeyL":
          h.onToggleLoop();
          break;
        case "KeyF":
          h.onFullscreen();
          break;
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);
}
