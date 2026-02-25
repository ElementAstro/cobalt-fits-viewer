import { Separator } from "heroui-native";
import { useShallow } from "zustand/react/shallow";
import { useI18n } from "../../../i18n/useI18n";
import { useHapticFeedback } from "../../../hooks/useHapticFeedback";
import { useSettingsStore } from "../../../stores/useSettingsStore";
import { SettingsSection } from "../SettingsSection";
import { SettingsRow } from "../../common/SettingsRow";
import { SettingsSliderRow } from "../../common/SettingsSliderRow";
import { OptionPickerModal } from "../../common/OptionPickerModal";
import { useSettingsPicker } from "../../../hooks/useSettingsPicker";

const EDITOR_MAX_UNDO_OPTIONS = [
  { label: "5", value: 5 },
  { label: "10", value: 10 },
  { label: "20", value: 20 },
  { label: "50", value: 50 },
];

export function ProcessingEditorSection() {
  const { t } = useI18n();
  const haptics = useHapticFeedback();
  const { activePicker, openPicker, closePicker } = useSettingsPicker();

  const {
    defaultBlurSigma,
    defaultSharpenAmount,
    defaultDenoiseRadius,
    editorMaxUndo,
    setDefaultBlurSigma,
    setDefaultSharpenAmount,
    setDefaultDenoiseRadius,
    setEditorMaxUndo,
    resetSection,
  } = useSettingsStore(
    useShallow((s) => ({
      defaultBlurSigma: s.defaultBlurSigma,
      defaultSharpenAmount: s.defaultSharpenAmount,
      defaultDenoiseRadius: s.defaultDenoiseRadius,
      editorMaxUndo: s.editorMaxUndo,
      setDefaultBlurSigma: s.setDefaultBlurSigma,
      setDefaultSharpenAmount: s.setDefaultSharpenAmount,
      setDefaultDenoiseRadius: s.setDefaultDenoiseRadius,
      setEditorMaxUndo: s.setEditorMaxUndo,
      resetSection: s.resetSection,
    })),
  );

  return (
    <>
      <SettingsSection
        title={t("settings.editorDefaults")}
        onReset={() => {
          haptics.selection();
          resetSection("editor");
        }}
      >
        <SettingsSliderRow
          testID="e2e-action-settings__processing-open-blur-sigma"
          icon="water-outline"
          label={t("settings.defaultBlurSigma")}
          value={defaultBlurSigma}
          min={0.5}
          max={10}
          step={0.5}
          onValueChange={setDefaultBlurSigma}
        />
        <Separator />
        <SettingsSliderRow
          testID="e2e-action-settings__processing-open-sharpen-amount"
          icon="sparkles-outline"
          label={t("settings.defaultSharpenAmount")}
          value={defaultSharpenAmount}
          min={0.5}
          max={5}
          step={0.5}
          onValueChange={setDefaultSharpenAmount}
        />
        <Separator />
        <SettingsSliderRow
          testID="e2e-action-settings__processing-open-denoise-radius"
          icon="layers-outline"
          label={t("settings.defaultDenoiseRadius")}
          value={defaultDenoiseRadius}
          min={1}
          max={5}
          step={1}
          onValueChange={setDefaultDenoiseRadius}
        />
        <Separator />
        <SettingsRow
          testID="e2e-action-settings__processing-open-editor-max-undo"
          icon="arrow-undo-outline"
          label={t("settings.editorMaxUndo")}
          value={`${editorMaxUndo}`}
          onPress={() => openPicker("editorMaxUndo")}
        />
      </SettingsSection>

      <OptionPickerModal
        visible={activePicker === "editorMaxUndo"}
        title={t("settings.editorMaxUndo")}
        options={EDITOR_MAX_UNDO_OPTIONS}
        selectedValue={editorMaxUndo}
        onSelect={setEditorMaxUndo}
        onClose={closePicker}
      />
    </>
  );
}
