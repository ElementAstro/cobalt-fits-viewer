import { View } from "react-native";
import { Separator } from "heroui-native";
import { useI18n } from "../../../i18n/useI18n";
import { useHapticFeedback } from "../../../hooks/useHapticFeedback";
import { useSettingsStore } from "../../../stores/useSettingsStore";
import { SettingsSection } from "../SettingsSection";
import { SettingsRow } from "../../common/SettingsRow";
import { SimpleSlider } from "../../common/SimpleSlider";
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

  const defaultBlurSigma = useSettingsStore((s) => s.defaultBlurSigma);
  const defaultSharpenAmount = useSettingsStore((s) => s.defaultSharpenAmount);
  const defaultDenoiseRadius = useSettingsStore((s) => s.defaultDenoiseRadius);
  const editorMaxUndo = useSettingsStore((s) => s.editorMaxUndo);
  const setDefaultBlurSigma = useSettingsStore((s) => s.setDefaultBlurSigma);
  const setDefaultSharpenAmount = useSettingsStore((s) => s.setDefaultSharpenAmount);
  const setDefaultDenoiseRadius = useSettingsStore((s) => s.setDefaultDenoiseRadius);
  const setEditorMaxUndo = useSettingsStore((s) => s.setEditorMaxUndo);
  const resetSection = useSettingsStore((s) => s.resetSection);

  return (
    <>
      <SettingsSection
        title={t("settings.editorDefaults")}
        onReset={() => {
          haptics.selection();
          resetSection("editor");
        }}
      >
        <SettingsRow
          testID="e2e-action-settings__processing-open-blur-sigma"
          icon="water-outline"
          label={t("settings.defaultBlurSigma")}
          value={defaultBlurSigma.toFixed(1)}
        />
        <View className="px-2 pb-2">
          <SimpleSlider
            label=""
            value={defaultBlurSigma}
            min={0.5}
            max={10}
            step={0.5}
            onValueChange={setDefaultBlurSigma}
          />
        </View>
        <Separator />
        <SettingsRow
          testID="e2e-action-settings__processing-open-sharpen-amount"
          icon="sparkles-outline"
          label={t("settings.defaultSharpenAmount")}
          value={defaultSharpenAmount.toFixed(1)}
        />
        <View className="px-2 pb-2">
          <SimpleSlider
            label=""
            value={defaultSharpenAmount}
            min={0.5}
            max={5}
            step={0.5}
            onValueChange={setDefaultSharpenAmount}
          />
        </View>
        <Separator />
        <SettingsRow
          testID="e2e-action-settings__processing-open-denoise-radius"
          icon="layers-outline"
          label={t("settings.defaultDenoiseRadius")}
          value={`${defaultDenoiseRadius}`}
        />
        <View className="px-2 pb-2">
          <SimpleSlider
            label=""
            value={defaultDenoiseRadius}
            min={1}
            max={5}
            step={1}
            onValueChange={setDefaultDenoiseRadius}
          />
        </View>
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
