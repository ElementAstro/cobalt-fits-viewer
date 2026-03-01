import { View } from "react-native";
import { Chip, Separator } from "heroui-native";
import { useShallow } from "zustand/react/shallow";
import { SettingsToggleRow } from "../../common/SettingsToggleRow";
import { useI18n } from "../../../i18n/useI18n";
import { useSettingsStore } from "../../../stores/useSettingsStore";
import { SettingsRow } from "../../common/SettingsRow";
import { SettingsSliderRow } from "../../common/SettingsSliderRow";
import { SimpleSlider } from "../../common/SimpleSlider";

export function StackingDetectionRows() {
  const { t } = useI18n();

  const {
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
  } = useSettingsStore(
    useShallow((s) => ({
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
    })),
  );

  return (
    <>
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
    </>
  );
}
