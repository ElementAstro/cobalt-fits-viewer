import { View, Text, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { Separator, Switch } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useI18n } from "../../i18n/useI18n";
import { useResponsiveLayout } from "../../hooks/useResponsiveLayout";
import { useHapticFeedback } from "../../hooks/useHapticFeedback";
import { useSettingsStore } from "../../stores/useSettingsStore";
import { SettingsSection } from "../../components/settings";
import { SettingsRow } from "../../components/common/SettingsRow";
import { SimpleSlider } from "../../components/common/SimpleSlider";
import { OptionPickerModal } from "../../components/common/OptionPickerModal";
import { useSettingsPicker } from "../../hooks/useSettingsPicker";
import type { ExportFormat } from "../../lib/fits/types";

const STACK_METHOD_VALUES = [
  "average",
  "median",
  "sigma",
  "min",
  "max",
  "winsorized",
  "weighted",
] as const;
const ALIGNMENT_MODE_VALUES = ["none", "translation", "full"] as const;
const DEBOUNCE_OPTIONS = [
  { label: "50ms", value: 50 },
  { label: "100ms", value: 100 },
  { label: "150ms", value: 150 },
  { label: "200ms", value: 200 },
  { label: "300ms", value: 300 },
  { label: "500ms", value: 500 },
];
const EDITOR_MAX_UNDO_OPTIONS = [
  { label: "5", value: 5 },
  { label: "10", value: 10 },
  { label: "20", value: 20 },
  { label: "50", value: 50 },
];
const CONVERTER_FORMAT_OPTIONS = [
  { label: "PNG", value: "png" as const },
  { label: "JPEG", value: "jpeg" as const },
  { label: "TIFF", value: "tiff" as const },
  { label: "WebP", value: "webp" as const },
];
const BATCH_NAMING_VALUES = ["original", "prefix", "suffix", "sequence"] as const;
const COMPOSE_PRESET_VALUES = ["rgb", "sho", "hoo", "lrgb", "custom"] as const;
const EXPORT_FORMAT_OPTIONS: Array<{ label: string; value: ExportFormat }> = [
  { label: "PNG", value: "png" },
  { label: "JPEG", value: "jpeg" },
  { label: "WebP", value: "webp" },
  { label: "TIFF", value: "tiff" },
  { label: "BMP", value: "bmp" },
];

