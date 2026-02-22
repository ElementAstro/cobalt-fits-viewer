import { Separator } from "heroui-native";
import { SettingsToggleRow } from "../../common/SettingsToggleRow";
import { useI18n } from "../../../i18n/useI18n";
import { useHapticFeedback } from "../../../hooks/useHapticFeedback";
import { useSettingsStore } from "../../../stores/useSettingsStore";
import { SettingsSection } from "../SettingsSection";
import { SettingsRow } from "../../common/SettingsRow";
import { OptionPickerModal } from "../../common/OptionPickerModal";
import { useSettingsPicker } from "../../../hooks/useSettingsPicker";

const DEBOUNCE_OPTIONS = [
  { label: "50ms", value: 50 },
  { label: "100ms", value: 100 },
  { label: "150ms", value: 150 },
  { label: "200ms", value: 200 },
  { label: "300ms", value: 300 },
  { label: "500ms", value: 500 },
];
const IMAGE_PROCESSING_PROFILE_OPTIONS = [
  { label: "Standard", value: "standard" as const },
  { label: "Legacy", value: "legacy" as const },
];

export function ProcessingPerformanceSection() {
  const { t } = useI18n();
  const haptics = useHapticFeedback();
  const { activePicker, openPicker, closePicker } = useSettingsPicker();

  const imageProcessingProfile = useSettingsStore((s) => s.imageProcessingProfile);
  const viewerApplyEditorRecipe = useSettingsStore((s) => s.viewerApplyEditorRecipe);
  const imageProcessingDebounce = useSettingsStore((s) => s.imageProcessingDebounce);
  const useHighQualityPreview = useSettingsStore((s) => s.useHighQualityPreview);
  const setImageProcessingProfile = useSettingsStore((s) => s.setImageProcessingProfile);
  const setViewerApplyEditorRecipe = useSettingsStore((s) => s.setViewerApplyEditorRecipe);
  const setImageProcessingDebounce = useSettingsStore((s) => s.setImageProcessingDebounce);
  const setUseHighQualityPreview = useSettingsStore((s) => s.setUseHighQualityPreview);
  const resetSection = useSettingsStore((s) => s.resetSection);

  const imageProcessingProfileLabel = (value: "standard" | "legacy") =>
    value === "legacy"
      ? t("settings.imageProcessingProfileLegacy")
      : t("settings.imageProcessingProfileStandard");

  const imageProcessingProfileOptions = IMAGE_PROCESSING_PROFILE_OPTIONS.map((option) => ({
    label: imageProcessingProfileLabel(option.value),
    value: option.value,
  }));

  return (
    <>
      <SettingsSection
        title={t("settings.performance")}
        onReset={() => {
          haptics.selection();
          resetSection("performance");
        }}
      >
        <SettingsRow
          testID="e2e-action-settings__processing-open-image-profile"
          icon="options-outline"
          label={t("settings.imageProcessingProfile")}
          value={imageProcessingProfileLabel(imageProcessingProfile)}
          onPress={() => openPicker("imageProcessingProfile")}
        />
        <Separator />
        <SettingsToggleRow
          testID="e2e-action-settings__processing-toggle-apply-recipe"
          icon="eye-outline"
          label={t("settings.viewerApplyEditorRecipe")}
          isSelected={viewerApplyEditorRecipe}
          onSelectedChange={setViewerApplyEditorRecipe}
        />
        <Separator />
        <SettingsRow
          testID="e2e-action-settings__processing-open-debounce"
          icon="speedometer-outline"
          label={t("settings.imageProcessingDebounce")}
          value={`${imageProcessingDebounce}ms`}
          onPress={() => openPicker("debounce")}
        />
        <Separator />
        <SettingsToggleRow
          testID="e2e-action-settings__processing-toggle-hq-preview"
          icon="eye-outline"
          label={t("settings.useHighQualityPreview")}
          isSelected={useHighQualityPreview}
          onSelectedChange={setUseHighQualityPreview}
        />
      </SettingsSection>

      <OptionPickerModal
        visible={activePicker === "imageProcessingProfile"}
        title={t("settings.imageProcessingProfile")}
        options={imageProcessingProfileOptions}
        selectedValue={imageProcessingProfile}
        onSelect={setImageProcessingProfile}
        onClose={closePicker}
      />
      <OptionPickerModal
        visible={activePicker === "debounce"}
        title={t("settings.imageProcessingDebounce")}
        options={DEBOUNCE_OPTIONS}
        selectedValue={imageProcessingDebounce}
        onSelect={setImageProcessingDebounce}
        onClose={closePicker}
      />
    </>
  );
}
