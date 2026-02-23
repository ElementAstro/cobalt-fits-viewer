export function formatVideoDuration(durationMs: number | null | undefined): string {
  if (!durationMs || durationMs <= 0) return "00:00";
  const totalSeconds = Math.floor(durationMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function formatVideoDurationWithMs(durationMs: number | null | undefined): string {
  if (!durationMs || durationMs <= 0) return "00:00.0";
  const totalMs = Math.round(durationMs);
  const hours = Math.floor(totalMs / 3600000);
  const minutes = Math.floor((totalMs % 3600000) / 60000);
  const seconds = Math.floor((totalMs % 60000) / 1000);
  const tenths = Math.floor((totalMs % 1000) / 100);

  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${tenths}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${tenths}`;
}

export function formatVideoResolution(
  width: number | null | undefined,
  height: number | null | undefined,
): string {
  if (!width || !height) return "";
  return `${Math.round(width)}×${Math.round(height)}`;
}

const ENGINE_ERROR_I18N: Array<[prefix: string, i18nKey: string]> = [
  ["encoder_hevc_unavailable", "settings.videoErrHevcUnavailable"],
  ["encoder_h264_unavailable", "settings.videoErrH264Unavailable"],
  ["ffmpeg_encoder_probe_unavailable", "settings.videoErrEncoderProbeUnavailable"],
  ["ffmpeg_executor_unavailable", "settings.videoErrExecutorUnavailable"],
  ["ffmpeg_failed_split_segment", "settings.videoErrSplitSegmentFailed"],
  ["ffmpeg_failed", "settings.videoErrProcessingFailed"],
  ["split_segments_required", "settings.videoErrSplitSegmentsRequired"],
  ["merge_inputs_required", "settings.videoErrMergeInputsRequired"],
  ["watermark_text_required", "settings.videoErrWatermarkTextRequired"],
  ["gif_options_required", "settings.videoErrGifOptionsRequired"],
  ["timelapse_images_required", "settings.videoErrTimelapseImagesRequired"],
];

export function translateEngineError(code: string | undefined, t: (key: string) => string): string {
  if (!code) return "";
  const match = ENGINE_ERROR_I18N.find(([prefix]) => code.startsWith(prefix));
  if (!match) return code;
  const translated = t(match[1]);
  return translated === match[1] ? code : translated;
}

export function taskStatusColor(status: string): "default" | "success" | "danger" | "warning" {
  if (status === "completed") return "success";
  if (status === "failed") return "danger";
  if (status === "running") return "warning";
  return "default";
}

export function translateTaskStatus(status: string, t: (key: string) => string): string {
  const key = `settings.videoTaskStatus_${status}`;
  const translated = t(key);
  return translated === key ? status : translated;
}

export function estimateOutputSizeBytes(
  durationMs: number | undefined,
  targetBitrateKbps: number | undefined,
): number | null {
  if (!durationMs || durationMs <= 0 || !targetBitrateKbps || targetBitrateKbps <= 0) return null;
  return Math.round(((targetBitrateKbps * 1000) / 8) * (durationMs / 1000));
}
