import { View, Text } from "react-native";
import { Input, Separator, TextField } from "heroui-native";
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

const COMPOSE_PRESET_VALUES = ["rgb", "sho", "hoo", "lrgb", "custom"] as const;
const ADV_COMPOSE_REGISTRATION_VALUES = ["none", "translation", "full"] as const;
const ADV_COMPOSE_FRAMING_VALUES = ["first", "min", "cog"] as const;

export function ProcessingComposeSection() {
  const { t } = useI18n();
  const haptics = useHapticFeedback();
  const { activePicker, openPicker, closePicker } = useSettingsPicker();

  const {
    defaultComposePreset,
    composeRedWeight,
    composeGreenWeight,
    composeBlueWeight,
    advancedComposeRegistrationMode,
    advancedComposeFramingMode,
    advancedComposeAutoLinearMatch,
    advancedComposeAutoBrightnessBalance,
    advancedComposePreviewScale,
    advancedComposePixelMathR,
    advancedComposePixelMathG,
    advancedComposePixelMathB,
    setDefaultComposePreset,
    setComposeRedWeight,
    setComposeGreenWeight,
    setComposeBlueWeight,
    setAdvancedComposeRegistrationMode,
    setAdvancedComposeFramingMode,
    setAdvancedComposeAutoLinearMatch,
    setAdvancedComposeAutoBrightnessBalance,
    setAdvancedComposePreviewScale,
    setAdvancedComposePixelMathR,
    setAdvancedComposePixelMathG,
    setAdvancedComposePixelMathB,
    resetSection,
  } = useSettingsStore(
    useShallow((s) => ({
      defaultComposePreset: s.defaultComposePreset,
      composeRedWeight: s.composeRedWeight,
      composeGreenWeight: s.composeGreenWeight,
      composeBlueWeight: s.composeBlueWeight,
      advancedComposeRegistrationMode: s.advancedComposeRegistrationMode,
      advancedComposeFramingMode: s.advancedComposeFramingMode,
      advancedComposeAutoLinearMatch: s.advancedComposeAutoLinearMatch,
      advancedComposeAutoBrightnessBalance: s.advancedComposeAutoBrightnessBalance,
      advancedComposePreviewScale: s.advancedComposePreviewScale,
      advancedComposePixelMathR: s.advancedComposePixelMathR,
      advancedComposePixelMathG: s.advancedComposePixelMathG,
      advancedComposePixelMathB: s.advancedComposePixelMathB,
      setDefaultComposePreset: s.setDefaultComposePreset,
      setComposeRedWeight: s.setComposeRedWeight,
      setComposeGreenWeight: s.setComposeGreenWeight,
      setComposeBlueWeight: s.setComposeBlueWeight,
      setAdvancedComposeRegistrationMode: s.setAdvancedComposeRegistrationMode,
      setAdvancedComposeFramingMode: s.setAdvancedComposeFramingMode,
      setAdvancedComposeAutoLinearMatch: s.setAdvancedComposeAutoLinearMatch,
      setAdvancedComposeAutoBrightnessBalance: s.setAdvancedComposeAutoBrightnessBalance,
      setAdvancedComposePreviewScale: s.setAdvancedComposePreviewScale,
      setAdvancedComposePixelMathR: s.setAdvancedComposePixelMathR,
      setAdvancedComposePixelMathG: s.setAdvancedComposePixelMathG,
      setAdvancedComposePixelMathB: s.setAdvancedComposePixelMathB,
      resetSection: s.resetSection,
    })),
  );

  const COMPOSE_PRESET_I18N: Record<string, string> = {
    custom: "settings.composePresetCustom",
  };
  const composePresetLabel = (value: (typeof COMPOSE_PRESET_VALUES)[number]) =>
    COMPOSE_PRESET_I18N[value] ? t(COMPOSE_PRESET_I18N[value]) : value.toUpperCase();

  const ADV_COMPOSE_REGISTRATION_I18N: Record<string, string> = {
    none: "editor.alignNone",
    translation: "editor.alignTranslation",
    full: "editor.alignFull",
  };
  const advancedComposeRegistrationLabel = (
    value: (typeof ADV_COMPOSE_REGISTRATION_VALUES)[number],
  ) => t(ADV_COMPOSE_REGISTRATION_I18N[value] ?? value);

  const ADV_COMPOSE_FRAMING_I18N: Record<string, string> = {
    first: "settings.composeAdvancedFramingFirst",
    min: "settings.composeAdvancedFramingMin",
    cog: "settings.composeAdvancedFramingCog",
  };
  const advancedComposeFramingLabel = (value: (typeof ADV_COMPOSE_FRAMING_VALUES)[number]) =>
    t(ADV_COMPOSE_FRAMING_I18N[value] ?? value);

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
        <SettingsSliderRow
          icon="ellipse"
          label={t("settings.composeRedWeight")}
          value={composeRedWeight}
          min={0}
          max={2}
          step={0.1}
          onValueChange={setComposeRedWeight}
        />
        <Separator />
        <SettingsSliderRow
          icon="ellipse"
          label={t("settings.composeGreenWeight")}
          value={composeGreenWeight}
          min={0}
          max={2}
          step={0.1}
          onValueChange={setComposeGreenWeight}
        />
        <Separator />
        <SettingsSliderRow
          icon="ellipse"
          label={t("settings.composeBlueWeight")}
          value={composeBlueWeight}
          min={0}
          max={2}
          step={0.1}
          onValueChange={setComposeBlueWeight}
        />
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
        <SettingsSliderRow
          icon="resize-outline"
          label={t("settings.composeAdvancedPreviewScale")}
          value={advancedComposePreviewScale}
          min={0.1}
          max={1}
          step={0.05}
          onValueChange={setAdvancedComposePreviewScale}
        />
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
