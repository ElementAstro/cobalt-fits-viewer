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
} from "../../lib/video/engine";

type OperationOption = { value: VideoProcessingTag; label: string };
type PresetOption = { value: "1080p" | "720p" | "custom"; label: string };

const OPERATION_OPTIONS: OperationOption[] = [
  { value: "trim", label: "Trim" },
  { value: "split", label: "Split" },
  { value: "compress", label: "Compress" },
  { value: "transcode", label: "Transcode" },
  { value: "merge", label: "Merge" },
  { value: "mute", label: "Mute Audio" },
  { value: "extract-audio", label: "Extract Audio" },
  { value: "cover", label: "Cover Frame" },
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
    operation === "transcode";

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
        setSubmitError("Trim range is invalid.");
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
        setSubmitError("Split segments are invalid.");
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
        setSubmitError("Merge requires at least two input URIs.");
        return;
      }
      request.merge = {
        inputUris: merged,
      };
    } else if (operation === "mute") {
      request.operation = "mute";
    } else if (operation === "extract-audio") {
      request.extractAudio = {
        audioCodec: "aac",
        bitrateKbps: 192,
      };
    } else if (operation === "cover") {
      const coverAtMs = Math.round(Number(coverTimeMs));
      if (!Number.isFinite(coverAtMs) || coverAtMs < 0) {
        setSubmitError("Cover frame time is invalid.");
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
          <Dialog.Title>Video Processing</Dialog.Title>
          <Dialog.Description>Create a non-destructive derived media file.</Dialog.Description>

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
                <Select.Value placeholder="Choose operation" />
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
              <Text className="text-sm text-foreground">Remove audio in output</Text>
            </Switch>

            <Accordion selectionMode="multiple" variant="surface" defaultValue={["params"]}>
              <Accordion.Item value="params">
                <Accordion.Trigger>
                  <Text className="flex-1 text-sm font-semibold text-foreground">Parameters</Text>
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
                                placeholder="Start ms"
                                keyboardType="numeric"
                                value={trimStartMs}
                                onChangeText={setTrimStartMs}
                              />
                            </TextField>
                            <TextField className="flex-1">
                              <Input
                                placeholder="End ms"
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
                            <Select.Value placeholder="Target preset" />
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
                            placeholder="Target bitrate kbps"
                            keyboardType="numeric"
                            value={targetBitrateKbps}
                            onChangeText={setTargetBitrateKbps}
                          />
                        </TextField>
                        {operation === "compress" && (
                          <TextField>
                            <Input
                              placeholder="CRF (0-51)"
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
                          placeholder="Thumbnail time ms"
                          keyboardType="numeric"
                          value={coverTimeMs}
                          onChangeText={setCoverTimeMs}
                        />
                      </TextField>
                    )}

                    {operation === "merge" && (
                      <TextField>
                        <Input
                          placeholder={"Input URIs (one per line)\nfile:///path/a.mp4"}
                          value={mergeInputUris}
                          onChangeText={setMergeInputUris}
                          multiline
                          numberOfLines={4}
                        />
                      </TextField>
                    )}
                  </View>
                </Accordion.Content>
              </Accordion.Item>
            </Accordion>
          </View>

          <View className="mt-4 flex-row justify-end gap-2">
            {!!submitError && <Text className="mr-auto text-xs text-danger">{submitError}</Text>}
            <Button variant="outline" onPress={onClose}>
              <Button.Label>Cancel</Button.Label>
            </Button>
            <Button variant="primary" isDisabled={!canSubmit} onPress={handleSubmit}>
              <Button.Label>Queue Task</Button.Label>
            </Button>
          </View>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}
