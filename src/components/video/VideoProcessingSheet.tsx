import { useEffect, useMemo, useState } from "react";
import { Text, View } from "react-native";
import {
  Accordion,
  Button,
  Dialog,
  Input,
  RadioGroup,
  Select,
  Switch,
  TextField,
} from "heroui-native";
import type { FitsMetadata } from "../../lib/fits/types";
import type {
  VideoProcessingRequest,
  VideoProcessingTag,
  VideoProfile,
  WatermarkPosition,
} from "../../lib/video/engine";
import { useI18n } from "../../i18n/useI18n";

type OperationOption = { value: VideoProcessingTag; label: string };
type PresetOption = { value: "1080p" | "720p" | "custom"; label: string };

const WATERMARK_POSITION_KEYS: Array<{ value: WatermarkPosition; fallback: string }> = [
  { value: "top-left", fallback: "Top Left" },
  { value: "top-right", fallback: "Top Right" },
  { value: "bottom-left", fallback: "Bottom Left" },
  { value: "bottom-right", fallback: "Bottom Right" },
  { value: "center", fallback: "Center" },
];

const TARGET_PRESET_OPTIONS: PresetOption[] = [
  { value: "1080p", label: "1080p" },
  { value: "720p", label: "720p" },
  { value: "custom", label: "Custom" },
];

interface VideoProcessingSheetProps {
  visible: boolean;
  file: FitsMetadata | null;
  defaultProfile: VideoProfile;
  defaultPreset: "1080p" | "720p" | "custom";
  onClose: () => void;
  onSubmit: (request: VideoProcessingRequest) => void;
}

function parseSplitSegments(input: string): Array<{ startMs: number; endMs: number }> {
  return input
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token) => {
      const [startRaw, endRaw] = token.split("-");
      const startMs = Math.round(Number(startRaw));
      const endMs = Math.round(Number(endRaw));
      return { startMs, endMs };
    })
    .filter(
      (segment) =>
        Number.isFinite(segment.startMs) &&
        Number.isFinite(segment.endMs) &&
        segment.startMs >= 0 &&
        segment.endMs > segment.startMs,
    );
}

