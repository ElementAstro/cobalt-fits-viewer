import { useCallback, useMemo } from "react";
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
import { useFitsStore } from "../../stores/files/useFitsStore";
import { FilePickerSheet } from "../astrometry/FilePickerSheet";
import { useVideoProcessingForm } from "../../hooks/video/useVideoProcessingForm";
import {
  formatVideoDuration,
  formatVideoResolution,
  estimateOutputSizeBytes,
} from "../../lib/video/format";
import { formatFileSize } from "../../lib/utils/fileManager";

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

export function VideoProcessingSheet({
  visible,
  file,
  defaultProfile,
  defaultPreset,
  onClose,
  onSubmit,
}: VideoProcessingSheetProps) {
  const { t } = useI18n();
  const { state, setters, buildRequest } = useVideoProcessingForm(
    file,
    defaultProfile,
    defaultPreset,
    t,
  );

  const {
    operationValue: operation,
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
  } = state;

  const {
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
  } = setters;

  const mergeFileFilter = useCallback(
    (f: FitsMetadata) => f.sourceType === "video" || f.mediaKind === "video",
    [],
  );
  const timelapseFileFilter = useCallback(
    (f: FitsMetadata) => f.sourceType === "raster" || f.sourceType === "fits",
    [],
  );

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
      { value: "timelapse", label: t("settings.videoOpTimelapse") },
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

  const operationOption =
    OPERATION_OPTIONS.find((o) => o.value === operation) ?? OPERATION_OPTIONS[0];
  const targetPresetOption =
    TARGET_PRESET_OPTIONS.find((o) => o.value === targetPreset) ?? TARGET_PRESET_OPTIONS[0];

  const handleSubmit = () => {
    const request = buildRequest();
    if (!request) return;
    onSubmit(request);
    onClose();
  };

  return (
    <>
      <Dialog isOpen={visible} onOpenChange={(open) => !open && onClose()}>
        <Dialog.Portal>
          <Dialog.Overlay />
          <Dialog.Content className="max-w-[420px]">
            <Dialog.Title>{t("settings.videoProcessingTitle")}</Dialog.Title>
            <Dialog.Description>{t("settings.videoProcessingDescription")}</Dialog.Description>

            {file && (file.videoWidth || file.bitrateKbps || file.durationMs) && (
              <View className="mt-2 flex-row flex-wrap items-center gap-1">
                {!!file.videoWidth && !!file.videoHeight && (
                  <Text className="text-[10px] text-muted">
                    {formatVideoResolution(file.videoWidth, file.videoHeight)}
                  </Text>
                )}
                {!!file.bitrateKbps && (
                  <Text className="text-[10px] text-muted">· {file.bitrateKbps}kbps</Text>
                )}
                {!!file.durationMs && (
                  <Text className="text-[10px] text-muted">
                    · {formatVideoDuration(file.durationMs)}
                  </Text>
                )}
              </View>
            )}

            <View className="mt-3 gap-3">
              <Select
                value={operationOption}
                onValueChange={(option) =>
                  setOperationValue(
                    (
                      OPERATION_OPTIONS.find((item) => item.value === option?.value) ??
                      OPERATION_OPTIONS[0]
                    ).value,
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

              <Text className="text-[10px] text-muted">
                {t(`settings.videoOpDesc_${operation}`)}
              </Text>

              <RadioGroup
                value={profile}
                onValueChange={(value) => setProfile(value as VideoProfile)}
              >
                {[
                  { value: "compatibility", label: t("settings.videoProfileCompatibility") },
                  { value: "balanced", label: t("settings.videoProfileBalanced") },
                  { value: "quality", label: t("settings.videoProfileQuality") },
                ].map((item) => (
                  <RadioGroup.Item key={item.value} value={item.value}>
                    {({ isSelected }) => (
                      <View className="flex-row items-center justify-between rounded-lg border border-separator px-3 py-2">
                        <Text className="text-sm text-foreground">{item.label}</Text>
                        <Text className={`text-xs ${isSelected ? "text-success" : "text-muted"}`}>
                          {isSelected ? t("settings.videoSelected") : ""}
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
                            <View className="gap-2">
                              {splitSegmentRows.map((row, idx) => (
                                <View key={idx} className="flex-row items-center gap-2">
                                  <TextField className="flex-1">
                                    <Input
                                      placeholder={t("settings.videoTrimStartMs")}
                                      keyboardType="numeric"
                                      value={row.start}
                                      onChangeText={(v) =>
                                        setSplitSegmentRows((prev) =>
                                          prev.map((r, i) => (i === idx ? { ...r, start: v } : r)),
                                        )
                                      }
                                    />
                                  </TextField>
                                  <TextField className="flex-1">
                                    <Input
                                      placeholder={t("settings.videoTrimEndMs")}
                                      keyboardType="numeric"
                                      value={row.end}
                                      onChangeText={(v) =>
                                        setSplitSegmentRows((prev) =>
                                          prev.map((r, i) => (i === idx ? { ...r, end: v } : r)),
                                        )
                                      }
                                    />
                                  </TextField>
                                  {splitSegmentRows.length > 1 && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      isIconOnly
                                      onPress={() =>
                                        setSplitSegmentRows((prev) =>
                                          prev.filter((_, i) => i !== idx),
                                        )
                                      }
                                    >
                                      <Button.Label>✕</Button.Label>
                                    </Button>
                                  )}
                                </View>
                              ))}
                              <View className="flex-row gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onPress={() =>
                                    setSplitSegmentRows((prev) => [...prev, { start: "", end: "" }])
                                  }
                                >
                                  <Button.Label>{t("settings.videoSplitAddSegment")}</Button.Label>
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onPress={() => {
                                    const duration = file?.durationMs ?? 10000;
                                    const count = Math.max(2, splitSegmentRows.length);
                                    const segLen = Math.round(duration / count);
                                    setSplitSegmentRows(
                                      Array.from({ length: count }, (_, i) => ({
                                        start: String(i * segLen),
                                        end: String(Math.min((i + 1) * segLen, duration)),
                                      })),
                                    );
                                  }}
                                >
                                  <Button.Label>{t("settings.videoSplitEvenSplit")}</Button.Label>
                                </Button>
                              </View>
                            </View>
                          )}
                        </>
                      )}

                      {(operation === "compress" || operation === "transcode") && (
                        <>
                          <Select
                            value={targetPresetOption}
                            onValueChange={(option) =>
                              setTargetPreset(
                                (
                                  TARGET_PRESET_OPTIONS.find(
                                    (item) => item.value === option?.value,
                                  ) ?? TARGET_PRESET_OPTIONS[0]
                                ).value,
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
                          {targetPresetOption?.value === "custom" && (
                            <View className="flex-row gap-2">
                              <TextField className="flex-1">
                                <Input
                                  placeholder={t("settings.videoCustomWidth")}
                                  keyboardType="numeric"
                                  value={customWidth}
                                  onChangeText={setCustomWidth}
                                />
                              </TextField>
                              <TextField className="flex-1">
                                <Input
                                  placeholder={t("settings.videoCustomHeight")}
                                  keyboardType="numeric"
                                  value={customHeight}
                                  onChangeText={setCustomHeight}
                                />
                              </TextField>
                            </View>
                          )}
                          {operation === "compress" && (
                            <>
                              <TextField>
                                <Input
                                  placeholder={t("settings.videoCrf")}
                                  keyboardType="numeric"
                                  value={crf}
                                  onChangeText={setCrf}
                                />
                              </TextField>
                              <Text className="text-[9px] text-muted">
                                {t("settings.videoCrfHint")}
                              </Text>
                            </>
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
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onPress={() => setShowMergePicker(true)}
                          >
                            <Button.Label>
                              {t("settings.videoMergeSelectFiles")}
                              {mergeFiles.length > 0 && ` (${mergeFiles.length})`}
                            </Button.Label>
                          </Button>
                          {mergeFiles.length > 0 && (
                            <View className="gap-1">
                              {mergeFiles.map((f, i) => (
                                <View
                                  key={f.id}
                                  className="flex-row items-center justify-between rounded-lg border border-separator px-2 py-1"
                                >
                                  <Text
                                    className="flex-1 text-xs text-foreground"
                                    numberOfLines={1}
                                  >
                                    {i + 1}. {f.filename}
                                  </Text>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    isIconOnly
                                    onPress={() =>
                                      setMergeFiles((prev) =>
                                        prev.filter((item) => item.id !== f.id),
                                      )
                                    }
                                  >
                                    <Button.Label>✕</Button.Label>
                                  </Button>
                                </View>
                              ))}
                            </View>
                          )}
                          <Accordion>
                            <Accordion.Item value="manual-uris">
                              <Accordion.Trigger>
                                <Text className="flex-1 text-[10px] text-muted">
                                  {t("settings.videoMergeInputUris")}
                                </Text>
                                <Accordion.Indicator />
                              </Accordion.Trigger>
                              <Accordion.Content>
                                <TextField>
                                  <Input
                                    placeholder={t("settings.videoMergeInputUris")}
                                    value={mergeInputUris}
                                    onChangeText={setMergeInputUris}
                                    multiline
                                    numberOfLines={4}
                                  />
                                </TextField>
                              </Accordion.Content>
                            </Accordion.Item>
                          </Accordion>
                        </>
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
                                      {isSelected ? t("settings.videoSelected") : ""}
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
                                    {isSelected ? t("settings.videoSelected") : ""}
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
                                  <Select.Item
                                    key={item.value}
                                    value={item.value}
                                    label={item.label}
                                  >
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

                      {operation === "timelapse" && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onPress={() => setShowTimelapsePicker(true)}
                          >
                            <Button.Label>
                              {t("settings.videoTimelapseSelectImages")}
                              {timelapseFiles.length > 0 && ` (${timelapseFiles.length})`}
                            </Button.Label>
                          </Button>
                          {timelapseFiles.length > 0 && (
                            <Text className="text-[10px] text-muted">
                              {timelapseFiles.length} {t("settings.videoTimelapseImageCount")}
                            </Text>
                          )}
                          <TextField>
                            <Input
                              placeholder={t("settings.videoTimelapseFps")}
                              keyboardType="numeric"
                              value={timelapseFps}
                              onChangeText={setTimelapseFps}
                            />
                          </TextField>
                          <View className="flex-row gap-2">
                            <TextField className="flex-1">
                              <Input
                                placeholder={t("settings.videoCustomWidth")}
                                keyboardType="numeric"
                                value={timelapseWidth}
                                onChangeText={setTimelapseWidth}
                              />
                            </TextField>
                            <TextField className="flex-1">
                              <Input
                                placeholder={t("settings.videoCustomHeight")}
                                keyboardType="numeric"
                                value={timelapseHeight}
                                onChangeText={setTimelapseHeight}
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

            <View className="mt-4 flex-row flex-wrap items-center justify-end gap-2">
              {!!submitError && <Text className="mr-auto text-xs text-danger">{submitError}</Text>}
              {!submitError &&
                (() => {
                  const durationMs =
                    operation === "trim"
                      ? Math.max(0, Number(trimEndMs) - Number(trimStartMs))
                      : file?.durationMs;
                  const est = estimateOutputSizeBytes(durationMs, Number(targetBitrateKbps));
                  return est ? (
                    <Text className="mr-auto text-[10px] text-muted">~{formatFileSize(est)}</Text>
                  ) : null;
                })()}
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
      <FilteredFilePickerDialog
        visible={showMergePicker}
        onClose={() => setShowMergePicker(false)}
        onSelectBatch={(files) => {
          setMergeFiles(files);
          setShowMergePicker(false);
        }}
        filter={mergeFileFilter}
      />
      <FilteredFilePickerDialog
        visible={showTimelapsePicker}
        onClose={() => setShowTimelapsePicker(false)}
        onSelectBatch={(files) => {
          setTimelapseFiles(files);
          setShowTimelapsePicker(false);
        }}
        filter={timelapseFileFilter}
      />
    </>
  );
}

function FilteredFilePickerDialog({
  visible,
  onClose,
  onSelectBatch,
  filter,
}: {
  visible: boolean;
  onClose: () => void;
  onSelectBatch: (files: FitsMetadata[]) => void;
  filter: (f: FitsMetadata) => boolean;
}) {
  const allFiles = useFitsStore((s) => s.files);
  const filtered = useMemo(() => allFiles.filter(filter), [allFiles, filter]);

  return (
    <FilePickerSheet
      visible={visible}
      files={filtered}
      onSelect={() => {}}
      onSelectBatch={onSelectBatch}
      onClose={onClose}
    />
  );
}
