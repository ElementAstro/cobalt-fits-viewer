import { View } from "react-native";
import { Chip, Separator } from "heroui-native";
import { useShallow } from "zustand/react/shallow";
import { SettingsToggleRow } from "../../common/SettingsToggleRow";
import { useI18n } from "../../../i18n/useI18n";
import { useHapticFeedback } from "../../../hooks/useHapticFeedback";
import { useSettingsStore } from "../../../stores/useSettingsStore";
import { SettingsSection } from "../SettingsSection";
import { SettingsRow } from "../../common/SettingsRow";
import { SettingsSliderRow } from "../../common/SettingsSliderRow";
import { SimpleSlider } from "../../common/SimpleSlider";
import { OptionPickerModal } from "../../common/OptionPickerModal";
import { useSettingsPicker } from "../../../hooks/useSettingsPicker";

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
const STACKING_DETECTION_PROFILE_VALUES = ["fast", "balanced", "accurate"] as const;

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
    stackingDetectSigmaThreshold,
    stackingDetectMaxStars,
    stackingDetectMinArea,
    stackingDetectMaxArea,
    stackingDetectBorderMargin,
    stackingDetectSigmaClipIters,
    stackingDetectApplyMatchedFilter,
    stackingDetectConnectivity,
    stackingBackgroundMeshSize,
    stackingDeblendNLevels,
    stackingDeblendMinContrast,
    stackingFilterFwhm,
    stackingDetectMinFwhm,
    stackingMaxFwhm,
    stackingMaxEllipticity,
    stackingDetectMinSharpness,
    stackingDetectMaxSharpness,
    stackingDetectPeakMax,
    stackingDetectSnrMin,
    stackingUseAnnotatedForAlignment,
    stackingRansacMaxIterations,
    stackingAlignmentInlierThreshold,
    setDefaultStackMethod,
    setDefaultSigmaValue,
    setDefaultAlignmentMode,
    setDefaultEnableQuality,
    setStackingDetectionProfile,
    setStackingDetectSigmaThreshold,
    setStackingDetectMaxStars,
    setStackingDetectMinArea,
    setStackingDetectMaxArea,
    setStackingDetectBorderMargin,
    setStackingDetectSigmaClipIters,
    setStackingDetectApplyMatchedFilter,
    setStackingDetectConnectivity,
    setStackingBackgroundMeshSize,
    setStackingDeblendNLevels,
    setStackingDeblendMinContrast,
    setStackingFilterFwhm,
    setStackingDetectMinFwhm,
    setStackingMaxFwhm,
    setStackingMaxEllipticity,
    setStackingDetectMinSharpness,
    setStackingDetectMaxSharpness,
    setStackingDetectPeakMax,
    setStackingDetectSnrMin,
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
      stackingDetectSigmaThreshold: s.stackingDetectSigmaThreshold,
      stackingDetectMaxStars: s.stackingDetectMaxStars,
      stackingDetectMinArea: s.stackingDetectMinArea,
      stackingDetectMaxArea: s.stackingDetectMaxArea,
      stackingDetectBorderMargin: s.stackingDetectBorderMargin,
      stackingDetectSigmaClipIters: s.stackingDetectSigmaClipIters,
      stackingDetectApplyMatchedFilter: s.stackingDetectApplyMatchedFilter,
      stackingDetectConnectivity: s.stackingDetectConnectivity,
      stackingBackgroundMeshSize: s.stackingBackgroundMeshSize,
      stackingDeblendNLevels: s.stackingDeblendNLevels,
      stackingDeblendMinContrast: s.stackingDeblendMinContrast,
      stackingFilterFwhm: s.stackingFilterFwhm,
      stackingDetectMinFwhm: s.stackingDetectMinFwhm,
      stackingMaxFwhm: s.stackingMaxFwhm,
      stackingMaxEllipticity: s.stackingMaxEllipticity,
      stackingDetectMinSharpness: s.stackingDetectMinSharpness,
      stackingDetectMaxSharpness: s.stackingDetectMaxSharpness,
      stackingDetectPeakMax: s.stackingDetectPeakMax,
      stackingDetectSnrMin: s.stackingDetectSnrMin,
      stackingUseAnnotatedForAlignment: s.stackingUseAnnotatedForAlignment,
      stackingRansacMaxIterations: s.stackingRansacMaxIterations,
      stackingAlignmentInlierThreshold: s.stackingAlignmentInlierThreshold,
      setDefaultStackMethod: s.setDefaultStackMethod,
      setDefaultSigmaValue: s.setDefaultSigmaValue,
      setDefaultAlignmentMode: s.setDefaultAlignmentMode,
      setDefaultEnableQuality: s.setDefaultEnableQuality,
      setStackingDetectionProfile: s.setStackingDetectionProfile,
      setStackingDetectSigmaThreshold: s.setStackingDetectSigmaThreshold,
      setStackingDetectMaxStars: s.setStackingDetectMaxStars,
      setStackingDetectMinArea: s.setStackingDetectMinArea,
      setStackingDetectMaxArea: s.setStackingDetectMaxArea,
      setStackingDetectBorderMargin: s.setStackingDetectBorderMargin,
      setStackingDetectSigmaClipIters: s.setStackingDetectSigmaClipIters,
      setStackingDetectApplyMatchedFilter: s.setStackingDetectApplyMatchedFilter,
      setStackingDetectConnectivity: s.setStackingDetectConnectivity,
      setStackingBackgroundMeshSize: s.setStackingBackgroundMeshSize,
      setStackingDeblendNLevels: s.setStackingDeblendNLevels,
      setStackingDeblendMinContrast: s.setStackingDeblendMinContrast,
      setStackingFilterFwhm: s.setStackingFilterFwhm,
      setStackingDetectMinFwhm: s.setStackingDetectMinFwhm,
      setStackingMaxFwhm: s.setStackingMaxFwhm,
      setStackingMaxEllipticity: s.setStackingMaxEllipticity,
      setStackingDetectMinSharpness: s.setStackingDetectMinSharpness,
      setStackingDetectMaxSharpness: s.setStackingDetectMaxSharpness,
      setStackingDetectPeakMax: s.setStackingDetectPeakMax,
      setStackingDetectSnrMin: s.setStackingDetectSnrMin,
      setStackingUseAnnotatedForAlignment: s.setStackingUseAnnotatedForAlignment,
      setStackingRansacMaxIterations: s.setStackingRansacMaxIterations,
      setStackingAlignmentInlierThreshold: s.setStackingAlignmentInlierThreshold,
      resetSection: s.resetSection,
    })),
  );

  const STACK_METHOD_I18N: Record<string, string> = {
    average: "editor.average",
    median: "editor.median",
    sigma: "editor.sigmaClip",
    min: "editor.min",
    max: "editor.max",
    winsorized: "editor.winsorized",
    weighted: "editor.weighted",
  };
  const stackMethodLabel = (value: (typeof STACK_METHOD_VALUES)[number]) =>
    t(STACK_METHOD_I18N[value] ?? value);

  const ALIGNMENT_MODE_I18N: Record<string, string> = {
    none: "editor.alignNone",
    translation: "editor.alignTranslation",
    full: "editor.alignFull",
  };
  const alignmentModeLabel = (value: (typeof ALIGNMENT_MODE_VALUES)[number]) =>
    t(ALIGNMENT_MODE_I18N[value] ?? value);

  const STACKING_DETECTION_PROFILE_I18N: Record<string, string> = {
    fast: "settings.stackingProfileFast",
    balanced: "settings.stackingProfileBalanced",
    accurate: "settings.stackingProfileAccurate",
  };
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
        <SettingsSliderRow
          icon="pulse-outline"
          label={t("settings.stackingDetectSigmaThreshold")}
          value={stackingDetectSigmaThreshold}
          min={1.0}
          max={10.0}
          step={0.1}
          onValueChange={setStackingDetectSigmaThreshold}
        />
        <Separator />
        <SettingsSliderRow
          icon="star-outline"
          label={t("settings.stackingDetectMaxStars")}
          value={stackingDetectMaxStars}
          min={50}
          max={800}
          step={10}
          onValueChange={setStackingDetectMaxStars}
        />
        <Separator />
        <SettingsSliderRow
          icon="scan-outline"
          label={t("settings.stackingDetectMinArea")}
          value={stackingDetectMinArea}
          min={1}
          max={20}
          step={1}
          onValueChange={setStackingDetectMinArea}
        />
        <Separator />
        <SettingsSliderRow
          icon="expand-outline"
          label={t("settings.stackingDetectMaxArea")}
          value={stackingDetectMaxArea}
          min={50}
          max={3000}
          step={10}
          onValueChange={setStackingDetectMaxArea}
        />
        <Separator />
        <SettingsSliderRow
          icon="crop-outline"
          label={t("settings.stackingDetectBorderMargin")}
          value={stackingDetectBorderMargin}
          min={0}
          max={64}
          step={1}
          onValueChange={setStackingDetectBorderMargin}
        />
        <Separator />
        <SettingsRow
          icon="git-network-outline"
          label={t("settings.stackingDetectSigmaClipIters")}
          value={`${stackingDetectSigmaClipIters}`}
        />
        <View className="px-2 pb-2">
          <SimpleSlider
            label=""
            value={stackingDetectSigmaClipIters}
            min={0}
            max={10}
            step={1}
            onValueChange={(v) => setStackingDetectSigmaClipIters(Math.round(v))}
          />
        </View>
        <Separator />
        <SettingsToggleRow
          icon="funnel-outline"
          label={t("settings.stackingDetectApplyMatchedFilter")}
          isSelected={stackingDetectApplyMatchedFilter}
          onSelectedChange={setStackingDetectApplyMatchedFilter}
        />
        <Separator />
        <SettingsRow
          icon="git-compare-outline"
          label={t("settings.stackingDetectConnectivity")}
          value={`${stackingDetectConnectivity}`}
        />
        <View className="px-2 pb-2">
          <View className="flex-row gap-2">
            <Chip
              size="sm"
              variant={stackingDetectConnectivity === 4 ? "primary" : "secondary"}
              onPress={() => setStackingDetectConnectivity(4)}
            >
              <Chip.Label className="text-[9px]">4</Chip.Label>
            </Chip>
            <Chip
              size="sm"
              variant={stackingDetectConnectivity === 8 ? "primary" : "secondary"}
              onPress={() => setStackingDetectConnectivity(8)}
            >
              <Chip.Label className="text-[9px]">8</Chip.Label>
            </Chip>
          </View>
        </View>
        <Separator />
        <SettingsSliderRow
          icon="grid-outline"
          label={t("settings.stackingBackgroundMeshSize")}
          value={stackingBackgroundMeshSize}
          min={16}
          max={256}
          step={8}
          onValueChange={setStackingBackgroundMeshSize}
        />
        <Separator />
        <SettingsSliderRow
          icon="git-branch-outline"
          label={t("settings.stackingDeblendNLevels")}
          value={stackingDeblendNLevels}
          min={1}
          max={32}
          step={1}
          onValueChange={setStackingDeblendNLevels}
        />
        <Separator />
        <SettingsSliderRow
          icon="options-outline"
          label={t("settings.stackingDeblendMinContrast")}
          value={stackingDeblendMinContrast}
          min={0.01}
          max={0.5}
          step={0.01}
          onValueChange={setStackingDeblendMinContrast}
        />
        <Separator />
        <SettingsSliderRow
          icon="funnel-outline"
          label={t("settings.stackingFilterFwhm")}
          value={stackingFilterFwhm}
          min={0.5}
          max={8}
          step={0.1}
          onValueChange={setStackingFilterFwhm}
        />
        <Separator />
        <SettingsRow
          icon="ellipse-outline"
          label={t("settings.stackingDetectMinFwhm")}
          value={stackingDetectMinFwhm.toFixed(1)}
        />
        <View className="px-2 pb-2">
          <SimpleSlider
            label=""
            value={stackingDetectMinFwhm}
            min={0.1}
            max={15}
            step={0.1}
            onValueChange={(v) => {
              setStackingDetectMinFwhm(v);
              if (v > stackingMaxFwhm) setStackingMaxFwhm(v);
            }}
          />
        </View>
        <Separator />
        <SettingsSliderRow
          icon="ellipse-outline"
          label={t("settings.stackingMaxFwhm")}
          value={stackingMaxFwhm}
          min={1}
          max={20}
          step={0.1}
          onValueChange={setStackingMaxFwhm}
        />
        <Separator />
        <SettingsSliderRow
          icon="radio-button-on-outline"
          label={t("settings.stackingMaxEllipticity")}
          value={stackingMaxEllipticity}
          min={0}
          max={1}
          step={0.01}
          onValueChange={setStackingMaxEllipticity}
        />
        <Separator />
        <SettingsRow
          icon="sparkles-outline"
          label={t("settings.stackingDetectMinSharpness")}
          value={stackingDetectMinSharpness.toFixed(2)}
        />
        <View className="px-2 pb-2">
          <SimpleSlider
            label=""
            value={stackingDetectMinSharpness}
            min={0}
            max={100}
            step={0.05}
            onValueChange={(v) => {
              setStackingDetectMinSharpness(v);
              if (v > stackingDetectMaxSharpness) setStackingDetectMaxSharpness(v);
            }}
          />
        </View>
        <Separator />
        <SettingsRow
          icon="sparkles-outline"
          label={t("settings.stackingDetectMaxSharpness")}
          value={stackingDetectMaxSharpness.toFixed(2)}
        />
        <View className="px-2 pb-2">
          <SimpleSlider
            label=""
            value={stackingDetectMaxSharpness}
            min={0}
            max={100}
            step={0.05}
            onValueChange={(v) => {
              setStackingDetectMaxSharpness(v);
              if (v < stackingDetectMinSharpness) setStackingDetectMinSharpness(v);
            }}
          />
        </View>
        <Separator />
        <SettingsSliderRow
          icon="analytics-outline"
          label={t("settings.stackingDetectPeakMax")}
          value={stackingDetectPeakMax}
          format={(v) => `${Math.round(v)}`}
          min={0}
          max={10000}
          step={10}
          onValueChange={setStackingDetectPeakMax}
        />
        <Separator />
        <SettingsSliderRow
          icon="speedometer-outline"
          label={t("settings.stackingDetectSnrMin")}
          value={stackingDetectSnrMin}
          min={0}
          max={50}
          step={0.1}
          onValueChange={setStackingDetectSnrMin}
        />
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
