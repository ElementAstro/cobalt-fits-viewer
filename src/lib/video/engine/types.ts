import type { FitsMetadata } from "../../fits/types";

export type VideoProcessingTag =
  | "trim"
  | "split"
  | "compress"
  | "transcode"
  | "merge"
  | "extract-audio"
  | "mute"
  | "cover";

export type VideoProfile = "compatibility" | "balanced" | "quality";
export type VideoTargetPreset = "1080p" | "720p" | "custom";

export interface TrimOptions {
  startMs: number;
  endMs: number;
  reencode?: boolean;
}

export interface SplitOptions {
  segments: Array<{ startMs: number; endMs: number; label?: string }>;
}

export interface CompressOptions {
  targetBitrateKbps?: number;
  crf?: number;
  maxWidth?: number;
  maxHeight?: number;
  targetPreset?: VideoTargetPreset;
}

export interface TranscodeOptions {
  videoCodec?: "h264" | "hevc";
  audioCodec?: "aac";
  targetBitrateKbps?: number;
  targetPreset?: VideoTargetPreset;
  maxWidth?: number;
  maxHeight?: number;
}

export interface MergeOptions {
  inputUris: string[];
}

export interface ExtractAudioOptions {
  audioCodec?: "aac" | "mp3";
  bitrateKbps?: number;
}

export interface CoverOptions {
  timeMs: number;
}

export interface RotateNormalizeOptions {
  rotationDeg: 0 | 90 | 180 | 270;
}

export interface VideoProcessingRequest {
  sourceId: string;
  sourceFilename: string;
  inputUri: string;
  operation: VideoProcessingTag;
  profile: VideoProfile;
  removeAudio?: boolean;
  outputDirUri?: string;
  outputFilename?: string;
  sourceDurationMs?: number;
  trim?: TrimOptions;
  split?: SplitOptions;
  compress?: CompressOptions;
  transcode?: TranscodeOptions;
  merge?: MergeOptions;
  extractAudio?: ExtractAudioOptions;
  cover?: CoverOptions;
  rotateNormalize?: RotateNormalizeOptions;
}

export interface VideoProcessingProgress {
  ratio: number;
  processedMs: number;
  durationMs?: number;
  rawLogLine?: string;
}

export interface VideoProcessingRunOptions {
  signal?: AbortSignal;
  onProgress?: (progress: VideoProcessingProgress) => void;
}

export interface VideoProcessingResult {
  outputUri: string;
  extraOutputUris?: string[];
  operation: VideoProcessingTag;
  sourceId: string;
  processingTag: FitsMetadata["processingTag"];
  logLines?: string[];
}

export interface VideoProcessingCapabilities {
  available: boolean;
  encoderNames: string[];
  h264Encoders: string[];
  hevcEncoders: string[];
  fallbackVideoEncoder?: string;
  unavailableReason?: string;
}

export interface VideoProcessingEngine {
  readonly id: string;
  isAvailable(): Promise<boolean>;
  getCapabilities(): Promise<VideoProcessingCapabilities>;
  run(
    request: VideoProcessingRequest,
    options?: VideoProcessingRunOptions,
  ): Promise<VideoProcessingResult>;
}
