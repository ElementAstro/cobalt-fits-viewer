import { Directory, File, Paths } from "expo-file-system";
import { splitFilenameExtension } from "../../import/fileFormat";
import type {
  VideoProcessingEngine,
  VideoProcessingCapabilities,
  VideoProcessingRequest,
  VideoProcessingResult,
  VideoProcessingRunOptions,
  VideoProfile,
  VideoTargetPreset,
  VideoProcessingTag,
} from "./types";

export interface FfmpegExecutionResult {
  returnCode: number;
  logLines?: string[];
}

export type LocalFfmpegExecutor = (
  command: string,
  options?: {
    signal?: AbortSignal;
    onLog?: (line: string) => void;
  },
) => Promise<FfmpegExecutionResult>;

let overrideExecutor: LocalFfmpegExecutor | null = null;

const PROCESSING_SUBDIR = "video_processing";
const H264_ENCODER_CANDIDATES = ["h264_videotoolbox", "h264_mediacodec", "mpeg4"] as const;
const HEVC_ENCODER_CANDIDATES = ["hevc_videotoolbox", "hevc_mediacodec"] as const;

interface EncoderSelection {
  requestedCodec: "h264" | "hevc";
  videoEncoder: string;
  effectiveCodec: "h264" | "hevc" | "mpeg4";
}

interface BuildCommandContext {
  encoderSelection: EncoderSelection;
}

const DEFAULT_BUILD_ENCODER_NAMES = [
  ...H264_ENCODER_CANDIDATES,
  ...HEVC_ENCODER_CANDIDATES,
] as const;

function resolvePreferredCodec(request: VideoProcessingRequest): "h264" | "hevc" {
  const requested = request.transcode?.videoCodec;
  if (requested === "h264") return "h264";
  if (requested === "hevc") return "hevc";
  return request.profile === "quality" ? "hevc" : "h264";
}

function pickEncoder(
  availableEncoders: string[],
  candidates: readonly string[],
): string | undefined {
  return candidates.find((candidate) => availableEncoders.includes(candidate));
}

function resolveEncoderSelection(
  request: VideoProcessingRequest,
  availableEncoders: string[],
): EncoderSelection {
  const requestedCodec = resolvePreferredCodec(request);
  if (requestedCodec === "hevc") {
    const hevcEncoder = pickEncoder(availableEncoders, HEVC_ENCODER_CANDIDATES);
    if (hevcEncoder) {
      return { requestedCodec, videoEncoder: hevcEncoder, effectiveCodec: "hevc" };
    }
    const fallbackH264 = pickEncoder(availableEncoders, H264_ENCODER_CANDIDATES);
    if (fallbackH264) {
      const effectiveCodec = fallbackH264 === "mpeg4" ? "mpeg4" : "h264";
      return { requestedCodec, videoEncoder: fallbackH264, effectiveCodec };
    }
    throw new Error("encoder_hevc_unavailable");
  }

  const h264Encoder = pickEncoder(availableEncoders, H264_ENCODER_CANDIDATES);
  if (h264Encoder) {
    const effectiveCodec = h264Encoder === "mpeg4" ? "mpeg4" : "h264";
    return { requestedCodec, videoEncoder: h264Encoder, effectiveCodec };
  }
  throw new Error("encoder_h264_unavailable");
}

function buildCommandContext(
  request: VideoProcessingRequest,
  availableEncoders: string[] = [...DEFAULT_BUILD_ENCODER_NAMES],
): BuildCommandContext {
  return {
    encoderSelection: resolveEncoderSelection(request, availableEncoders),
  };
}

export function setLocalFfmpegExecutor(executor: LocalFfmpegExecutor | null) {
  overrideExecutor = executor;
}

