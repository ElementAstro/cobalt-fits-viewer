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
import type { ExportFormat } from "../../../lib/fits/types";

const EXPORT_FORMAT_OPTIONS: Array<{ label: string; value: ExportFormat }> = [
  { label: "PNG", value: "png" },
  { label: "JPEG", value: "jpeg" },
  { label: "WebP", value: "webp" },
  { label: "TIFF", value: "tiff" },
  { label: "BMP", value: "bmp" },
  { label: "FITS", value: "fits" },
];
const BATCH_NAMING_VALUES = ["original", "prefix", "suffix", "sequence"] as const;

export function ProcessingExportSection() {
  const { t } = useI18n();
  const haptics = useHapticFeedback();
  const { activePicker, openPicker, closePicker } = useSettingsPicker();

  const {
    defaultExportFormat,
    setDefaultExportFormat,
    defaultConverterFormat,
    defaultConverterQuality,
    batchNamingRule,
    setDefaultConverterFormat,
    setDefaultConverterQuality,
    setBatchNamingRule,
    resetSection,
  } = useSettingsStore(
    useShallow((s) => ({
      defaultExportFormat: s.defaultExportFormat,
      setDefaultExportFormat: s.setDefaultExportFormat,
      defaultConverterFormat: s.defaultConverterFormat,
      defaultConverterQuality: s.defaultConverterQuality,
      batchNamingRule: s.batchNamingRule,
      setDefaultConverterFormat: s.setDefaultConverterFormat,
      setDefaultConverterQuality: s.setDefaultConverterQuality,
      setBatchNamingRule: s.setBatchNamingRule,
      resetSection: s.resetSection,
    })),
  );

  const BATCH_NAMING_I18N: Record<string, string> = {
    original: "settings.namingOriginal",
    prefix: "settings.namingPrefix",
    suffix: "settings.namingSuffix",
    sequence: "settings.namingSequence",
  };
  const batchNamingLabel = (value: (typeof BATCH_NAMING_VALUES)[number]) =>
    t(BATCH_NAMING_I18N[value] ?? value);

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
        <SettingsSliderRow
          icon="options-outline"
          label={t("settings.defaultConverterQuality")}
          value={defaultConverterQuality}
          format={(v) => `${v}%`}
          min={10}
          max={100}
          step={5}
          onValueChange={setDefaultConverterQuality}
        />
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
        options={EXPORT_FORMAT_OPTIONS}
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
