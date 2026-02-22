import { View } from "react-native";
import { Chip, Separator } from "heroui-native";
import { SettingsToggleRow } from "../../common/SettingsToggleRow";
import { useI18n } from "../../../i18n/useI18n";
import { useHapticFeedback } from "../../../hooks/useHapticFeedback";
import { useSettingsStore } from "../../../stores/useSettingsStore";
import { SettingsSection } from "../SettingsSection";
import { SettingsRow } from "../../common/SettingsRow";
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

  const defaultStackMethod = useSettingsStore((s) => s.defaultStackMethod);
  const defaultSigmaValue = useSettingsStore((s) => s.defaultSigmaValue);
  const defaultAlignmentMode = useSettingsStore((s) => s.defaultAlignmentMode);
  const defaultEnableQuality = useSettingsStore((s) => s.defaultEnableQuality);
  const stackingDetectionProfile = useSettingsStore((s) => s.stackingDetectionProfile);
  const stackingDetectSigmaThreshold = useSettingsStore((s) => s.stackingDetectSigmaThreshold);
  const stackingDetectMaxStars = useSettingsStore((s) => s.stackingDetectMaxStars);
  const stackingDetectMinArea = useSettingsStore((s) => s.stackingDetectMinArea);
  const stackingDetectMaxArea = useSettingsStore((s) => s.stackingDetectMaxArea);
  const stackingDetectBorderMargin = useSettingsStore((s) => s.stackingDetectBorderMargin);
  const stackingDetectSigmaClipIters = useSettingsStore((s) => s.stackingDetectSigmaClipIters);
  const stackingDetectApplyMatchedFilter = useSettingsStore(
    (s) => s.stackingDetectApplyMatchedFilter,
  );
  const stackingDetectConnectivity = useSettingsStore((s) => s.stackingDetectConnectivity);
  const stackingBackgroundMeshSize = useSettingsStore((s) => s.stackingBackgroundMeshSize);
  const stackingDeblendNLevels = useSettingsStore((s) => s.stackingDeblendNLevels);
  const stackingDeblendMinContrast = useSettingsStore((s) => s.stackingDeblendMinContrast);
  const stackingFilterFwhm = useSettingsStore((s) => s.stackingFilterFwhm);
  const stackingDetectMinFwhm = useSettingsStore((s) => s.stackingDetectMinFwhm);
  const stackingMaxFwhm = useSettingsStore((s) => s.stackingMaxFwhm);
  const stackingMaxEllipticity = useSettingsStore((s) => s.stackingMaxEllipticity);
  const stackingDetectMinSharpness = useSettingsStore((s) => s.stackingDetectMinSharpness);
  const stackingDetectMaxSharpness = useSettingsStore((s) => s.stackingDetectMaxSharpness);
  const stackingDetectPeakMax = useSettingsStore((s) => s.stackingDetectPeakMax);
  const stackingDetectSnrMin = useSettingsStore((s) => s.stackingDetectSnrMin);
  const stackingUseAnnotatedForAlignment = useSettingsStore(
    (s) => s.stackingUseAnnotatedForAlignment,
  );
  const stackingRansacMaxIterations = useSettingsStore((s) => s.stackingRansacMaxIterations);
  const stackingAlignmentInlierThreshold = useSettingsStore(
    (s) => s.stackingAlignmentInlierThreshold,
  );
  const setDefaultStackMethod = useSettingsStore((s) => s.setDefaultStackMethod);
  const setDefaultSigmaValue = useSettingsStore((s) => s.setDefaultSigmaValue);
  const setDefaultAlignmentMode = useSettingsStore((s) => s.setDefaultAlignmentMode);
  const setDefaultEnableQuality = useSettingsStore((s) => s.setDefaultEnableQuality);
  const setStackingDetectionProfile = useSettingsStore((s) => s.setStackingDetectionProfile);
  const setStackingDetectSigmaThreshold = useSettingsStore(
    (s) => s.setStackingDetectSigmaThreshold,
  );
  const setStackingDetectMaxStars = useSettingsStore((s) => s.setStackingDetectMaxStars);
  const setStackingDetectMinArea = useSettingsStore((s) => s.setStackingDetectMinArea);
  const setStackingDetectMaxArea = useSettingsStore((s) => s.setStackingDetectMaxArea);
  const setStackingDetectBorderMargin = useSettingsStore((s) => s.setStackingDetectBorderMargin);
  const setStackingDetectSigmaClipIters = useSettingsStore(
    (s) => s.setStackingDetectSigmaClipIters,
  );
  const setStackingDetectApplyMatchedFilter = useSettingsStore(
    (s) => s.setStackingDetectApplyMatchedFilter,
  );
  const setStackingDetectConnectivity = useSettingsStore((s) => s.setStackingDetectConnectivity);
  const setStackingBackgroundMeshSize = useSettingsStore((s) => s.setStackingBackgroundMeshSize);
  const setStackingDeblendNLevels = useSettingsStore((s) => s.setStackingDeblendNLevels);
  const setStackingDeblendMinContrast = useSettingsStore((s) => s.setStackingDeblendMinContrast);
  const setStackingFilterFwhm = useSettingsStore((s) => s.setStackingFilterFwhm);
  const setStackingDetectMinFwhm = useSettingsStore((s) => s.setStackingDetectMinFwhm);
  const setStackingMaxFwhm = useSettingsStore((s) => s.setStackingMaxFwhm);
  const setStackingMaxEllipticity = useSettingsStore((s) => s.setStackingMaxEllipticity);
  const setStackingDetectMinSharpness = useSettingsStore((s) => s.setStackingDetectMinSharpness);
  const setStackingDetectMaxSharpness = useSettingsStore((s) => s.setStackingDetectMaxSharpness);
  const setStackingDetectPeakMax = useSettingsStore((s) => s.setStackingDetectPeakMax);
  const setStackingDetectSnrMin = useSettingsStore((s) => s.setStackingDetectSnrMin);
  const setStackingUseAnnotatedForAlignment = useSettingsStore(
    (s) => s.setStackingUseAnnotatedForAlignment,
  );
  const setStackingRansacMaxIterations = useSettingsStore((s) => s.setStackingRansacMaxIterations);
  const setStackingAlignmentInlierThreshold = useSettingsStore(
    (s) => s.setStackingAlignmentInlierThreshold,
  );
  const resetSection = useSettingsStore((s) => s.resetSection);

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

  const stackingDetectionProfileLabel = (
    value: (typeof STACKING_DETECTION_PROFILE_VALUES)[number],
  ) =>
    t(
      value === "fast"
        ? "settings.stackingProfileFast"
        : value === "accurate"
          ? "settings.stackingProfileAccurate"
          : "settings.stackingProfileBalanced",
    );

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
        <SettingsRow
          icon="pulse-outline"
          label={t("settings.stackingDetectSigmaThreshold")}
          value={stackingDetectSigmaThreshold.toFixed(1)}
        />
        <View className="px-2 pb-2">
          <SimpleSlider
            label=""
            value={stackingDetectSigmaThreshold}
            min={1.0}
            max={10.0}
            step={0.1}
            onValueChange={setStackingDetectSigmaThreshold}
          />
        </View>
        <Separator />
        <SettingsRow
          icon="star-outline"
          label={t("settings.stackingDetectMaxStars")}
          value={`${stackingDetectMaxStars}`}
        />
        <View className="px-2 pb-2">
          <SimpleSlider
            label=""
            value={stackingDetectMaxStars}
            min={50}
            max={800}
            step={10}
            onValueChange={setStackingDetectMaxStars}
          />
        </View>
        <Separator />
        <SettingsRow
          icon="scan-outline"
          label={t("settings.stackingDetectMinArea")}
          value={`${stackingDetectMinArea}`}
        />
        <View className="px-2 pb-2">
          <SimpleSlider
            label=""
            value={stackingDetectMinArea}
            min={1}
            max={20}
            step={1}
            onValueChange={setStackingDetectMinArea}
          />
        </View>
        <Separator />
        <SettingsRow
          icon="expand-outline"
          label={t("settings.stackingDetectMaxArea")}
          value={`${stackingDetectMaxArea}`}
        />
        <View className="px-2 pb-2">
          <SimpleSlider
            label=""
            value={stackingDetectMaxArea}
            min={50}
            max={3000}
            step={10}
            onValueChange={setStackingDetectMaxArea}
          />
        </View>
        <Separator />
        <SettingsRow
          icon="crop-outline"
          label={t("settings.stackingDetectBorderMargin")}
          value={`${stackingDetectBorderMargin}`}
        />
        <View className="px-2 pb-2">
          <SimpleSlider
            label=""
            value={stackingDetectBorderMargin}
            min={0}
            max={64}
            step={1}
            onValueChange={setStackingDetectBorderMargin}
          />
        </View>
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
        <SettingsRow
          icon="grid-outline"
          label={t("settings.stackingBackgroundMeshSize")}
          value={`${stackingBackgroundMeshSize}`}
        />
        <View className="px-2 pb-2">
          <SimpleSlider
            label=""
            value={stackingBackgroundMeshSize}
            min={16}
            max={256}
            step={8}
            onValueChange={setStackingBackgroundMeshSize}
          />
        </View>
        <Separator />
        <SettingsRow
          icon="git-branch-outline"
          label={t("settings.stackingDeblendNLevels")}
          value={`${stackingDeblendNLevels}`}
        />
        <View className="px-2 pb-2">
          <SimpleSlider
            label=""
            value={stackingDeblendNLevels}
            min={1}
            max={32}
            step={1}
            onValueChange={setStackingDeblendNLevels}
          />
        </View>
        <Separator />
        <SettingsRow
          icon="options-outline"
          label={t("settings.stackingDeblendMinContrast")}
          value={stackingDeblendMinContrast.toFixed(2)}
        />
        <View className="px-2 pb-2">
          <SimpleSlider
            label=""
            value={stackingDeblendMinContrast}
            min={0.01}
            max={0.5}
            step={0.01}
            onValueChange={setStackingDeblendMinContrast}
          />
        </View>
        <Separator />
        <SettingsRow
          icon="funnel-outline"
          label={t("settings.stackingFilterFwhm")}
          value={stackingFilterFwhm.toFixed(1)}
        />
        <View className="px-2 pb-2">
          <SimpleSlider
            label=""
            value={stackingFilterFwhm}
            min={0.5}
            max={8}
            step={0.1}
            onValueChange={setStackingFilterFwhm}
          />
        </View>
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
        <SettingsRow
          icon="ellipse-outline"
          label={t("settings.stackingMaxFwhm")}
          value={stackingMaxFwhm.toFixed(1)}
        />
        <View className="px-2 pb-2">
          <SimpleSlider
            label=""
            value={stackingMaxFwhm}
            min={1}
            max={20}
            step={0.1}
            onValueChange={setStackingMaxFwhm}
          />
        </View>
        <Separator />
        <SettingsRow
          icon="radio-button-on-outline"
          label={t("settings.stackingMaxEllipticity")}
          value={stackingMaxEllipticity.toFixed(2)}
        />
        <View className="px-2 pb-2">
          <SimpleSlider
            label=""
            value={stackingMaxEllipticity}
            min={0}
            max={1}
            step={0.01}
            onValueChange={setStackingMaxEllipticity}
          />
        </View>
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
        <SettingsRow
          icon="analytics-outline"
          label={t("settings.stackingDetectPeakMax")}
          value={`${Math.round(stackingDetectPeakMax)}`}
        />
        <View className="px-2 pb-2">
          <SimpleSlider
            label=""
            value={stackingDetectPeakMax}
            min={0}
            max={10000}
            step={10}
            onValueChange={setStackingDetectPeakMax}
          />
        </View>
        <Separator />
        <SettingsRow
          icon="speedometer-outline"
          label={t("settings.stackingDetectSnrMin")}
          value={stackingDetectSnrMin.toFixed(1)}
        />
        <View className="px-2 pb-2">
          <SimpleSlider
            label=""
            value={stackingDetectSnrMin}
            min={0}
            max={50}
            step={0.1}
            onValueChange={setStackingDetectSnrMin}
          />
        </View>
        <Separator />
        <SettingsRow
          icon="repeat-outline"
          label={t("settings.stackingRansacMaxIterations")}
          value={`${stackingRansacMaxIterations}`}
        />
        <View className="px-2 pb-2">
          <SimpleSlider
            label=""
            value={stackingRansacMaxIterations}
            min={20}
            max={400}
            step={10}
            onValueChange={setStackingRansacMaxIterations}
          />
        </View>
        <Separator />
        <SettingsRow
          icon="resize-outline"
          label={t("settings.stackingAlignmentInlierThreshold")}
          value={stackingAlignmentInlierThreshold.toFixed(1)}
        />
        <View className="px-2 pb-2">
          <SimpleSlider
            label=""
            value={stackingAlignmentInlierThreshold}
            min={0.5}
            max={10}
            step={0.1}
            onValueChange={setStackingAlignmentInlierThreshold}
          />
        </View>
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
