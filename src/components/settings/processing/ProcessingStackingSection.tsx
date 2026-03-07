import { Separator } from "heroui-native";
import { useShallow } from "zustand/react/shallow";
import { SettingsToggleRow } from "../../common/SettingsToggleRow";
import { useI18n } from "../../../i18n/useI18n";
import { useHapticFeedback } from "../../../hooks/common/useHapticFeedback";
import { useSettingsStore } from "../../../stores/app/useSettingsStore";
import { SettingsSection } from "../SettingsSection";
import { SettingsRow } from "../../common/SettingsRow";
import { SettingsSliderRow } from "../../common/SettingsSliderRow";
import { OptionPickerModal } from "../../common/OptionPickerModal";
import { useSettingsPicker } from "../../../hooks/common/useSettingsPicker";
import { ALIGNMENT_MODE_I18N } from "./constants";
import { StackingDetectionRows } from "./StackingDetectionRows";

const STACK_METHOD_VALUES = [
  "average",
  "median",
  "sigma",
  "min",
  "max",
  "winsorized",
  "weighted",
] as const;
const STACK_METHOD_I18N: Record<string, string> = {
  average: "editor.average",
  median: "editor.median",
  sigma: "editor.sigmaClip",
  min: "editor.min",
  max: "editor.max",
  winsorized: "editor.winsorized",
  weighted: "editor.weighted",
};
const ALIGNMENT_MODE_VALUES = ["none", "translation", "full"] as const;
const STACKING_DETECTION_PROFILE_VALUES = ["fast", "balanced", "accurate"] as const;
const STACKING_DETECTION_PROFILE_I18N: Record<string, string> = {
  fast: "settings.stackingProfileFast",
  balanced: "settings.stackingProfileBalanced",
  accurate: "settings.stackingProfileAccurate",
};

