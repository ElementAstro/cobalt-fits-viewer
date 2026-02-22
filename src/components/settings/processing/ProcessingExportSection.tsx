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
import type { ExportFormat } from "../../../lib/fits/types";

const EXPORT_FORMAT_OPTIONS: Array<{ label: string; value: ExportFormat }> = [
  { label: "PNG", value: "png" },
  { label: "JPEG", value: "jpeg" },
  { label: "WebP", value: "webp" },
  { label: "TIFF", value: "tiff" },
  { label: "BMP", value: "bmp" },
  { label: "FITS", value: "fits" },
];
const CONVERTER_FORMAT_OPTIONS = [
  { label: "PNG", value: "png" as const },
  { label: "JPEG", value: "jpeg" as const },
  { label: "TIFF", value: "tiff" as const },
  { label: "WebP", value: "webp" as const },
  { label: "BMP", value: "bmp" as const },
  { label: "FITS", value: "fits" as const },
];
const BATCH_NAMING_VALUES = ["original", "prefix", "suffix", "sequence"] as const;

export function ProcessingExportSection() {
  const { t } = useI18n();
  const haptics = useHapticFeedback();
  const { activePicker, openPicker, closePicker } = useSettingsPicker();

  const defaultExportFormat = useSettingsStore((s) => s.defaultExportFormat);
  const setDefaultExportFormat = useSettingsStore((s) => s.setDefaultExportFormat);
  const defaultConverterFormat = useSettingsStore((s) => s.defaultConverterFormat);
  const defaultConverterQuality = useSettingsStore((s) => s.defaultConverterQuality);
  const batchNamingRule = useSettingsStore((s) => s.batchNamingRule);
  const setDefaultConverterFormat = useSettingsStore((s) => s.setDefaultConverterFormat);
  const setDefaultConverterQuality = useSettingsStore((s) => s.setDefaultConverterQuality);
  const setBatchNamingRule = useSettingsStore((s) => s.setBatchNamingRule);
  const resetSection = useSettingsStore((s) => s.resetSection);

  const batchNamingLabel = (value: (typeof BATCH_NAMING_VALUES)[number]) =>
    value === "original"
      ? t("settings.namingOriginal")
      : value === "prefix"
        ? t("settings.namingPrefix")
        : value === "suffix"
          ? t("settings.namingSuffix")
          : t("settings.namingSequence");

  const batchNamingOptions = BATCH_NAMING_VALUES.map((value) => ({
    label: batchNamingLabel(value),
    value,
  }));

  return (
    <>
      {/* Export Defaults */}
      <SettingsSection
        title={t("settings.export")}
        onReset={() => {
          haptics.selection();
          resetSection("export");
        }}
      >
        <SettingsRow
          testID="e2e-action-settings__processing-open-export-format"
          icon="download-outline"
          label={t("settings.defaultExportFormat")}
          value={defaultExportFormat.toUpperCase()}
          onPress={() => openPicker("exportFormat")}
        />
      </SettingsSection>

      {/* Converter Defaults */}
      <SettingsSection title={t("settings.converterDefaults")}>
        <SettingsRow
          testID="e2e-action-settings__processing-open-converter-format"
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
          testID="e2e-action-settings__processing-open-batch-naming"
          icon="text-outline"
          label={t("settings.batchNamingRule")}
          value={batchNamingLabel(batchNamingRule)}
          onPress={() => openPicker("batchNamingRule")}
        />
      </SettingsSection>

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
    </>
  );
}