function ensureProcessingDir(outputDirUri?: string): Directory {
  const dir = outputDirUri
    ? new Directory(outputDirUri)
    : new Directory(Paths.cache, PROCESSING_SUBDIR);
  if (!dir.exists) {
    dir.create();
  }
  return dir;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function msToSecondsString(ms: number): string {
  return (Math.max(0, ms) / 1000).toFixed(3);
}

export function parseFfmpegTimestampToMs(value: string): number {
  const match = value.match(/^(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?$/);
  if (!match) return 0;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  const fractional = Number(`0.${match[4] ?? "0"}`);
  const totalSeconds = hours * 3600 + minutes * 60 + seconds + fractional;
  return Math.max(0, Math.round(totalSeconds * 1000));
}

export function parseProgressFromFfmpegLog(
  line: string,
  totalDurationMs?: number,
): { processedMs: number; ratio: number } | null {
  const timeMatch = line.match(/time=(\d{2}:\d{2}:\d{2}(?:\.\d+)?)/);
  if (!timeMatch) return null;
  const processedMs = parseFfmpegTimestampToMs(timeMatch[1]);
  if (!totalDurationMs || totalDurationMs <= 0) {
    return { processedMs, ratio: 0 };
  }
  return {
    processedMs,
    ratio: clamp(processedMs / totalDurationMs, 0, 1),
  };
}

function quoteArg(value: string): string {
  const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"${escaped}"`;
}

function buildScaleFilter(
  preset?: VideoTargetPreset,
  maxWidth?: number,
  maxHeight?: number,
): string | null {
  let width = maxWidth;
  let height = maxHeight;

  if (preset === "1080p") {
    width = 1920;
    height = 1080;
  } else if (preset === "720p") {
    width = 1280;
    height = 720;
  }

  if (!width && !height) return null;

  const targetWidth = width ?? 9999;
  const targetHeight = height ?? 9999;
  return `scale='min(iw,${targetWidth})':'min(ih,${targetHeight})':force_original_aspect_ratio=decrease`;
}

function buildVideoCodecArgs(
  profile: VideoProfile,
  encoderSelection: EncoderSelection,
  options?: {
    targetBitrateKbps?: number;
    crf?: number;
  },
): string[] {
  const args = ["-c:v", encoderSelection.videoEncoder];

  if (
    profile === "compatibility" &&
    (encoderSelection.effectiveCodec === "h264" || encoderSelection.effectiveCodec === "mpeg4")
  ) {
    args.push("-pix_fmt", "yuv420p");
  }

  if (encoderSelection.effectiveCodec === "mpeg4") {
    if (options?.targetBitrateKbps && options.targetBitrateKbps > 0) {
      args.push("-b:v", `${Math.round(options.targetBitrateKbps)}k`);
    } else {
      const qValue = profile === "quality" ? 3 : profile === "balanced" ? 4 : 6;
      args.push("-q:v", String(qValue));
    }
    return args;
  }

  const defaultBitrateKbps = profile === "quality" ? 6000 : profile === "balanced" ? 4000 : 2500;
  const bitrateKbps =
    options?.targetBitrateKbps && options.targetBitrateKbps > 0
      ? Math.round(options.targetBitrateKbps)
      : defaultBitrateKbps;
  args.push("-b:v", `${bitrateKbps}k`);

  const crf = options?.crf;
  if (
    typeof crf === "number" &&
    Number.isFinite(crf) &&
    encoderSelection.videoEncoder.startsWith("libx")
  ) {
    args.push("-crf", String(clamp(Math.round(crf), 0, 51)));
  }

  return args;
}

function buildDefaultAudioArgs(): string[] {
  return ["-c:a", "aac", "-b:a", "128k"];
}

function buildOutputFilename(
  request: VideoProcessingRequest,
  extOverride?: string,
  suffix?: string,
): string {
  const { baseName, extension } = splitFilenameExtension(request.sourceFilename);
  const base = (request.outputFilename ?? baseName ?? request.sourceFilename).replace(/\s+/g, "_");
  const suffixPart = suffix ? `_${suffix}` : "";
  const ext = extOverride ?? extension ?? ".mp4";
  const normalizedExt = ext.startsWith(".") ? ext : `.${ext}`;
  return `${base}${suffixPart}${normalizedExt}`;
}

function commandToString(args: string[]): string {
  return args.map((arg) => quoteArg(arg)).join(" ");
}

function mapProcessingTag(operation: VideoProcessingTag): VideoProcessingResult["processingTag"] {
  return operation;
}

function buildConcatListFile(outputDir: Directory, inputUris: string[]): File {
  const listFile = new File(outputDir, `concat_${Date.now()}.txt`);
  const content = inputUris
    .map((uri) => {
      const normalized = uri.replace(/'/g, `'\\''`);
      return `file '${normalized}'`;
    })
    .join("\n");
  listFile.write(content);
  return listFile;
}