export default function ProcessingSettingsScreen() {
  const { t } = useI18n();
  const haptics = useHapticFeedback();
  const { contentPaddingTop, horizontalPadding } = useResponsiveLayout();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { activePicker, openPicker, closePicker } = useSettingsPicker();

  // Editor defaults
  const defaultBlurSigma = useSettingsStore((s) => s.defaultBlurSigma);
  const defaultSharpenAmount = useSettingsStore((s) => s.defaultSharpenAmount);
  const defaultDenoiseRadius = useSettingsStore((s) => s.defaultDenoiseRadius);
  const editorMaxUndo = useSettingsStore((s) => s.editorMaxUndo);
  const setDefaultBlurSigma = useSettingsStore((s) => s.setDefaultBlurSigma);
  const setDefaultSharpenAmount = useSettingsStore((s) => s.setDefaultSharpenAmount);
  const setDefaultDenoiseRadius = useSettingsStore((s) => s.setDefaultDenoiseRadius);
  const setEditorMaxUndo = useSettingsStore((s) => s.setEditorMaxUndo);

  // Stacking defaults
  const defaultStackMethod = useSettingsStore((s) => s.defaultStackMethod);
  const defaultSigmaValue = useSettingsStore((s) => s.defaultSigmaValue);
  const defaultAlignmentMode = useSettingsStore((s) => s.defaultAlignmentMode);
  const defaultEnableQuality = useSettingsStore((s) => s.defaultEnableQuality);
  const setDefaultStackMethod = useSettingsStore((s) => s.setDefaultStackMethod);
  const setDefaultSigmaValue = useSettingsStore((s) => s.setDefaultSigmaValue);
  const setDefaultAlignmentMode = useSettingsStore((s) => s.setDefaultAlignmentMode);
  const setDefaultEnableQuality = useSettingsStore((s) => s.setDefaultEnableQuality);

  // Converter defaults
  const defaultConverterFormat = useSettingsStore((s) => s.defaultConverterFormat);
  const defaultConverterQuality = useSettingsStore((s) => s.defaultConverterQuality);
  const batchNamingRule = useSettingsStore((s) => s.batchNamingRule);
  const setDefaultConverterFormat = useSettingsStore((s) => s.setDefaultConverterFormat);
  const setDefaultConverterQuality = useSettingsStore((s) => s.setDefaultConverterQuality);
  const setBatchNamingRule = useSettingsStore((s) => s.setBatchNamingRule);

  // Export defaults
  const defaultExportFormat = useSettingsStore((s) => s.defaultExportFormat);
  const setDefaultExportFormat = useSettingsStore((s) => s.setDefaultExportFormat);

  // Compose defaults
  const defaultComposePreset = useSettingsStore((s) => s.defaultComposePreset);
  const composeRedWeight = useSettingsStore((s) => s.composeRedWeight);
  const composeGreenWeight = useSettingsStore((s) => s.composeGreenWeight);
  const composeBlueWeight = useSettingsStore((s) => s.composeBlueWeight);
  const setDefaultComposePreset = useSettingsStore((s) => s.setDefaultComposePreset);
  const setComposeRedWeight = useSettingsStore((s) => s.setComposeRedWeight);
  const setComposeGreenWeight = useSettingsStore((s) => s.setComposeGreenWeight);
  const setComposeBlueWeight = useSettingsStore((s) => s.setComposeBlueWeight);

  // Performance
  const imageProcessingDebounce = useSettingsStore((s) => s.imageProcessingDebounce);
  const useHighQualityPreview = useSettingsStore((s) => s.useHighQualityPreview);
  const setImageProcessingDebounce = useSettingsStore((s) => s.setImageProcessingDebounce);
  const setUseHighQualityPreview = useSettingsStore((s) => s.setUseHighQualityPreview);

  const stackMethodLabel = (value: (typeof STACK_METHOD_VALUES)[number]) =>
    t(
      value === "average"
        ? "editor.average"
        : value === "median"
          ? "editor.median"
          : value === "sigma"
            ? "editor.sigmaClip"
            : value === "min"
              ? "editor.min"
              : value === "max"
                ? "editor.max"
                : value === "winsorized"
                  ? "editor.winsorized"
                  : "editor.weighted",
    );

  const alignmentModeLabel = (value: (typeof ALIGNMENT_MODE_VALUES)[number]) =>
    t(
      value === "none"
        ? "editor.alignNone"
        : value === "translation"
          ? "editor.alignTranslation"
          : "editor.alignFull",
    );

  const composePresetLabel = (value: (typeof COMPOSE_PRESET_VALUES)[number]) =>
    value === "custom" ? t("settings.composePresetCustom") : value.toUpperCase();

  const stackMethodOptions = STACK_METHOD_VALUES.map((value) => ({
    label: stackMethodLabel(value),
    value,
  }));

  const alignmentModeOptions = ALIGNMENT_MODE_VALUES.map((value) => ({
    label: alignmentModeLabel(value),
    value,
  }));

  const batchNamingOptions = BATCH_NAMING_VALUES.map((value) => ({
    label:
      value === "original"
        ? t("settings.namingOriginal")
        : value === "prefix"
          ? t("settings.namingPrefix")
          : value === "suffix"
            ? t("settings.namingSuffix")
            : t("settings.namingSequence"),
    value,
  }));

  const composePresetOptions = COMPOSE_PRESET_VALUES.map((value) => ({
    label: composePresetLabel(value),
    value,
  }));

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: horizontalPadding,
          paddingTop: contentPaddingTop,
          paddingBottom: insets.bottom + 24,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="flex-row items-center gap-3 mb-4">
          <Ionicons name="arrow-back" size={24} color="#888" onPress={() => router.back()} />
          <Text className="text-xl font-bold text-foreground">
            {t("settings.categories.processing")}
          </Text>
        </View>

        {/* Editor Defaults */}
        <SettingsSection title={t("settings.editorDefaults")}>
          <SettingsRow
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
            icon="arrow-undo-outline"
            label={t("settings.editorMaxUndo")}
            value={`${editorMaxUndo}`}
            onPress={() => openPicker("editorMaxUndo")}
          />
        </SettingsSection>

        {/* Stacking Defaults */}
        <SettingsSection title={t("settings.stackingDefaults")}>
          <SettingsRow
            icon="layers-outline"
            label={t("settings.defaultStackMethod")}
            value={stackMethodLabel(defaultStackMethod)}
            onPress={() => openPicker("stackMethod")}
          />
          <Separator />
          <SettingsRow
            icon="cut-outline"
            label={t("settings.defaultSigmaValue")}
            value={defaultSigmaValue.toFixed(1)}
          />
          <View className="px-2 pb-2">
            <SimpleSlider
              label=""
              value={defaultSigmaValue}
              min={1.0}
              max={5.0}
              step={0.1}
              onValueChange={setDefaultSigmaValue}
            />
          </View>
          <Separator />
          <SettingsRow
            icon="sync-outline"
            label={t("settings.defaultAlignmentMode")}
            value={alignmentModeLabel(defaultAlignmentMode)}
            onPress={() => openPicker("alignmentMode")}
          />
          <Separator />
          <SettingsRow
            icon="checkmark-circle-outline"
            label={t("settings.defaultEnableQuality")}
            rightElement={
              <Switch
                isSelected={defaultEnableQuality}
                onSelectedChange={(v: boolean) => {
                  haptics.selection();
                  setDefaultEnableQuality(v);
                }}
              />
            }
          />
        </SettingsSection>

        {/* Export Defaults */}
        <SettingsSection title={t("settings.export")}>
          <SettingsRow
            icon="download-outline"
            label={t("settings.defaultExportFormat")}
            value={defaultExportFormat.toUpperCase()}
            onPress={() => openPicker("exportFormat")}
          />
        </SettingsSection>

        {/* Converter Defaults */}
        <SettingsSection title={t("settings.converterDefaults")}>
          <SettingsRow
            icon="image-outline"
            label={t("settings.defaultConverterFormat")}
            value={defaultConverterFormat.toUpperCase()}
            onPress={() => openPicker("converterFormat")}
          />
          <Separator />
          <SettingsRow
            icon="options-outline"
            label={t("settings.defaultConverterQuality")}
            value={`${defaultConverterQuality}%`}
          />
          <View className="px-2 pb-2">
            <SimpleSlider
              label=""
              value={defaultConverterQuality}
              min={10}
              max={100}
              step={5}
              onValueChange={setDefaultConverterQuality}
            />
          </View>
          <Separator />
          <SettingsRow
            icon="text-outline"
            label={t("settings.batchNamingRule")}
            value={
              batchNamingRule === "original"
                ? t("settings.namingOriginal")
                : batchNamingRule === "prefix"
                  ? t("settings.namingPrefix")
                  : batchNamingRule === "suffix"
                    ? t("settings.namingSuffix")
                    : t("settings.namingSequence")
            }
            onPress={() => openPicker("batchNamingRule")}
          />
        </SettingsSection>

        {/* Compose Defaults */}
        <SettingsSection title={t("settings.composeDefaults")}>
          <SettingsRow
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

        {/* Performance */}
        <SettingsSection title={t("settings.performance")}>
          <SettingsRow
            icon="speedometer-outline"
            label={t("settings.imageProcessingDebounce")}
            value={`${imageProcessingDebounce}ms`}
            onPress={() => openPicker("debounce")}
          />
          <Separator />
          <SettingsRow
            icon="eye-outline"
            label={t("settings.useHighQualityPreview")}
            rightElement={
              <Switch
                isSelected={useHighQualityPreview}
                onSelectedChange={(v: boolean) => {
                  haptics.selection();
                  setUseHighQualityPreview(v);
                }}
              />
            }
          />
        </SettingsSection>

        {/* Picker Modals */}
        <OptionPickerModal
          visible={activePicker === "editorMaxUndo"}
          title={t("settings.editorMaxUndo")}
          options={EDITOR_MAX_UNDO_OPTIONS}
          selectedValue={editorMaxUndo}
          onSelect={setEditorMaxUndo}
          onClose={closePicker}
        />
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
          visible={activePicker === "exportFormat"}
          title={t("settings.defaultExportFormat")}
          options={EXPORT_FORMAT_OPTIONS}
          selectedValue={defaultExportFormat}
          onSelect={setDefaultExportFormat}
          onClose={closePicker}
        />
        <OptionPickerModal
          visible={activePicker === "converterFormat"}
          title={t("settings.defaultConverterFormat")}
          options={CONVERTER_FORMAT_OPTIONS}
          selectedValue={defaultConverterFormat}
          onSelect={setDefaultConverterFormat}
          onClose={closePicker}
        />
        <OptionPickerModal
          visible={activePicker === "batchNamingRule"}
          title={t("settings.batchNamingRule")}
          options={batchNamingOptions}
          selectedValue={batchNamingRule}
          onSelect={setBatchNamingRule}
          onClose={closePicker}
        />
        <OptionPickerModal
          visible={activePicker === "composePreset"}
          title={t("settings.defaultComposePreset")}
          options={composePresetOptions}
          selectedValue={defaultComposePreset}
          onSelect={setDefaultComposePreset}
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
      </ScrollView>
    </View>
  );
}
