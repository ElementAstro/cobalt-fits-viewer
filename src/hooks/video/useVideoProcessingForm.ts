import { useCallback, useEffect, useMemo, useState } from "react";
import type { FitsMetadata } from "../lib/fits/types";
import type {
  VideoProcessingRequest,
  VideoProcessingTag,
  VideoProfile,
  WatermarkPosition,
} from "../lib/video/engine";

type PresetValue = "1080p" | "720p" | "custom";

export interface VideoProcessingFormState {
  operationValue: VideoProcessingTag;
  profile: VideoProfile;
  targetPreset: PresetValue;
  trimStartMs: string;
  trimEndMs: string;
  splitSegmentRows: Array<{ start: string; end: string }>;
  targetBitrateKbps: string;
  crf: string;
  coverTimeMs: string;
  removeAudio: boolean;
  mergeInputUris: string;
  mergeFiles: FitsMetadata[];
  showMergePicker: boolean;
  rotationDeg: string;
  speedFactor: string;
  watermarkText: string;
  watermarkPosition: WatermarkPosition;
  watermarkFontSize: string;
  watermarkFontColor: string;
  watermarkOpacity: string;
  gifStartMs: string;
  gifDurationMs: string;
  gifWidth: string;
  gifFps: string;
  customWidth: string;
  customHeight: string;
  timelapseFiles: FitsMetadata[];
  timelapseFps: string;
  timelapseWidth: string;
  timelapseHeight: string;
  showTimelapsePicker: boolean;
  extractAudioCodec: "aac" | "mp3";
  extractAudioBitrate: string;
  submitError: string | null;
  canSubmit: boolean;
  canApplyRemoveAudio: boolean;
}

export interface VideoProcessingFormSetters {
  setOperationValue: (value: VideoProcessingTag) => void;
  setProfile: (value: VideoProfile) => void;
  setTargetPreset: (value: PresetValue) => void;
  setTrimStartMs: (value: string) => void;
  setTrimEndMs: (value: string) => void;
  setSplitSegmentRows: React.Dispatch<React.SetStateAction<Array<{ start: string; end: string }>>>;
  setTargetBitrateKbps: (value: string) => void;
  setCrf: (value: string) => void;
  setCoverTimeMs: (value: string) => void;
  setRemoveAudio: (value: boolean) => void;
  setMergeInputUris: (value: string) => void;
  setMergeFiles: React.Dispatch<React.SetStateAction<FitsMetadata[]>>;
  setShowMergePicker: (value: boolean) => void;
  setRotationDeg: (value: string) => void;
  setSpeedFactor: (value: string) => void;
  setWatermarkText: (value: string) => void;
  setWatermarkPosition: (value: WatermarkPosition) => void;
  setWatermarkFontSize: (value: string) => void;
  setWatermarkFontColor: (value: string) => void;
  setWatermarkOpacity: (value: string) => void;
  setGifStartMs: (value: string) => void;
  setGifDurationMs: (value: string) => void;
  setGifWidth: (value: string) => void;
  setGifFps: (value: string) => void;
  setCustomWidth: (value: string) => void;
  setCustomHeight: (value: string) => void;
  setTimelapseFiles: React.Dispatch<React.SetStateAction<FitsMetadata[]>>;
  setTimelapseFps: (value: string) => void;
  setTimelapseWidth: (value: string) => void;
  setTimelapseHeight: (value: string) => void;
  setShowTimelapsePicker: (value: boolean) => void;
  setExtractAudioCodec: (value: "aac" | "mp3") => void;
  setExtractAudioBitrate: (value: string) => void;
}

