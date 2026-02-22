import { View, Text } from "react-native";
import { Input, Separator, TextField } from "heroui-native";
import { SettingsToggleRow } from "../../common/SettingsToggleRow";
import { useI18n } from "../../../i18n/useI18n";
import { useHapticFeedback } from "../../../hooks/useHapticFeedback";
import { useSettingsStore } from "../../../stores/useSettingsStore";
import { SettingsSection } from "../SettingsSection";
import { SettingsRow } from "../../common/SettingsRow";
import { SimpleSlider } from "../../common/SimpleSlider";
import { OptionPickerModal } from "../../common/OptionPickerModal";
import { useSettingsPicker } from "../../../hooks/useSettingsPicker";

const COMPOSE_PRESET_VALUES = ["rgb", "sho", "hoo", "lrgb", "custom"] as const;
const ADV_COMPOSE_REGISTRATION_VALUES = ["none", "translation", "full"] as const;
const ADV_COMPOSE_FRAMING_VALUES = ["first", "min", "cog"] as const;

export function ProcessingComposeSection() {
  const { t } = useI18n();
  const haptics = useHapticFeedback();
  const { activePicker, openPicker, closePicker } = useSettingsPicker();

  const defaultComposePreset = useSettingsStore((s) => s.defaultComposePreset);
  const composeRedWeight = useSettingsStore((s) => s.composeRedWeight);
  const composeGreenWeight = useSettingsStore((s) => s.composeGreenWeight);
  const composeBlueWeight = useSettingsStore((s) => s.composeBlueWeight);
  const advancedComposeRegistrationMode = useSettingsStore(
    (s) => s.advancedComposeRegistrationMode,
  );
  const advancedComposeFramingMode = useSettingsStore((s) => s.advancedComposeFramingMode);
  const advancedComposeAutoLinearMatch = useSettingsStore((s) => s.advancedComposeAutoLinearMatch);
  const advancedComposeAutoBrightnessBalance = useSettingsStore(
    (s) => s.advancedComposeAutoBrightnessBalance,
  );
  const advancedComposePreviewScale = useSettingsStore((s) => s.advancedComposePreviewScale);
  const advancedComposePixelMathR = useSettingsStore((s) => s.advancedComposePixelMathR);
  const advancedComposePixelMathG = useSettingsStore((s) => s.advancedComposePixelMathG);
  const advancedComposePixelMathB = useSettingsStore((s) => s.advancedComposePixelMathB);
  const setDefaultComposePreset = useSettingsStore((s) => s.setDefaultComposePreset);
  const setComposeRedWeight = useSettingsStore((s) => s.setComposeRedWeight);
  const setComposeGreenWeight = useSettingsStore((s) => s.setComposeGreenWeight);
  const setComposeBlueWeight = useSettingsStore((s) => s.setComposeBlueWeight);
  const setAdvancedComposeRegistrationMode = useSettingsStore(
    (s) => s.setAdvancedComposeRegistrationMode,
  );
  const setAdvancedComposeFramingMode = useSettingsStore((s) => s.setAdvancedComposeFramingMode);
  const setAdvancedComposeAutoLinearMatch = useSettingsStore(
    (s) => s.setAdvancedComposeAutoLinearMatch,
  );
  const setAdvancedComposeAutoBrightnessBalance = useSettingsStore(
    (s) => s.setAdvancedComposeAutoBrightnessBalance,
  );
  const setAdvancedComposePreviewScale = useSettingsStore((s) => s.setAdvancedComposePreviewScale);
  const setAdvancedComposePixelMathR = useSettingsStore((s) => s.setAdvancedComposePixelMathR);
  const setAdvancedComposePixelMathG = useSettingsStore((s) => s.setAdvancedComposePixelMathG);
  const setAdvancedComposePixelMathB = useSettingsStore((s) => s.setAdvancedComposePixelMathB);
  const resetSection = useSettingsStore((s) => s.resetSection);

  const composePresetLabel = (value: (typeof COMPOSE_PRESET_VALUES)[number]) =>
    value === "custom" ? t("settings.composePresetCustom") : value.toUpperCase();
  const advancedComposeRegistrationLabel = (
    value: (typeof ADV_COMPOSE_REGISTRATION_VALUES)[number],
  ) =>
    value === "none"
      ? t("editor.alignNone")
      : value === "translation"
        ? t("editor.alignTranslation")
        : t("editor.alignFull");
  const advancedComposeFramingLabel = (value: (typeof ADV_COMPOSE_FRAMING_VALUES)[number]) =>
    value === "first"
      ? t("settings.composeAdvancedFramingFirst")
      : value === "min"
        ? t("settings.composeAdvancedFramingMin")
        : t("settings.composeAdvancedFramingCog");

  const composePresetOptions = COMPOSE_PRESET_VALUES.map((value) => ({
    label: composePresetLabel(value),
    value,
  }));
  const advancedComposeRegistrationOptions = ADV_COMPOSE_REGISTRATION_VALUES.map((value) => ({
    label: advancedComposeRegistrationLabel(value),
    value,
  }));
  const advancedComposeFramingOptions = ADV_COMPOSE_FRAMING_VALUES.map((value) => ({
    label: advancedComposeFramingLabel(value),
    value,
  }));

  return (
    <>
      <SettingsSection
        title={t("settings.composeDefaults")}
        onReset={() => {
          haptics.selection();
          resetSection("compose");
        }}
      >
        <SettingsRow
          testID="e2e-action-settings__processing-open-compose-preset"
          icon="color-palette-outline"
          label={t("settings.defaultComposePreset")}
          value={composePresetLabel(defaultComposePreset)}
          onPress={() => openPicker("composePreset")}
        />
        <Separator />
        <SettingsRow
          icon="ellipse"
          label={t("settings.composeRedWeight")}
          value={composeRedWeight.toFixed(1)}
        />
        <View className="px-2 pb-2">
          <SimpleSlider
            label=""
            value={composeRedWeight}
            min={0}
            max={2}
            step={0.1}
            onValueChange={setComposeRedWeight}
          />
        </View>
        <Separator />
        <SettingsRow
          icon="ellipse"
          label={t("settings.composeGreenWeight")}
          value={composeGreenWeight.toFixed(1)}
        />
        <View className="px-2 pb-2">
          <SimpleSlider
            label=""
            value={composeGreenWeight}
            min={0}
            max={2}
            step={0.1}
            onValueChange={setComposeGreenWeight}
          />
        </View>
        <Separator />
        <SettingsRow
          icon="ellipse"
          label={t("settings.composeBlueWeight")}
          value={composeBlueWeight.toFixed(1)}
        />
        <View className="px-2 pb-2">
          <SimpleSlider
            label=""
            value={composeBlueWeight}
            min={0}
            max={2}
            step={0.1}
            onValueChange={setComposeBlueWeight}
          />
        </View>
      </SettingsSection>

      <SettingsSection title={t("settings.composeAdvancedDefaults")} collapsible defaultCollapsed>
        <SettingsRow
          testID="e2e-action-settings__processing-open-adv-registration"
          icon="sync-outline"
          label={t("settings.composeAdvancedRegistration")}
          value={advancedComposeRegistrationLabel(advancedComposeRegistrationMode)}
          onPress={() => openPicker("advancedComposeRegistration")}
        />
        <Separator />
        <SettingsRow
          testID="e2e-action-settings__processing-open-adv-framing"
          icon="crop-outline"
          label={t("settings.composeAdvancedFraming")}
          value={advancedComposeFramingLabel(advancedComposeFramingMode)}
          onPress={() => openPicker("advancedComposeFraming")}
        />
        <Separator />
        <SettingsToggleRow
          icon="analytics-outline"
          label={t("settings.composeAdvancedAutoLinearMatch")}
          isSelected={advancedComposeAutoLinearMatch}
          onSelectedChange={setAdvancedComposeAutoLinearMatch}
        />
        <Separator />
        <SettingsToggleRow
          icon="sunny-outline"
          label={t("settings.composeAdvancedAutoBrightnessBalance")}
          isSelected={advancedComposeAutoBrightnessBalance}
          onSelectedChange={setAdvancedComposeAutoBrightnessBalance}
        />
        <Separator />
        <SettingsRow
          icon="resize-outline"
          label={t("settings.composeAdvancedPreviewScale")}
          value={advancedComposePreviewScale.toFixed(2)}
        />
        <View className="px-2 pb-2">
          <SimpleSlider
            label=""
            value={advancedComposePreviewScale}
            min={0.1}
            max={1}
            step={0.05}
            onValueChange={setAdvancedComposePreviewScale}
          />
        </View>
        <Separator />
        <View className="px-2 py-2">
          <Text className="mb-2 text-xs text-muted">{t("settings.composeAdvancedPixelMath")}</Text>
          <TextField className="mb-2">
            <Input
              value={advancedComposePixelMathR}
              onChangeText={setAdvancedComposePixelMathR}
              placeholder="R"
            />
          </TextField>
          <TextField className="mb-2">
            <Input
              value={advancedComposePixelMathG}
              onChangeText={setAdvancedComposePixelMathG}
              placeholder="G"
            />
          </TextField>
          <TextField>
            <Input
              value={advancedComposePixelMathB}
              onChangeText={setAdvancedComposePixelMathB}
              placeholder="B"
            />
          </TextField>
        </View>
      </SettingsSection>

      <OptionPickerModal
        visible={activePicker === "composePreset"}
        title={t("settings.defaultComposePreset")}
        options={composePresetOptions}
        selectedValue={defaultComposePreset}
        onSelect={setDefaultComposePreset}
        onClose={closePicker}
      />
      <OptionPickerModal
        visible={activePicker === "advancedComposeRegistration"}
        title={t("settings.composeAdvancedRegistration")}
        options={advancedComposeRegistrationOptions}
        selectedValue={advancedComposeRegistrationMode}
        onSelect={setAdvancedComposeRegistrationMode}
        onClose={closePicker}
      />
      <OptionPickerModal
        visible={activePicker === "advancedComposeFraming"}
        title={t("settings.composeAdvancedFraming")}
        options={advancedComposeFramingOptions}
        selectedValue={advancedComposeFramingMode}
        onSelect={setAdvancedComposeFramingMode}
        onClose={closePicker}
      />
    </>
  );
}
