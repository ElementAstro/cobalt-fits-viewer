import { View } from "react-native";
import { Separator } from "heroui-native";
import { SettingsToggleRow } from "../../../components/common/SettingsToggleRow";
import { useI18n } from "../../../i18n/useI18n";
import { useHapticFeedback } from "../../../hooks/useHapticFeedback";
import { useSettingsStore } from "../../../stores/useSettingsStore";
import { SettingsSection } from "../SettingsSection";
import { SettingsRow } from "../../common/SettingsRow";
import { SimpleSlider } from "../../common/SimpleSlider";
import { OptionPickerModal } from "../../common/OptionPickerModal";
import { useSettingsPicker } from "../../../hooks/useSettingsPicker";

const VIDEO_PROFILE_VALUES = ["compatibility", "balanced", "quality"] as const;
const VIDEO_TARGET_PRESET_VALUES = ["1080p", "720p", "custom"] as const;

export function ProcessingVideoSection() {
  const { t } = useI18n();
  const haptics = useHapticFeedback();
  const { activePicker, openPicker, closePicker } = useSettingsPicker();

  const videoCoreEnabled = useSettingsStore((s) => s.videoCoreEnabled);
  const videoProcessingEnabled = useSettingsStore((s) => s.videoProcessingEnabled);
  const videoAutoplay = useSettingsStore((s) => s.videoAutoplay);
  const videoLoopByDefault = useSettingsStore((s) => s.videoLoopByDefault);
  const videoMutedByDefault = useSettingsStore((s) => s.videoMutedByDefault);
  const videoThumbnailTimeMs = useSettingsStore((s) => s.videoThumbnailTimeMs);
  const videoProcessingConcurrency = useSettingsStore((s) => s.videoProcessingConcurrency);
  const defaultVideoProfile = useSettingsStore((s) => s.defaultVideoProfile);
  const defaultVideoTargetPreset = useSettingsStore((s) => s.defaultVideoTargetPreset);
  const setVideoCoreEnabled = useSettingsStore((s) => s.setVideoCoreEnabled);
  const setVideoProcessingEnabled = useSettingsStore((s) => s.setVideoProcessingEnabled);
  const setVideoAutoplay = useSettingsStore((s) => s.setVideoAutoplay);
  const setVideoLoopByDefault = useSettingsStore((s) => s.setVideoLoopByDefault);
  const setVideoMutedByDefault = useSettingsStore((s) => s.setVideoMutedByDefault);
  const setVideoThumbnailTimeMs = useSettingsStore((s) => s.setVideoThumbnailTimeMs);
  const setVideoProcessingConcurrency = useSettingsStore((s) => s.setVideoProcessingConcurrency);
  const setDefaultVideoProfile = useSettingsStore((s) => s.setDefaultVideoProfile);
  const setDefaultVideoTargetPreset = useSettingsStore((s) => s.setDefaultVideoTargetPreset);
  const resetSection = useSettingsStore((s) => s.resetSection);

  const videoProfileLabel = (value: (typeof VIDEO_PROFILE_VALUES)[number]) =>
    value === "compatibility"
      ? t("settings.videoProfileCompatibility")
      : value === "quality"
        ? t("settings.videoProfileQuality")
        : t("settings.videoProfileBalanced");

  const videoTargetPresetLabel = (value: (typeof VIDEO_TARGET_PRESET_VALUES)[number]) =>
    value === "custom" ? t("settings.videoPresetCustom") : value;

  const videoProfileOptions = VIDEO_PROFILE_VALUES.map((value) => ({
    label: videoProfileLabel(value),
    value,
  }));

  const videoTargetPresetOptions = VIDEO_TARGET_PRESET_VALUES.map((value) => ({
    label: videoTargetPresetLabel(value),
    value,
  }));

  return (
    <>
      <SettingsSection
        title={t("settings.videoMediaTitle")}
        collapsible
        defaultCollapsed
        onReset={() => {
          haptics.selection();
          resetSection("video");
        }}
      >
        <SettingsToggleRow
          testID="e2e-action-settings__processing-toggle-video-core"
          icon="videocam-outline"
          label={t("settings.videoCoreEnabled")}
          isSelected={videoCoreEnabled}
          onSelectedChange={setVideoCoreEnabled}
        />
        <Separator />
        <SettingsToggleRow
          testID="e2e-action-settings__processing-toggle-video-processing"
          icon="build-outline"
          label={t("settings.videoProcessingEnabled")}
          isSelected={videoProcessingEnabled}
          onSelectedChange={setVideoProcessingEnabled}
        />
        <Separator />
        <SettingsToggleRow
          testID="e2e-action-settings__processing-toggle-video-autoplay"
          icon="play-circle-outline"
          label={t("settings.videoAutoplay")}
          isSelected={videoAutoplay}
          onSelectedChange={setVideoAutoplay}
        />
        <Separator />
        <SettingsToggleRow
          testID="e2e-action-settings__processing-toggle-video-loop"
          icon="repeat-outline"
          label={t("settings.videoLoopByDefault")}
          isSelected={videoLoopByDefault}
          onSelectedChange={setVideoLoopByDefault}
        />
        <Separator />
        <SettingsToggleRow
          testID="e2e-action-settings__processing-toggle-video-muted"
          icon="volume-mute-outline"
          label={t("settings.videoMutedByDefault")}
          isSelected={videoMutedByDefault}
          onSelectedChange={setVideoMutedByDefault}
        />
        <Separator />
        <SettingsRow
          testID="e2e-action-settings__processing-open-video-profile"
          icon="layers-outline"
          label={t("settings.defaultVideoProfile")}
          value={videoProfileLabel(defaultVideoProfile)}
          onPress={() => openPicker("videoProfile")}
        />
        <Separator />
        <SettingsRow
          testID="e2e-action-settings__processing-open-video-target-preset"
          icon="resize-outline"
          label={t("settings.defaultVideoTargetPreset")}
          value={videoTargetPresetLabel(defaultVideoTargetPreset)}
          onPress={() => openPicker("videoTargetPreset")}
        />
        <Separator />
        <SettingsRow
          icon="image-outline"
          label={t("settings.videoThumbnailTimeMs")}
          value={`${videoThumbnailTimeMs}ms`}
        />
        <View className="px-2 pb-2">
          <SimpleSlider
            label=""
            value={videoThumbnailTimeMs}
            min={0}
            max={5000}
            step={100}
            onValueChange={setVideoThumbnailTimeMs}
          />
        </View>
        <Separator />
        <SettingsRow
          icon="git-branch-outline"
          label={t("settings.videoProcessingConcurrency")}
          value={`${videoProcessingConcurrency}`}
        />
        <View className="px-2 pb-2">
          <SimpleSlider
            label=""
            value={videoProcessingConcurrency}
            min={1}
            max={6}
            step={1}
            onValueChange={setVideoProcessingConcurrency}
          />
        </View>
      </SettingsSection>

      <OptionPickerModal
        visible={activePicker === "videoProfile"}
        title={t("settings.defaultVideoProfile")}
        options={videoProfileOptions}
        selectedValue={defaultVideoProfile}
        onSelect={setDefaultVideoProfile}
        onClose={closePicker}
      />
      <OptionPickerModal
        visible={activePicker === "videoTargetPreset"}
        title={t("settings.defaultVideoTargetPreset")}
        options={videoTargetPresetOptions}
        selectedValue={defaultVideoTargetPreset}
        onSelect={setDefaultVideoTargetPreset}
        onClose={closePicker}
      />
    </>
  );
}