export function useVideoProcessingForm(
  file: FitsMetadata | null,
  defaultProfile: VideoProfile,
  defaultPreset: PresetValue,
  t: (key: string) => string,
) {
  const [operationValue, setOperationValue] = useState<VideoProcessingTag>("trim");
  const [profile, setProfile] = useState<VideoProfile>(defaultProfile);
  const [targetPreset, setTargetPreset] = useState<PresetValue>(defaultPreset);
  const [trimStartMs, setTrimStartMs] = useState("0");
  const [trimEndMs, setTrimEndMs] = useState("10000");
  const [splitSegmentRows, setSplitSegmentRows] = useState<Array<{ start: string; end: string }>>([
    { start: "0", end: "5000" },
    { start: "5000", end: "10000" },
  ]);
  const [targetBitrateKbps, setTargetBitrateKbps] = useState("4000");
  const [crf, setCrf] = useState("23");
  const [coverTimeMs, setCoverTimeMs] = useState("1000");
  const [removeAudio, setRemoveAudio] = useState(false);
  const [mergeInputUris, setMergeInputUris] = useState("");
  const [mergeFiles, setMergeFiles] = useState<FitsMetadata[]>([]);
  const [showMergePicker, setShowMergePicker] = useState(false);
  const [rotationDeg, setRotationDeg] = useState("90");
  const [speedFactor, setSpeedFactor] = useState("2");
  const [watermarkText, setWatermarkText] = useState("");
  const [watermarkPosition, setWatermarkPosition] = useState<WatermarkPosition>("bottom-right");
  const [watermarkFontSize, setWatermarkFontSize] = useState("24");
  const [watermarkFontColor, setWatermarkFontColor] = useState("white");
  const [watermarkOpacity, setWatermarkOpacity] = useState("1");
  const [gifStartMs, setGifStartMs] = useState("0");
  const [gifDurationMs, setGifDurationMs] = useState("3000");
  const [gifWidth, setGifWidth] = useState("480");
  const [gifFps, setGifFps] = useState("10");
  const [customWidth, setCustomWidth] = useState("");
  const [customHeight, setCustomHeight] = useState("");
  const [timelapseFiles, setTimelapseFiles] = useState<FitsMetadata[]>([]);
  const [timelapseFps, setTimelapseFps] = useState("24");
  const [timelapseWidth, setTimelapseWidth] = useState("");
  const [timelapseHeight, setTimelapseHeight] = useState("");
  const [showTimelapsePicker, setShowTimelapsePicker] = useState(false);
  const [extractAudioCodec, setExtractAudioCodec] = useState<"aac" | "mp3">("aac");
  const [extractAudioBitrate, setExtractAudioBitrate] = useState("192");
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!file) return;
    const duration = Math.max(1000, file.durationMs ?? 10000);
    setTrimStartMs("0");
    setTrimEndMs(String(duration));
    const half = Math.round(duration / 2);
    setSplitSegmentRows([
      { start: "0", end: String(half) },
      { start: String(half), end: String(duration) },
    ]);
    setCoverTimeMs(String(Math.min(1000, duration)));
    setMergeFiles([]);
    setMergeInputUris("");
    setTimelapseFiles([]);
    setCustomWidth("");
    setCustomHeight("");
    setTimelapseWidth("");
    setTimelapseHeight("");
    setSubmitError(null);
    if (file.bitrateKbps && file.bitrateKbps > 0) {
      setTargetBitrateKbps(String(Math.round(file.bitrateKbps * 0.7)));
    }
  }, [file]);

  useEffect(() => {
    if (
      operationValue &&
      !["trim", "split", "compress", "transcode", "rotate", "speed", "watermark"].includes(
        operationValue,
      )
    ) {
      setRemoveAudio(false);
    }
    setSubmitError(null);
  }, [operationValue]);

  const canSubmit = useMemo(() => Boolean(file), [file]);
  const canApplyRemoveAudio =
    operationValue === "trim" ||
    operationValue === "split" ||
    operationValue === "compress" ||
    operationValue === "transcode" ||
    operationValue === "rotate" ||
    operationValue === "speed" ||
    operationValue === "watermark";

  const buildRequest = useCallback((): VideoProcessingRequest | null => {
    if (!file) return null;
    setSubmitError(null);
    const request: VideoProcessingRequest = {
      sourceId: file.id,
      sourceFilename: file.filename,
      inputUri: file.filepath,
      operation: operationValue,
      profile,
      sourceDurationMs: file.durationMs,
    };

    if (operationValue === "trim") {
      const start = Math.round(Number(trimStartMs));
      const end = Math.round(Number(trimEndMs));
      if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start) {
        setSubmitError(t("settings.videoErrorTrimRange"));
        return null;
      }
      request.trim = { startMs: start, endMs: end, reencode: true };
    } else if (operationValue === "split") {
      const segments = splitSegmentRows
        .map((row) => ({
          startMs: Math.round(Number(row.start)),
          endMs: Math.round(Number(row.end)),
        }))
        .filter(
          (seg) =>
            Number.isFinite(seg.startMs) &&
            Number.isFinite(seg.endMs) &&
            seg.startMs >= 0 &&
            seg.endMs > seg.startMs,
        );
      if (segments.length === 0) {
        setSubmitError(t("settings.videoErrorSplitSegments"));
        return null;
      }
      request.split = { segments };
    } else if (operationValue === "compress") {
      const parsedWidth = Math.round(Number(customWidth));
      const parsedHeight = Math.round(Number(customHeight));
      request.compress = {
        targetPreset,
        targetBitrateKbps: Math.max(300, Math.round(Number(targetBitrateKbps) || 300)),
        crf: Math.max(0, Math.min(51, Math.round(Number(crf) || 23))),
        maxWidth: targetPreset === "custom" && parsedWidth > 0 ? parsedWidth : undefined,
        maxHeight: targetPreset === "custom" && parsedHeight > 0 ? parsedHeight : undefined,
      };
    } else if (operationValue === "transcode") {
      const parsedWidth = Math.round(Number(customWidth));
      const parsedHeight = Math.round(Number(customHeight));
      request.transcode = {
        videoCodec: profile === "quality" ? "hevc" : "h264",
        audioCodec: "aac",
        targetPreset,
        targetBitrateKbps: Math.max(300, Math.round(Number(targetBitrateKbps) || 300)),
        maxWidth: targetPreset === "custom" && parsedWidth > 0 ? parsedWidth : undefined,
        maxHeight: targetPreset === "custom" && parsedHeight > 0 ? parsedHeight : undefined,
      };
    } else if (operationValue === "merge") {
      const urisFromPicker = mergeFiles.map((f) => f.filepath);
      const urisFromText = mergeInputUris
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      const merged = urisFromPicker.length >= 2 ? urisFromPicker : urisFromText;
      if (merged.length < 2) {
        setSubmitError(t("settings.videoErrorMergeInputs"));
        return null;
      }
      request.merge = { inputUris: merged };
    } else if (operationValue === "mute") {
      request.operation = "mute";
    } else if (operationValue === "extract-audio") {
      request.extractAudio = {
        audioCodec: extractAudioCodec,
        bitrateKbps: Math.max(32, Math.round(Number(extractAudioBitrate) || 192)),
      };
    } else if (operationValue === "rotate") {
      const deg = Number(rotationDeg);
      if (deg !== 90 && deg !== 180 && deg !== 270) {
        setSubmitError(t("settings.videoErrorRotation"));
        return null;
      }
      request.rotateNormalize = { rotationDeg: deg as 90 | 180 | 270 };
    } else if (operationValue === "speed") {
      const factor = Number(speedFactor);
      if (!Number.isFinite(factor) || factor < 0.25 || factor > 4) {
        setSubmitError(t("settings.videoErrorSpeedFactor"));
        return null;
      }
      request.speed = { factor };
    } else if (operationValue === "watermark") {
      if (!watermarkText.trim()) {
        setSubmitError(t("settings.videoErrorWatermarkText"));
        return null;
      }
      request.watermark = {
        text: watermarkText.trim(),
        position: watermarkPosition,
        fontSize: Math.max(8, Math.min(120, Math.round(Number(watermarkFontSize) || 24))),
        fontColor: watermarkFontColor || "white",
        opacity: Math.max(0, Math.min(1, Number(watermarkOpacity) || 1)),
      };
    } else if (operationValue === "gif") {
      const startMs = Math.round(Number(gifStartMs));
      const durationMs = Math.round(Number(gifDurationMs));
      if (!Number.isFinite(startMs) || startMs < 0) {
        setSubmitError(t("settings.videoErrorGifStart"));
        return null;
      }
      if (!Number.isFinite(durationMs) || durationMs < 100) {
        setSubmitError(t("settings.videoErrorGifDuration"));
        return null;
      }
      request.gif = {
        startMs,
        durationMs,
        width: Math.max(60, Math.round(Number(gifWidth) || 480)),
        fps: Math.max(1, Math.min(30, Math.round(Number(gifFps) || 10))),
      };
    } else if (operationValue === "cover") {
      const coverAtMs = Math.round(Number(coverTimeMs));
      if (!Number.isFinite(coverAtMs) || coverAtMs < 0) {
        setSubmitError(t("settings.videoErrorCoverTime"));
        return null;
      }
      request.cover = { timeMs: coverAtMs };
    } else if (operationValue === "timelapse") {
      if (timelapseFiles.length < 2) {
        setSubmitError(t("settings.videoErrorTimelapseImages"));
        return null;
      }
      const fps = Math.max(1, Math.min(60, Math.round(Number(timelapseFps) || 24)));
      const tw = Math.round(Number(timelapseWidth));
      const th = Math.round(Number(timelapseHeight));
      request.timelapse = {
        imageUris: timelapseFiles.map((f) => f.filepath),
        fps,
        width: tw > 0 ? tw : undefined,
        height: th > 0 ? th : undefined,
      };
    }

    if (removeAudio && canApplyRemoveAudio) {
      request.removeAudio = true;
    }

    return request;
  }, [
    file,
    operationValue,
    profile,
    trimStartMs,
    trimEndMs,
    splitSegmentRows,
    targetPreset,
    targetBitrateKbps,
    crf,
    coverTimeMs,
    removeAudio,
    canApplyRemoveAudio,
    mergeFiles,
    mergeInputUris,
    extractAudioCodec,
    extractAudioBitrate,
    rotationDeg,
    speedFactor,
    watermarkText,
    watermarkPosition,
    watermarkFontSize,
    watermarkFontColor,
    watermarkOpacity,
    gifStartMs,
    gifDurationMs,
    gifWidth,
    gifFps,
    customWidth,
    customHeight,
    timelapseFiles,
    timelapseFps,
    timelapseWidth,
    timelapseHeight,
    t,
  ]);

  const state: VideoProcessingFormState = {
    operationValue,
    profile,
    targetPreset,
    trimStartMs,
    trimEndMs,
    splitSegmentRows,
    targetBitrateKbps,
    crf,
    coverTimeMs,
    removeAudio,
    mergeInputUris,
    mergeFiles,
    showMergePicker,
    rotationDeg,
    speedFactor,
    watermarkText,
    watermarkPosition,
    watermarkFontSize,
    watermarkFontColor,
    watermarkOpacity,
    gifStartMs,
    gifDurationMs,
    gifWidth,
    gifFps,
    customWidth,
    customHeight,
    timelapseFiles,
    timelapseFps,
    timelapseWidth,
    timelapseHeight,
    showTimelapsePicker,
    extractAudioCodec,
    extractAudioBitrate,
    submitError,
    canSubmit,
    canApplyRemoveAudio,
  };

  const setters: VideoProcessingFormSetters = {
    setOperationValue,
    setProfile,
    setTargetPreset,
    setTrimStartMs,
    setTrimEndMs,
    setSplitSegmentRows,
    setTargetBitrateKbps,
    setCrf,
    setCoverTimeMs,
    setRemoveAudio,
    setMergeInputUris,
    setMergeFiles,
    setShowMergePicker,
    setRotationDeg,
    setSpeedFactor,
    setWatermarkText,
    setWatermarkPosition,
    setWatermarkFontSize,
    setWatermarkFontColor,
    setWatermarkOpacity,
    setGifStartMs,
    setGifDurationMs,
    setGifWidth,
    setGifFps,
    setCustomWidth,
    setCustomHeight,
    setTimelapseFiles,
    setTimelapseFps,
    setTimelapseWidth,
    setTimelapseHeight,
    setShowTimelapsePicker,
    setExtractAudioCodec,
    setExtractAudioBitrate,
  };

  return { state, setters, buildRequest };
}