function buildCoreCommand(
  request: VideoProcessingRequest,
  commandContext: BuildCommandContext,
  inputUri: string,
  outputUri: string,
  options?: {
    trim?: { startMs: number; endMs: number; reencode?: boolean };
    scaleFilter?: string | null;
    muteAudio?: boolean;
    targetBitrateKbps?: number;
    crf?: number;
  },
): string {
  const args = ["-y", "-hide_banner", "-loglevel", "info"];

  if (options?.trim) {
    args.push("-ss", msToSecondsString(options.trim.startMs));
    args.push("-to", msToSecondsString(options.trim.endMs));
  }

  args.push("-i", inputUri);

  if (options?.scaleFilter) {
    args.push("-vf", options.scaleFilter);
  }

  if (options?.muteAudio) {
    args.push("-an");
  } else {
    args.push(...buildDefaultAudioArgs());
  }

  if (options?.trim?.reencode === false && !options.scaleFilter && !options.muteAudio) {
    args.push("-c", "copy");
  } else {
    args.push(
      ...buildVideoCodecArgs(request.profile, commandContext.encoderSelection, {
        targetBitrateKbps: options?.targetBitrateKbps,
        crf: options?.crf,
      }),
    );
  }

  args.push("-movflags", "+faststart", outputUri);
  return commandToString(args);
}

export function buildFfmpegCommandForRequest(
  request: VideoProcessingRequest,
  outputUri: string,
  concatListUri?: string,
  commandContext?: BuildCommandContext,
): string {
  const resolveContext = () => commandContext ?? buildCommandContext(request);

  if (request.operation === "trim") {
    if (!request.trim) {
      throw new Error("trim_options_required");
    }
    return buildCoreCommand(request, resolveContext(), request.inputUri, outputUri, {
      trim: request.trim,
      muteAudio: request.removeAudio,
    });
  }

  if (request.operation === "compress") {
    const scaleFilter = buildScaleFilter(
      request.compress?.targetPreset,
      request.compress?.maxWidth,
      request.compress?.maxHeight,
    );
    return buildCoreCommand(request, resolveContext(), request.inputUri, outputUri, {
      scaleFilter,
      muteAudio: request.removeAudio,
      targetBitrateKbps: request.compress?.targetBitrateKbps,
      crf: request.compress?.crf,
    });
  }

  if (request.operation === "transcode") {
    const scaleFilter = buildScaleFilter(
      request.transcode?.targetPreset,
      request.transcode?.maxWidth,
      request.transcode?.maxHeight,
    );
    return buildCoreCommand(request, resolveContext(), request.inputUri, outputUri, {
      scaleFilter,
      muteAudio: request.removeAudio,
      targetBitrateKbps: request.transcode?.targetBitrateKbps,
    });
  }

  if (request.operation === "mute") {
    return buildCoreCommand(request, resolveContext(), request.inputUri, outputUri, {
      muteAudio: true,
    });
  }

  if (request.operation === "extract-audio") {
    const codec = request.extractAudio?.audioCodec === "mp3" ? "mp3" : "aac";
    const bitrate = request.extractAudio?.bitrateKbps ?? 192;
    return commandToString([
      "-y",
      "-hide_banner",
      "-loglevel",
      "info",
      "-i",
      request.inputUri,
      "-vn",
      "-c:a",
      codec,
      "-b:a",
      `${Math.round(Math.max(32, bitrate))}k`,
      outputUri,
    ]);
  }

  if (request.operation === "cover") {
    const at = Math.max(0, request.cover?.timeMs ?? 0);
    return commandToString([
      "-y",
      "-hide_banner",
      "-loglevel",
      "info",
      "-ss",
      msToSecondsString(at),
      "-i",
      request.inputUri,
      "-frames:v",
      "1",
      "-q:v",
      "2",
      outputUri,
    ]);
  }

  if (request.operation === "merge") {
    if (!concatListUri) {
      throw new Error("concat_list_required");
    }
    return commandToString([
      "-y",
      "-hide_banner",
      "-loglevel",
      "info",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      concatListUri,
      "-c",
      "copy",
      "-movflags",
      "+faststart",
      outputUri,
    ]);
  }

  if (request.operation === "split") {
    throw new Error("split_requires_segment_builder");
  }

  const rotation = request.rotateNormalize?.rotationDeg ?? 0;
  const rotationFilter =
    rotation === 90
      ? "transpose=1"
      : rotation === 180
        ? "transpose=1,transpose=1"
        : rotation === 270
          ? "transpose=2"
          : null;
  return buildCoreCommand(request, resolveContext(), request.inputUri, outputUri, {
    scaleFilter: rotationFilter,
    muteAudio: request.removeAudio,
  });
}