export function VideoProcessingSheet({
  visible,
  file,
  defaultProfile,
  defaultPreset,
  onClose,
  onSubmit,
}: VideoProcessingSheetProps) {
  const { t } = useI18n();

  const OPERATION_OPTIONS: OperationOption[] = useMemo(
    () => [
      { value: "trim", label: t("settings.videoOpTrim") },
      { value: "split", label: t("settings.videoOpSplit") },
      { value: "compress", label: t("settings.videoOpCompress") },
      { value: "transcode", label: t("settings.videoOpTranscode") },
      { value: "merge", label: t("settings.videoOpMerge") },
      { value: "mute", label: t("settings.videoOpMuteAudio") },
      { value: "extract-audio", label: t("settings.videoOpExtractAudio") },
      { value: "cover", label: t("settings.videoOpCoverFrame") },
      { value: "rotate", label: t("settings.videoOpRotate") },
      { value: "speed", label: t("settings.videoOpSpeed") },
      { value: "watermark", label: t("settings.videoOpWatermark") },
      { value: "gif", label: t("settings.videoOpGif") },
    ],
    [t],
  );

  const ROTATION_OPTIONS = useMemo(
    () => [
      { value: "90", label: t("settings.videoRotation90") },
      { value: "180", label: t("settings.videoRotation180") },
      { value: "270", label: t("settings.videoRotation270") },
    ],
    [t],
  );

  const WATERMARK_POSITION_OPTIONS = useMemo(
    () =>
      WATERMARK_POSITION_KEYS.map((item) => ({
        value: item.value,
        label: item.fallback,
      })),
    [],
  );

  const [operationOption, setOperationOption] = useState<OperationOption | undefined>(
    OPERATION_OPTIONS[0],
  );
  const [profile, setProfile] = useState<VideoProfile>(defaultProfile);
  const [targetPresetOption, setTargetPresetOption] = useState<PresetOption | undefined>(
    TARGET_PRESET_OPTIONS.find((item) => item.value === defaultPreset) ?? TARGET_PRESET_OPTIONS[0],
  );
  const [trimStartMs, setTrimStartMs] = useState("0");
  const [trimEndMs, setTrimEndMs] = useState("10000");
  const [splitSegments, setSplitSegments] = useState("0-5000,5000-10000");
  const [targetBitrateKbps, setTargetBitrateKbps] = useState("4000");
  const [crf, setCrf] = useState("23");
  const [coverTimeMs, setCoverTimeMs] = useState("1000");
  const [removeAudio, setRemoveAudio] = useState(false);
  const [mergeInputUris, setMergeInputUris] = useState("");
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
  const [extractAudioCodec, setExtractAudioCodec] = useState<"aac" | "mp3">("aac");
  const [extractAudioBitrate, setExtractAudioBitrate] = useState("192");
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!file) return;
    const duration = Math.max(1000, file.durationMs ?? 10000);
    setTrimEndMs(String(duration));
    setSplitSegments(`0-${Math.round(duration / 2)},${Math.round(duration / 2)}-${duration}`);
    setCoverTimeMs(String(Math.min(1000, duration)));
  }, [file]);

  useEffect(() => {
    if (
      operationOption?.value &&
      !["trim", "split", "compress", "transcode"].includes(operationOption.value)
    ) {
      setRemoveAudio(false);
    }
    setSubmitError(null);
  }, [operationOption?.value]);

  const canSubmit = useMemo(() => Boolean(file), [file]);
  const operation: VideoProcessingTag = operationOption?.value ?? "trim";
  const targetPreset: "1080p" | "720p" | "custom" = targetPresetOption?.value ?? "1080p";
  const canApplyRemoveAudio =
    operation === "trim" ||
    operation === "split" ||
    operation === "compress" ||
    operation === "transcode" ||
    operation === "rotate" ||
    operation === "speed" ||
    operation === "watermark";

  const handleSubmit = () => {
    if (!file) return;
    setSubmitError(null);
    const request: VideoProcessingRequest = {
      sourceId: file.id,
      sourceFilename: file.filename,
      inputUri: file.filepath,
      operation,
      profile,
      sourceDurationMs: file.durationMs,
    };

    if (operation === "trim") {
      const start = Math.round(Number(trimStartMs));
      const end = Math.round(Number(trimEndMs));
      if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start) {
        setSubmitError(t("settings.videoErrorTrimRange"));
        return;
      }
      request.trim = {
        startMs: start,
        endMs: end,
        reencode: true,
      };
    } else if (operation === "split") {
      const segments = parseSplitSegments(splitSegments);
      if (segments.length === 0) {
        setSubmitError(t("settings.videoErrorSplitSegments"));
        return;
      }
      request.split = {
        segments,
      };
    } else if (operation === "compress") {
      request.compress = {
        targetPreset,
        targetBitrateKbps: Math.max(300, Math.round(Number(targetBitrateKbps) || 300)),
        crf: Math.max(0, Math.min(51, Math.round(Number(crf) || 23))),
      };
    } else if (operation === "transcode") {
      request.transcode = {
        videoCodec: profile === "quality" ? "hevc" : "h264",
        audioCodec: "aac",
        targetPreset,
        targetBitrateKbps: Math.max(300, Math.round(Number(targetBitrateKbps) || 300)),
      };
    } else if (operation === "merge") {
      const merged = mergeInputUris
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      if (merged.length < 2) {
        setSubmitError(t("settings.videoErrorMergeInputs"));
        return;
      }
      request.merge = {
        inputUris: merged,
      };
    } else if (operation === "mute") {
      request.operation = "mute";
    } else if (operation === "extract-audio") {
      request.extractAudio = {
        audioCodec: extractAudioCodec,
        bitrateKbps: Math.max(32, Math.round(Number(extractAudioBitrate) || 192)),
      };
    } else if (operation === "rotate") {
      const deg = Number(rotationDeg);
      if (deg !== 90 && deg !== 180 && deg !== 270) {
        setSubmitError(t("settings.videoErrorRotation"));
        return;
      }
      request.rotateNormalize = { rotationDeg: deg as 90 | 180 | 270 };
    } else if (operation === "speed") {
      const factor = Number(speedFactor);
      if (!Number.isFinite(factor) || factor < 0.25 || factor > 4) {
        setSubmitError(t("settings.videoErrorSpeedFactor"));
        return;
      }
      request.speed = { factor };
    } else if (operation === "watermark") {
      if (!watermarkText.trim()) {
        setSubmitError(t("settings.videoErrorWatermarkText"));
        return;
      }
      request.watermark = {
        text: watermarkText.trim(),
        position: watermarkPosition,
        fontSize: Math.max(8, Math.min(120, Math.round(Number(watermarkFontSize) || 24))),
        fontColor: watermarkFontColor || "white",
        opacity: Math.max(0, Math.min(1, Number(watermarkOpacity) || 1)),
      };
    } else if (operation === "gif") {
      const startMs = Math.round(Number(gifStartMs));
      const durationMs = Math.round(Number(gifDurationMs));
      if (!Number.isFinite(startMs) || startMs < 0) {
        setSubmitError(t("settings.videoErrorGifStart"));
        return;
      }
      if (!Number.isFinite(durationMs) || durationMs < 100) {
        setSubmitError(t("settings.videoErrorGifDuration"));
        return;
      }
      request.gif = {
        startMs,
        durationMs,
        width: Math.max(60, Math.round(Number(gifWidth) || 480)),
        fps: Math.max(1, Math.min(30, Math.round(Number(gifFps) || 10))),
      };
    } else if (operation === "cover") {
      const coverAtMs = Math.round(Number(coverTimeMs));
      if (!Number.isFinite(coverAtMs) || coverAtMs < 0) {
        setSubmitError(t("settings.videoErrorCoverTime"));
        return;
      }
      request.cover = {
        timeMs: coverAtMs,
      };
    }
    if (removeAudio && canApplyRemoveAudio) {
      request.removeAudio = true;
    }

    onSubmit(request);
    onClose();
  };

  return (
    <Dialog isOpen={visible} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content className="max-w-[420px]">
          <Dialog.Title>{t("settings.videoProcessingTitle")}</Dialog.Title>
          <Dialog.Description>{t("settings.videoProcessingDescription")}</Dialog.Description>

          <View className="mt-3 gap-3">
            <Select
              value={operationOption}
              onValueChange={(option) =>
                setOperationOption(
                  OPERATION_OPTIONS.find((item) => item.value === option?.value) ??
                    OPERATION_OPTIONS[0],
                )
              }
            >
              <Select.Trigger>
                <Select.Value placeholder={t("settings.videoChooseOperation")} />
                <Select.TriggerIndicator />
              </Select.Trigger>
              <Select.Portal>
                <Select.Overlay />
                <Select.Content presentation="popover">
                  {OPERATION_OPTIONS.map((item) => (
                    <Select.Item key={item.value} value={item.value} label={item.label}>
                      <Select.ItemLabel />
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Portal>
            </Select>

            <RadioGroup
              value={profile}
              onValueChange={(value) => setProfile(value as VideoProfile)}
            >
              {[
                { value: "compatibility", label: "Compatibility" },
                { value: "balanced", label: "Balanced" },
                { value: "quality", label: "Quality" },
              ].map((item) => (
                <RadioGroup.Item key={item.value} value={item.value}>
                  {({ isSelected }) => (
                    <View className="flex-row items-center justify-between rounded-lg border border-separator px-3 py-2">
                      <Text className="text-sm text-foreground">{item.label}</Text>
                      <Text className={`text-xs ${isSelected ? "text-success" : "text-muted"}`}>
                        {isSelected ? "Selected" : ""}
                      </Text>
                    </View>
                  )}
                </RadioGroup.Item>
              ))}
            </RadioGroup>

            <Switch
              testID="remove-audio-switch"
              isSelected={removeAudio}
              onSelectedChange={setRemoveAudio}
              isDisabled={!canApplyRemoveAudio}
            >
              <Switch.Thumb />
              <Text className="text-sm text-foreground">
                {t("settings.videoRemoveAudioInOutput")}
              </Text>
            </Switch>

            <Accordion selectionMode="multiple" variant="surface" defaultValue={["params"]}>
              <Accordion.Item value="params">
                <Accordion.Trigger>
                  <Text className="flex-1 text-sm font-semibold text-foreground">
                    {t("settings.videoParameters")}
                  </Text>
                  <Accordion.Indicator />
                </Accordion.Trigger>
                <Accordion.Content>
                  <View className="gap-2 pb-2">
                    {(operation === "trim" || operation === "split") && (
                      <>
                        {operation === "trim" ? (
                          <View className="flex-row gap-2">
                            <TextField className="flex-1">
                              <Input
                                placeholder={t("settings.videoTrimStartMs")}
                                keyboardType="numeric"
                                value={trimStartMs}
                                onChangeText={setTrimStartMs}
                              />
                            </TextField>
                            <TextField className="flex-1">
                              <Input
                                placeholder={t("settings.videoTrimEndMs")}
                                keyboardType="numeric"
                                value={trimEndMs}
                                onChangeText={setTrimEndMs}
                              />
                            </TextField>
                          </View>
                        ) : (
                          <TextField>
                            <Input
                              placeholder="0-5000,5000-10000"
                              value={splitSegments}
                              onChangeText={setSplitSegments}
                            />
                          </TextField>
                        )}
                      </>
                    )}

                    {(operation === "compress" || operation === "transcode") && (
                      <>
                        <Select
                          value={targetPresetOption}
                          onValueChange={(option) =>
                            setTargetPresetOption(
                              TARGET_PRESET_OPTIONS.find((item) => item.value === option?.value) ??
                                TARGET_PRESET_OPTIONS[0],
                            )
                          }
                        >
                          <Select.Trigger>
                            <Select.Value placeholder={t("settings.videoTargetPreset")} />
                            <Select.TriggerIndicator />
                          </Select.Trigger>
                          <Select.Portal>
                            <Select.Overlay />
                            <Select.Content presentation="popover">
                              <Select.Item value="1080p" label="1080p">
                                <Select.ItemLabel />
                              </Select.Item>
                              <Select.Item value="720p" label="720p">
                                <Select.ItemLabel />
                              </Select.Item>
                              <Select.Item value="custom" label="Custom">
                                <Select.ItemLabel />
                              </Select.Item>
                            </Select.Content>
                          </Select.Portal>
                        </Select>
                        <TextField>
                          <Input
                            placeholder={t("settings.videoTargetBitrateKbps")}
                            keyboardType="numeric"
                            value={targetBitrateKbps}
                            onChangeText={setTargetBitrateKbps}
                          />
                        </TextField>
                        {operation === "compress" && (
                          <TextField>
                            <Input
                              placeholder={t("settings.videoCrf")}
                              keyboardType="numeric"
                              value={crf}
                              onChangeText={setCrf}
                            />
                          </TextField>
                        )}
                      </>
                    )}

                    {operation === "cover" && (
                      <TextField>
                        <Input
                          placeholder={t("settings.videoCoverTimeMs")}
                          keyboardType="numeric"
                          value={coverTimeMs}
                          onChangeText={setCoverTimeMs}
                        />
                      </TextField>
                    )}

                    {operation === "merge" && (
                      <TextField>
                        <Input
                          placeholder={t("settings.videoMergeInputUris")}
                          value={mergeInputUris}
                          onChangeText={setMergeInputUris}
                          multiline
                          numberOfLines={4}
                        />
                      </TextField>
                    )}

                    {operation === "extract-audio" && (
                      <>
                        <RadioGroup
                          value={extractAudioCodec}
                          onValueChange={(v) => setExtractAudioCodec(v as "aac" | "mp3")}
                        >
                          {[
                            { value: "aac", label: "AAC" },
                            { value: "mp3", label: "MP3" },
                          ].map((item) => (
                            <RadioGroup.Item key={item.value} value={item.value}>
                              {({ isSelected }) => (
                                <View className="flex-row items-center justify-between rounded-lg border border-separator px-3 py-1.5">
                                  <Text className="text-sm text-foreground">{item.label}</Text>
                                  <Text
                                    className={`text-xs ${isSelected ? "text-success" : "text-muted"}`}
                                  >
                                    {isSelected ? "Selected" : ""}
                                  </Text>
                                </View>
                              )}
                            </RadioGroup.Item>
                          ))}
                        </RadioGroup>
                        <TextField>
                          <Input
                            placeholder={t("settings.videoExtractAudioBitrate")}
                            keyboardType="numeric"
                            value={extractAudioBitrate}
                            onChangeText={setExtractAudioBitrate}
                          />
                        </TextField>
                      </>
                    )}

                    {operation === "rotate" && (
                      <RadioGroup value={rotationDeg} onValueChange={setRotationDeg}>
                        {ROTATION_OPTIONS.map((item) => (
                          <RadioGroup.Item key={item.value} value={item.value}>
                            {({ isSelected }) => (
                              <View className="flex-row items-center justify-between rounded-lg border border-separator px-3 py-1.5">
                                <Text className="text-sm text-foreground">{item.label}</Text>
                                <Text
                                  className={`text-xs ${isSelected ? "text-success" : "text-muted"}`}
                                >
                                  {isSelected ? "Selected" : ""}
                                </Text>
                              </View>
                            )}
                          </RadioGroup.Item>
                        ))}
                      </RadioGroup>
                    )}

                    {operation === "speed" && (
                      <TextField>
                        <Input
                          placeholder={t("settings.videoSpeedFactor")}
                          keyboardType="decimal-pad"
                          value={speedFactor}
                          onChangeText={setSpeedFactor}
                        />
                      </TextField>
                    )}

                    {operation === "watermark" && (
                      <>
                        <TextField>
                          <Input
                            placeholder={t("settings.videoWatermarkText")}
                            value={watermarkText}
                            onChangeText={setWatermarkText}
                          />
                        </TextField>
                        <Select
                          value={WATERMARK_POSITION_OPTIONS.find(
                            (o) => o.value === watermarkPosition,
                          )}
                          onValueChange={(option) =>
                            setWatermarkPosition(
                              (option?.value as WatermarkPosition) ?? "bottom-right",
                            )
                          }
                        >
                          <Select.Trigger>
                            <Select.Value placeholder={t("settings.videoWatermarkPosition")} />
                            <Select.TriggerIndicator />
                          </Select.Trigger>
                          <Select.Portal>
                            <Select.Overlay />
                            <Select.Content presentation="popover">
                              {WATERMARK_POSITION_OPTIONS.map((item) => (
                                <Select.Item key={item.value} value={item.value} label={item.label}>
                                  <Select.ItemLabel />
                                </Select.Item>
                              ))}
                            </Select.Content>
                          </Select.Portal>
                        </Select>
                        <View className="flex-row gap-2">
                          <TextField className="flex-1">
                            <Input
                              placeholder={t("settings.videoWatermarkFontSize")}
                              keyboardType="numeric"
                              value={watermarkFontSize}
                              onChangeText={setWatermarkFontSize}
                            />
                          </TextField>
                          <TextField className="flex-1">
                            <Input
                              placeholder={t("settings.videoWatermarkFontColor")}
                              value={watermarkFontColor}
                              onChangeText={setWatermarkFontColor}
                            />
                          </TextField>
                        </View>
                        <TextField>
                          <Input
                            placeholder={t("settings.videoWatermarkOpacity")}
                            keyboardType="decimal-pad"
                            value={watermarkOpacity}
                            onChangeText={setWatermarkOpacity}
                          />
                        </TextField>
                      </>
                    )}

                    {operation === "gif" && (
                      <>
                        <View className="flex-row gap-2">
                          <TextField className="flex-1">
                            <Input
                              placeholder={t("settings.videoGifStart")}
                              keyboardType="numeric"
                              value={gifStartMs}
                              onChangeText={setGifStartMs}
                            />
                          </TextField>
                          <TextField className="flex-1">
                            <Input
                              placeholder={t("settings.videoGifDuration")}
                              keyboardType="numeric"
                              value={gifDurationMs}
                              onChangeText={setGifDurationMs}
                            />
                          </TextField>
                        </View>
                        <View className="flex-row gap-2">
                          <TextField className="flex-1">
                            <Input
                              placeholder={t("settings.videoGifWidth")}
                              keyboardType="numeric"
                              value={gifWidth}
                              onChangeText={setGifWidth}
                            />
                          </TextField>
                          <TextField className="flex-1">
                            <Input
                              placeholder={t("settings.videoGifFps")}
                              keyboardType="numeric"
                              value={gifFps}
                              onChangeText={setGifFps}
                            />
                          </TextField>
                        </View>
                      </>
                    )}
                  </View>
                </Accordion.Content>
              </Accordion.Item>
            </Accordion>
          </View>

          <View className="mt-4 flex-row justify-end gap-2">
            {!!submitError && <Text className="mr-auto text-xs text-danger">{submitError}</Text>}
            <Button variant="outline" onPress={onClose}>
              <Button.Label>{t("settings.videoCancel")}</Button.Label>
            </Button>
            <Button variant="primary" isDisabled={!canSubmit} onPress={handleSubmit}>
              <Button.Label>{t("settings.videoQueueTask")}</Button.Label>
            </Button>
          </View>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}
