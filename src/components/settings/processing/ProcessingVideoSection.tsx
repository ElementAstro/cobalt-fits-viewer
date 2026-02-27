import { Separator } from "heroui-native";
import { useShallow } from "zustand/react/shallow";
import { SettingsToggleRow } from "../../common/SettingsToggleRow";
import { useI18n } from "../../../i18n/useI18n";
import { useHapticFeedback } from "../../../hooks/useHapticFeedback";
import { useSettingsStore } from "../../../stores/useSettingsStore";
import { SettingsSection } from "../SettingsSection";
import { SettingsRow } from "../../common/SettingsRow";
import { SettingsSliderRow } from "../../common/SettingsSliderRow";
import { OptionPickerModal } from "../../common/OptionPickerModal";
import { useSettingsPicker } from "../../../hooks/useSettingsPicker";

const VIDEO_PROFILE_VALUES = ["compatibility", "balanced", "quality"] as const;
const VIDEO_TARGET_PRESET_VALUES = ["1080p", "720p", "custom"] as const;

export function ProcessingVideoSection() {
  const { t } = useI18n();
  const haptics = useHapticFeedback();
  const { activePicker, openPicker, closePicker } = useSettingsPicker();

  const {
    videoCoreEnabled,
    videoProcessingEnabled,
    videoResumePlayback,
    videoAutoplay,
    videoLoopByDefault,
    videoMutedByDefault,
    videoThumbnailTimeMs,
    videoProcessingConcurrency,
    defaultVideoProfile,
    defaultVideoTargetPreset,
    setVideoCoreEnabled,
    setVideoProcessingEnabled,
    setVideoResumePlayback,
    setVideoAutoplay,
    setVideoLoopByDefault,
    setVideoMutedByDefault,
    setVideoThumbnailTimeMs,
    setVideoProcessingConcurrency,
    setDefaultVideoProfile,
    setDefaultVideoTargetPreset,
    resetSection,
  } = useSettingsStore(
    useShallow((s) => ({
      videoCoreEnabled: s.videoCoreEnabled,
      videoProcessingEnabled: s.videoProcessingEnabled,
      videoResumePlayback: s.videoResumePlayback,
      videoAutoplay: s.videoAutoplay,
      videoLoopByDefault: s.videoLoopByDefault,
      videoMutedByDefault: s.videoMutedByDefault,
      videoThumbnailTimeMs: s.videoThumbnailTimeMs,
      videoProcessingConcurrency: s.videoProcessingConcurrency,
      defaultVideoProfile: s.defaultVideoProfile,
      defaultVideoTargetPreset: s.defaultVideoTargetPreset,
      setVideoCoreEnabled: s.setVideoCoreEnabled,
      setVideoProcessingEnabled: s.setVideoProcessingEnabled,
      setVideoResumePlayback: s.setVideoResumePlayback,
      setVideoAutoplay: s.setVideoAutoplay,
      setVideoLoopByDefault: s.setVideoLoopByDefault,
      setVideoMutedByDefault: s.setVideoMutedByDefault,
      setVideoThumbnailTimeMs: s.setVideoThumbnailTimeMs,
      setVideoProcessingConcurrency: s.setVideoProcessingConcurrency,
      setDefaultVideoProfile: s.setDefaultVideoProfile,
      setDefaultVideoTargetPreset: s.setDefaultVideoTargetPreset,
      resetSection: s.resetSection,
    })),
  );

  const VIDEO_PROFILE_I18N: Record<string, string> = {
    compatibility: "settings.videoProfileCompatibility",
    balanced: "settings.videoProfileBalanced",
    quality: "settings.videoProfileQuality",
  };
  const videoProfileLabel = (value: (typeof VIDEO_PROFILE_VALUES)[number]) =>
    t(VIDEO_PROFILE_I18N[value] ?? value);

  const VIDEO_TARGET_PRESET_I18N: Record<string, string> = {
    custom: "settings.videoPresetCustom",
  };
  const videoTargetPresetLabel = (value: (typeof VIDEO_TARGET_PRESET_VALUES)[number]) =>
    VIDEO_TARGET_PRESET_I18N[value] ? t(VIDEO_TARGET_PRESET_I18N[value]) : value;

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
          testID="e2e-action-settings__processing-toggle-video-resume"
          icon="play-skip-forward-outline"
          label={t("settings.videoResumePlayback")}
          isSelected={videoResumePlayback}
          onSelectedChange={setVideoResumePlayback}
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
        <SettingsSliderRow
          icon="image-outline"
          label={t("settings.videoThumbnailTimeMs")}
          value={videoThumbnailTimeMs}
          format={(v) => `${v}ms`}
          min={0}
          max={5000}
          step={100}
          onValueChange={setVideoThumbnailTimeMs}
        />
        <Separator />
        <SettingsSliderRow
          icon="git-branch-outline"
          label={t("settings.videoProcessingConcurrency")}
          value={videoProcessingConcurrency}
          min={1}
          max={6}
          step={1}
          onValueChange={setVideoProcessingConcurrency}
        />
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