export function ProcessingStackingSection() {
  const { t } = useI18n();
  const haptics = useHapticFeedback();
  const { activePicker, openPicker, closePicker } = useSettingsPicker();

  const {
    defaultStackMethod,
    defaultSigmaValue,
    defaultAlignmentMode,
    defaultEnableQuality,
    stackingDetectionProfile,
    stackingUseAnnotatedForAlignment,
    stackingRansacMaxIterations,
    stackingAlignmentInlierThreshold,
    setDefaultStackMethod,
    setDefaultSigmaValue,
    setDefaultAlignmentMode,
    setDefaultEnableQuality,
    setStackingDetectionProfile,
    setStackingUseAnnotatedForAlignment,
    setStackingRansacMaxIterations,
    setStackingAlignmentInlierThreshold,
    resetSection,
  } = useSettingsStore(
    useShallow((s) => ({
      defaultStackMethod: s.defaultStackMethod,
      defaultSigmaValue: s.defaultSigmaValue,
      defaultAlignmentMode: s.defaultAlignmentMode,
      defaultEnableQuality: s.defaultEnableQuality,
      stackingDetectionProfile: s.stackingDetectionProfile,
      stackingUseAnnotatedForAlignment: s.stackingUseAnnotatedForAlignment,
      stackingRansacMaxIterations: s.stackingRansacMaxIterations,
      stackingAlignmentInlierThreshold: s.stackingAlignmentInlierThreshold,
      setDefaultStackMethod: s.setDefaultStackMethod,
      setDefaultSigmaValue: s.setDefaultSigmaValue,
      setDefaultAlignmentMode: s.setDefaultAlignmentMode,
      setDefaultEnableQuality: s.setDefaultEnableQuality,
      setStackingDetectionProfile: s.setStackingDetectionProfile,
      setStackingUseAnnotatedForAlignment: s.setStackingUseAnnotatedForAlignment,
      setStackingRansacMaxIterations: s.setStackingRansacMaxIterations,
      setStackingAlignmentInlierThreshold: s.setStackingAlignmentInlierThreshold,
      resetSection: s.resetSection,
    })),
  );

  const stackMethodLabel = (value: (typeof STACK_METHOD_VALUES)[number]) =>
    t(STACK_METHOD_I18N[value] ?? value);

  const alignmentModeLabel = (value: (typeof ALIGNMENT_MODE_VALUES)[number]) =>
    t(ALIGNMENT_MODE_I18N[value] ?? value);

  const stackingDetectionProfileLabel = (
    value: (typeof STACKING_DETECTION_PROFILE_VALUES)[number],
  ) => t(STACKING_DETECTION_PROFILE_I18N[value] ?? value);

  const stackMethodOptions = STACK_METHOD_VALUES.map((value) => ({
    label: stackMethodLabel(value),
    value,
  }));
  const alignmentModeOptions = ALIGNMENT_MODE_VALUES.map((value) => ({
    label: alignmentModeLabel(value),
    value,
  }));
  const stackingDetectionProfileOptions = STACKING_DETECTION_PROFILE_VALUES.map((value) => ({
    label: stackingDetectionProfileLabel(value),
    value,
  }));

  return (
    <>
      <SettingsSection
        title={t("settings.stackingDefaults")}
        collapsible
        onReset={() => {
          haptics.selection();
          resetSection("stacking");
        }}
      >
        <SettingsRow
          testID="e2e-action-settings__processing-open-stack-method"
          icon="layers-outline"
          label={t("settings.defaultStackMethod")}
          value={stackMethodLabel(defaultStackMethod)}
          onPress={() => openPicker("stackMethod")}
        />
        <Separator />
        <SettingsSliderRow
          icon="cut-outline"
          label={t("settings.defaultSigmaValue")}
          value={defaultSigmaValue}
          min={1.0}
          max={5.0}
          step={0.1}
          onValueChange={setDefaultSigmaValue}
        />
        <Separator />
        <SettingsRow
          testID="e2e-action-settings__processing-open-alignment-mode"
          icon="sync-outline"
          label={t("settings.defaultAlignmentMode")}
          value={alignmentModeLabel(defaultAlignmentMode)}
          onPress={() => openPicker("alignmentMode")}
        />
        <Separator />
        <SettingsToggleRow
          testID="e2e-action-settings__processing-toggle-enable-quality"
          icon="checkmark-circle-outline"
          label={t("settings.defaultEnableQuality")}
          isSelected={defaultEnableQuality}
          onSelectedChange={setDefaultEnableQuality}
        />
        <Separator />
        <SettingsToggleRow
          testID="e2e-action-settings__processing-toggle-use-annotated"
          icon="star-outline"
          label={t("settings.stackingUseAnnotatedForAlignment")}
          isSelected={stackingUseAnnotatedForAlignment}
          onSelectedChange={setStackingUseAnnotatedForAlignment}
        />
        <Separator />
        <SettingsRow
          testID="e2e-action-settings__processing-open-detection-profile"
          icon="sparkles-outline"
          label={t("settings.stackingDetectionProfile")}
          value={stackingDetectionProfileLabel(stackingDetectionProfile)}
          onPress={() => openPicker("stackingDetectionProfile")}
        />
        <Separator />
        <StackingDetectionRows />
        <Separator />
        <SettingsSliderRow
          icon="repeat-outline"
          label={t("settings.stackingRansacMaxIterations")}
          value={stackingRansacMaxIterations}
          min={20}
          max={400}
          step={10}
          onValueChange={setStackingRansacMaxIterations}
        />
        <Separator />
        <SettingsSliderRow
          icon="resize-outline"
          label={t("settings.stackingAlignmentInlierThreshold")}
          value={stackingAlignmentInlierThreshold}
          min={0.5}
          max={10}
          step={0.1}
          onValueChange={setStackingAlignmentInlierThreshold}
        />
      </SettingsSection>

      <OptionPickerModal
        visible={activePicker === "stackMethod"}
        title={t("settings.defaultStackMethod")}
        options={stackMethodOptions}
        selectedValue={defaultStackMethod}
        onSelect={setDefaultStackMethod}
        onClose={closePicker}
      />
      <OptionPickerModal
        visible={activePicker === "alignmentMode"}
        title={t("settings.defaultAlignmentMode")}
        options={alignmentModeOptions}
        selectedValue={defaultAlignmentMode}
        onSelect={setDefaultAlignmentMode}
        onClose={closePicker}
      />
      <OptionPickerModal
        visible={activePicker === "stackingDetectionProfile"}
        title={t("settings.stackingDetectionProfile")}
        options={stackingDetectionProfileOptions}
        selectedValue={stackingDetectionProfile}
        onSelect={setStackingDetectionProfile}
        onClose={closePicker}
      />
    </>
  );
}