function tryBuildDefaultExecutor(): LocalFfmpegExecutor | null {
  try {
    // Optional dependency: execute only when ffmpeg-kit-react-native exists in the host app.

    const kit = require("ffmpeg-kit-react-native");
    const FFmpegKit = kit.FFmpegKit;
    const ReturnCode = kit.ReturnCode;

    if (!FFmpegKit || typeof FFmpegKit.executeAsync !== "function") return null;

    type FfmpegKitSession = {
      getReturnCode?: () => Promise<unknown>;
    };
    type FfmpegKitReturnCode = {
      getValue?: () => unknown;
    };
    type FfmpegKitLog = {
      getMessage?: () => string;
    };

    return (command, options) =>
      new Promise<FfmpegExecutionResult>((resolve, reject) => {
        const logs: string[] = [];
        const execute = () => {
          FFmpegKit.executeAsync(
            command,
            async (session: FfmpegKitSession) => {
              const returnCode = await session.getReturnCode?.();
              const success = ReturnCode?.isSuccess?.(returnCode) ?? false;
              const value = Number(
                (returnCode as FfmpegKitReturnCode | undefined)?.getValue?.() ?? (success ? 0 : 1),
              );
              resolve({
                returnCode: Number.isFinite(value) ? value : success ? 0 : 1,
                logLines: logs,
              });
            },
            (log: FfmpegKitLog | string) => {
              const line =
                typeof log !== "string" && typeof log.getMessage === "function"
                  ? String(log.getMessage())
                  : typeof log === "string"
                    ? log
                    : "";
              if (!line) return;
              logs.push(line);
              options?.onLog?.(line);
            },
          );
        };

        if (options?.signal?.aborted) {
          reject(new Error("video_processing_cancelled"));
          return;
        }

        const onAbort = () => {
          try {
            FFmpegKit.cancel();
          } catch {
            // noop
          }
          reject(new Error("video_processing_cancelled"));
        };

        options?.signal?.addEventListener("abort", onAbort, { once: true });
        execute();
      });
  } catch {
    return null;
  }
}

function parseEncoderNames(logLines: string[] = []): string[] {
  const names = new Set<string>();
  for (const line of logLines) {
    const match = line.match(/^[\sA-Z.]{6}\s+([a-z0-9_]+)\s+/i);
    if (match?.[1]) {
      names.add(match[1].toLowerCase());
    }
  }
  return Array.from(names);
}

function buildCapabilitiesFromEncoders(
  encoderNames: string[],
  unavailableReason?: string,
): VideoProcessingCapabilities {
  const normalized = Array.from(new Set(encoderNames.map((name) => name.toLowerCase()))).sort();
  const h264Encoders = H264_ENCODER_CANDIDATES.filter((name) => normalized.includes(name));
  const hevcEncoders = HEVC_ENCODER_CANDIDATES.filter((name) => normalized.includes(name));
  const fallbackVideoEncoder = pickEncoder(normalized, H264_ENCODER_CANDIDATES);
  return {
    available: normalized.length > 0,
    encoderNames: normalized,
    h264Encoders: [...h264Encoders],
    hevcEncoders: [...hevcEncoders],
    fallbackVideoEncoder,
    unavailableReason,
  };
}

async function probeCapabilities(
  executor: LocalFfmpegExecutor,
): Promise<VideoProcessingCapabilities> {
  try {
    const result = await executor(commandToString(["-hide_banner", "-encoders"]));
    const parsed = parseEncoderNames(result.logLines);
    if (parsed.length > 0) {
      return buildCapabilitiesFromEncoders(parsed);
    }
    const fallback = buildCapabilitiesFromEncoders(
      [...DEFAULT_BUILD_ENCODER_NAMES],
      result.returnCode === 0 ? "encoder_probe_empty" : "encoder_probe_failed",
    );
    return {
      ...fallback,
      available: true,
    };
  } catch {
    const fallback = buildCapabilitiesFromEncoders(
      [...DEFAULT_BUILD_ENCODER_NAMES],
      "encoder_probe_failed",
    );
    return {
      ...fallback,
      available: true,
    };
  }
}

export class FfmpegVideoProcessingEngine implements VideoProcessingEngine {
  readonly id = "ffmpeg-local-adapter";
  private capabilitiesPromise: Promise<VideoProcessingCapabilities> | null = null;

  private async resolveExecutor(): Promise<LocalFfmpegExecutor | null> {
    return overrideExecutor ?? tryBuildDefaultExecutor();
  }

