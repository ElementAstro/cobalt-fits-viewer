import type { VideoProcessingEngine } from "./types";
import { createFfmpegVideoProcessingEngine } from "./ffmpegAdapter";

let engine: VideoProcessingEngine | null = null;

export function getVideoProcessingEngine(): VideoProcessingEngine {
  if (!engine) {
    engine = createFfmpegVideoProcessingEngine();
  }
  return engine;
}

export function setVideoProcessingEngine(nextEngine: VideoProcessingEngine | null) {
  engine = nextEngine;
}

export * from "./types";
export * from "./ffmpegAdapter";
