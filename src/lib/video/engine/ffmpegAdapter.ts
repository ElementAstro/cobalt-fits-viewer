import { Directory, File, Paths } from "expo-file-system";
import { splitFilenameExtension } from "../../import/fileFormat";
import type {
  VideoProcessingEngine,
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
  options?: {
    videoCodec?: "h264" | "hevc";
    targetBitrateKbps?: number;
    crf?: number;
  },
): string[] {
  const preferredCodec = options?.videoCodec;
  const shouldUseHevc =
    preferredCodec === "hevc" || (profile === "quality" && preferredCodec !== "h264");
  const codec = shouldUseHevc ? "libx265" : "libx264";
  const args = ["-c:v", codec];

  if (!shouldUseHevc) {
    args.push("-pix_fmt", "yuv420p");
  }

  const crf = options?.crf ?? (profile === "compatibility" ? 23 : profile === "balanced" ? 21 : 18);
  args.push("-crf", String(clamp(Math.round(crf), 0, 51)));

  if (options?.targetBitrateKbps && options.targetBitrateKbps > 0) {
    args.push("-b:v", `${Math.round(options.targetBitrateKbps)}k`);
  }

  args.push(
    "-preset",
    profile === "quality" ? "slow" : profile === "balanced" ? "medium" : "veryfast",
  );
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
  inputUri: string,
  outputUri: string,
  options?: {
    trim?: { startMs: number; endMs: number; reencode?: boolean };
    scaleFilter?: string | null;
    muteAudio?: boolean;
    forceCodec?: "h264" | "hevc";
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
      ...buildVideoCodecArgs(request.profile, {
        videoCodec: options?.forceCodec,
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
): string {
  if (request.operation === "trim") {
    if (!request.trim) {
      throw new Error("trim_options_required");
    }
    return buildCoreCommand(request, request.inputUri, outputUri, {
      trim: request.trim,
    });
  }

  if (request.operation === "compress") {
    const scaleFilter = buildScaleFilter(
      request.compress?.targetPreset,
      request.compress?.maxWidth,
      request.compress?.maxHeight,
    );
    return buildCoreCommand(request, request.inputUri, outputUri, {
      scaleFilter,
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
    return buildCoreCommand(request, request.inputUri, outputUri, {
      scaleFilter,
      forceCodec: request.transcode?.videoCodec,
      targetBitrateKbps: request.transcode?.targetBitrateKbps,
    });
  }

  if (request.operation === "mute") {
    return buildCoreCommand(request, request.inputUri, outputUri, {
      muteAudio: true,
    });
  }

  if (request.operation === "extract-audio") {
    const codec = request.extractAudio?.audioCodec === "mp3" ? "libmp3lame" : "aac";
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
  return buildCoreCommand(request, request.inputUri, outputUri, {
    scaleFilter: rotationFilter,
  });
}

function tryBuildDefaultExecutor(): LocalFfmpegExecutor | null {
  try {
    // Optional dependency: execute only when ffmpeg-kit-react-native exists in the host app.

    const kit = require("ffmpeg-kit-react-native");
    const FFmpegKit = kit.FFmpegKit;
    const ReturnCode = kit.ReturnCode;

    if (!FFmpegKit || typeof FFmpegKit.executeAsync !== "function") return null;

    return (command, options) =>
      new Promise<FfmpegExecutionResult>((resolve, reject) => {
        const logs: string[] = [];
        const execute = () => {
          FFmpegKit.executeAsync(
            command,
            async (session: any) => {
              const returnCode = await session.getReturnCode();
              const success = ReturnCode?.isSuccess?.(returnCode) ?? false;
              const value = Number(returnCode?.getValue?.() ?? (success ? 0 : 1));
              resolve({
                returnCode: Number.isFinite(value) ? value : success ? 0 : 1,
                logLines: logs,
              });
            },
            (log: any) => {
              const line =
                typeof log?.getMessage === "function"
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

export class FfmpegVideoProcessingEngine implements VideoProcessingEngine {
  readonly id = "ffmpeg-local-adapter";

  private async resolveExecutor(): Promise<LocalFfmpegExecutor | null> {
    return overrideExecutor ?? tryBuildDefaultExecutor();
  }

  async isAvailable(): Promise<boolean> {
    const executor = await this.resolveExecutor();
    return Boolean(executor);
  }

  async run(
    request: VideoProcessingRequest,
    options?: VideoProcessingRunOptions,
  ): Promise<VideoProcessingResult> {
    const executor = await this.resolveExecutor();
    if (!executor) {
      throw new Error("ffmpeg_executor_unavailable");
    }

    const outputDir = ensureProcessingDir(request.outputDirUri);
    const logLines: string[] = [];
    const durationMs = request.sourceDurationMs;
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
        const command = buildCoreCommand(request, request.inputUri, outputFile.uri, {
          trim: {
            startMs: segment.startMs,
            endMs: segment.endMs,
            reencode: true,
          },
        });
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

    const command = buildFfmpegCommandForRequest(request, outputFile.uri, concatListFile?.uri);
    const result = await executor(command, { signal: options?.signal, onLog: emitLog });
    if (result.returnCode !== 0) {
      throw new Error("ffmpeg_failed");
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