  async getCapabilities(): Promise<VideoProcessingCapabilities> {
    if (this.capabilitiesPromise) {
      return this.capabilitiesPromise;
    }

    const executor = await this.resolveExecutor();
    if (!executor) {
      return {
        available: false,
        encoderNames: [],
        h264Encoders: [],
        hevcEncoders: [],
        unavailableReason: "ffmpeg_executor_unavailable",
      };
    }

    this.capabilitiesPromise = probeCapabilities(executor);
    return this.capabilitiesPromise;
  }

  async isAvailable(): Promise<boolean> {
    const capabilities = await this.getCapabilities();
    return capabilities.available;
  }

  async run(
    request: VideoProcessingRequest,
    options?: VideoProcessingRunOptions,
  ): Promise<VideoProcessingResult> {
    const executor = await this.resolveExecutor();
    if (!executor) {
      throw new Error("ffmpeg_executor_unavailable");
    }
    const capabilities = await this.getCapabilities();
    if (!capabilities.available) {
      throw new Error(capabilities.unavailableReason ?? "ffmpeg_encoder_probe_unavailable");
    }

    const outputDir = ensureProcessingDir(request.outputDirUri);
    const logLines: string[] = [];
    const durationMs = request.sourceDurationMs;
    const requiresVideoEncoder =
      request.operation !== "extract-audio" &&
      request.operation !== "cover" &&
      request.operation !== "merge";
    const commandContext = requiresVideoEncoder
      ? buildCommandContext(request, capabilities.encoderNames)
      : undefined;
    const emitLog = (line: string) => {
      logLines.push(line);
      const progress = parseProgressFromFfmpegLog(line, durationMs);
      if (!progress || !options?.onProgress) return;
      options.onProgress({
        ratio: progress.ratio,
        processedMs: progress.processedMs,
        durationMs,
        rawLogLine: line,
      });
    };

    if (request.operation === "split") {
      const segments = request.split?.segments ?? [];
      if (!segments.length) {
        throw new Error("split_segments_required");
      }
      const outputs: string[] = [];
      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        const outputFilename = buildOutputFilename(request, ".mp4", `segment_${i + 1}`);
        const outputFile = new File(outputDir, outputFilename);
        if (!commandContext) {
          throw new Error("encoder_h264_unavailable");
        }
        const command = buildCoreCommand(
          request,
          commandContext,
          request.inputUri,
          outputFile.uri,
          {
            trim: {
              startMs: segment.startMs,
              endMs: segment.endMs,
              reencode: true,
            },
            muteAudio: request.removeAudio,
          },
        );
        const result = await executor(command, { signal: options?.signal, onLog: emitLog });
        if (result.returnCode !== 0) {
          throw new Error(`ffmpeg_failed_split_segment_${i + 1}`);
        }
        outputs.push(outputFile.uri);
      }

      return {
        outputUri: outputs[0],
        extraOutputUris: outputs.slice(1),
        operation: request.operation,
        sourceId: request.sourceId,
        processingTag: mapProcessingTag(request.operation),
        logLines,
      };
    }

    let outputExtension = ".mp4";
    if (request.operation === "extract-audio") {
      outputExtension = request.extractAudio?.audioCodec === "mp3" ? ".mp3" : ".m4a";
    } else if (request.operation === "cover") {
      outputExtension = ".jpg";
    }
    const outputFilename = buildOutputFilename(request, outputExtension);
    const outputFile = new File(outputDir, outputFilename);

    let concatListFile: File | null = null;
    if (request.operation === "merge") {
      const inputs = request.merge?.inputUris ?? [];
      if (inputs.length < 2) {
        throw new Error("merge_inputs_required");
      }
      concatListFile = buildConcatListFile(outputDir, inputs);
    }

    const command = buildFfmpegCommandForRequest(
      request,
      outputFile.uri,
      concatListFile?.uri,
      commandContext,
    );
    const result = await executor(command, { signal: options?.signal, onLog: emitLog });
    if (result.returnCode !== 0) {
      throw new Error(`ffmpeg_failed_${request.operation}`);
    }

    return {
      outputUri: outputFile.uri,
      operation: request.operation,
      sourceId: request.sourceId,
      processingTag: mapProcessingTag(request.operation),
      logLines,
    };
  }
}

export function createFfmpegVideoProcessingEngine(): VideoProcessingEngine {
  return new FfmpegVideoProcessingEngine();
}
