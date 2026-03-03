import React from "react";
import { View, Text, TextInput } from "react-native";
import { Button, useThemeColor } from "heroui-native";
import { useI18n } from "../../../i18n/useI18n";
import { SimpleSlider } from "../../common/SimpleSlider";
import type { EditorTool, EditorToolParams } from "../../../hooks/useEditorToolState";

const MORPH_OP_KEYS: Record<EditorToolParams["morphOp"], string> = {
  erode: "editor.paramMorphErode",
  dilate: "editor.paramMorphDilate",
  open: "editor.paramMorphOpen",
  close: "editor.paramMorphClose",
};

const INTEGER_BIN_MODE_KEYS: Record<EditorToolParams["integerBinMode"], string> = {
  average: "editor.paramAverage",
  sum: "editor.paramSum",
  median: "editor.paramMedian",
};

const RESAMPLE_METHOD_KEYS: Record<EditorToolParams["resampleMethod"], string> = {
  bilinear: "editor.paramBilinear",
  bicubic: "editor.paramBicubic",
  lanczos3: "editor.paramLanczos3",
};

interface ToolParamsProcessProps {
  activeTool: EditorTool & string;
  params: EditorToolParams;
  onParamChange?: () => void;
}

export const ToolParamsProcess = React.memo(function ToolParamsProcess({
  activeTool,
  params,
  onParamChange,
}: ToolParamsProcessProps) {
  const { t } = useI18n();
  const [mutedColor] = useThemeColor(["muted"]);
  const setAndPreview = <T,>(setter: (value: T) => void, value: T) => {
    setter(value);
    onParamChange?.();
  };

  switch (activeTool) {
    case "clahe":
      return (
        <View>
          <SimpleSlider
            label={t("editor.paramTileSize")}
            value={params.claheTileSize}
            min={4}
            max={16}
            step={1}
            defaultValue={8}
            onValueChange={(v) => setAndPreview(params.setClaheTileSize, Math.round(v))}
          />
          <SimpleSlider
            label={t("editor.paramClipLimit")}
            value={params.claheClipLimit}
            min={1.0}
            max={10.0}
            step={0.5}
            defaultValue={3.0}
            onValueChange={(v) => setAndPreview(params.setClaheClipLimit, v)}
          />
          <SimpleSlider
            label={t("editor.paramAmount")}
            value={params.claheAmount}
            min={0}
            max={1}
            step={0.05}
            defaultValue={1}
            onValueChange={(v) => setAndPreview(params.setClaheAmount, v)}
          />
        </View>
      );

    case "hdr":
      return (
        <View>
          <SimpleSlider
            label={t("editor.paramLayers")}
            value={params.hdrLayers}
            min={3}
            max={8}
            step={1}
            defaultValue={5}
            onValueChange={(v) => setAndPreview(params.setHdrLayers, Math.round(v))}
          />
          <SimpleSlider
            label={t("editor.paramAmount")}
            value={params.hdrAmount}
            min={0}
            max={1}
            step={0.05}
            defaultValue={0.7}
            onValueChange={(v) => setAndPreview(params.setHdrAmount, v)}
          />
        </View>
      );

    case "morphology":
      return (
        <View>
          <View className="flex-row gap-1 mb-2">
            {(["erode", "dilate", "open", "close"] as const).map((op) => (
              <Button
                key={op}
                size="sm"
                variant={params.morphOp === op ? "primary" : "outline"}
                onPress={() => setAndPreview(params.setMorphOp, op)}
              >
                <Button.Label className="text-[9px]">{t(MORPH_OP_KEYS[op])}</Button.Label>
              </Button>
            ))}
          </View>
          <SimpleSlider
            label={t("editor.paramRadius")}
            value={params.morphRadius}
            min={1}
            max={5}
            step={1}
            defaultValue={1}
            onValueChange={(v) => setAndPreview(params.setMorphRadius, Math.round(v))}
          />
        </View>
      );

    case "deconvolution":
      return (
        <View>
          <SimpleSlider
            label={t("editor.paramPsfSigma")}
            value={params.deconvPsfSigma}
            min={0.5}
            max={5}
            step={0.1}
            defaultValue={2.0}
            onValueChange={(v) => setAndPreview(params.setDeconvPsfSigma, v)}
          />
          <SimpleSlider
            label={t("editor.paramIterations")}
            value={params.deconvIterations}
            min={5}
            max={80}
            step={1}
            defaultValue={20}
            onValueChange={(v) => setAndPreview(params.setDeconvIterations, Math.round(v))}
          />
          <SimpleSlider
            label={t("editor.paramRegularization")}
            value={params.deconvRegularization}
            min={0}
            max={1}
            step={0.05}
            defaultValue={0.1}
            onValueChange={(v) => setAndPreview(params.setDeconvRegularization, v)}
          />
        </View>
      );

    case "dbe":
      return (
        <View>
          <SimpleSlider
            label={t("editor.paramSamplesX")}
            value={params.dbeSamplesX}
            min={4}
            max={24}
            step={1}
            defaultValue={12}
            onValueChange={(v) => setAndPreview(params.setDbeSamplesX, Math.round(v))}
          />
          <SimpleSlider
            label={t("editor.paramSamplesY")}
            value={params.dbeSamplesY}
            min={4}
            max={16}
            step={1}
            defaultValue={8}
            onValueChange={(v) => setAndPreview(params.setDbeSamplesY, Math.round(v))}
          />
          <SimpleSlider
            label={t("editor.paramSigma")}
            value={params.dbeSigma}
            min={1}
            max={5}
            step={0.1}
            defaultValue={2.5}
            onValueChange={(v) => setAndPreview(params.setDbeSigma, v)}
          />
        </View>
      );

    case "multiscaleDenoise":
      return (
        <View>
          <SimpleSlider
            label={t("editor.paramLayers")}
            value={params.multiscaleLayers}
            min={1}
            max={8}
            step={1}
            defaultValue={4}
            onValueChange={(v) => setAndPreview(params.setMultiscaleLayers, Math.round(v))}
          />
          <SimpleSlider
            label={t("editor.paramThreshold")}
            value={params.multiscaleThreshold}
            min={0.5}
            max={6}
            step={0.1}
            defaultValue={2.5}
            onValueChange={(v) => setAndPreview(params.setMultiscaleThreshold, v)}
          />
        </View>
      );

    case "localContrast":
      return (
        <View>
          <SimpleSlider
            label={t("editor.paramSigma")}
            value={params.localContrastSigma}
            min={1}
            max={20}
            step={0.5}
            defaultValue={8}
            onValueChange={(v) => setAndPreview(params.setLocalContrastSigma, v)}
          />
          <SimpleSlider
            label={t("editor.paramAmount")}
            value={params.localContrastAmount}
            min={0}
            max={1}
            step={0.05}
            defaultValue={0.35}
            onValueChange={(v) => setAndPreview(params.setLocalContrastAmount, v)}
          />
        </View>
      );

    case "starReduction":
      return (
        <View>
          <SimpleSlider
            label={t("editor.paramScale")}
            value={params.starReductionScale}
            min={0.5}
            max={4}
            step={0.1}
            defaultValue={1.2}
            onValueChange={(v) => setAndPreview(params.setStarReductionScale, v)}
          />
          <SimpleSlider
            label={t("editor.paramStrength")}
            value={params.starReductionStrength}
            min={0}
            max={1}
            step={0.05}
            defaultValue={0.6}
            onValueChange={(v) => setAndPreview(params.setStarReductionStrength, v)}
          />
        </View>
      );

    case "deconvolutionAuto":
      return (
        <View>
          <SimpleSlider
            label={t("editor.paramIterations")}
            value={params.deconvAutoIterations}
            min={5}
            max={80}
            step={1}
            defaultValue={20}
            onValueChange={(v) => setAndPreview(params.setDeconvAutoIterations, Math.round(v))}
          />
          <SimpleSlider
            label={t("editor.paramRegularization")}
            value={params.deconvAutoRegularization}
            min={0}
            max={1}
            step={0.05}
            defaultValue={0.1}
            onValueChange={(v) => setAndPreview(params.setDeconvAutoRegularization, v)}
          />
        </View>
      );

    case "cosmeticCorrection":
      return (
        <View>
          <SimpleSlider
            label={t("editor.paramHotSigma")}
            value={params.cosmeticHotSigma}
            min={2}
            max={10}
            step={0.5}
            defaultValue={5}
            onValueChange={(v) => setAndPreview(params.setCosmeticHotSigma, v)}
          />
          <SimpleSlider
            label={t("editor.paramColdSigma")}
            value={params.cosmeticColdSigma}
            min={2}
            max={10}
            step={0.5}
            defaultValue={5}
            onValueChange={(v) => setAndPreview(params.setCosmeticColdSigma, v)}
          />
          <View className="flex-row gap-2 mt-1">
            <Button
              size="sm"
              variant={params.cosmeticUseMedian ? "primary" : "outline"}
              onPress={() => setAndPreview(params.setCosmeticUseMedian, !params.cosmeticUseMedian)}
            >
              <Button.Label className="text-[9px]">{t("editor.paramUseMedian")}</Button.Label>
            </Button>
          </View>
        </View>
      );

    case "mmt":
      return (
        <View>
          <SimpleSlider
            label={t("editor.paramLayers")}
            value={params.mmtLayers}
            min={1}
            max={8}
            step={1}
            defaultValue={4}
            onValueChange={(v) => setAndPreview(params.setMmtLayers, Math.round(v))}
          />
          <SimpleSlider
            label={t("editor.paramNoiseThreshold")}
            value={params.mmtNoiseThreshold}
            min={0.5}
            max={10}
            step={0.5}
            defaultValue={3}
            onValueChange={(v) => setAndPreview(params.setMmtNoiseThreshold, v)}
          />
          <SimpleSlider
            label={t("editor.paramNoiseReduction")}
            value={params.mmtNoiseReduction}
            min={0}
            max={1}
            step={0.05}
            defaultValue={0.5}
            onValueChange={(v) => setAndPreview(params.setMmtNoiseReduction, v)}
          />
          <SimpleSlider
            label={t("editor.paramBias")}
            value={params.mmtBias}
            min={-1}
            max={1}
            step={0.05}
            defaultValue={0}
            onValueChange={(v) => setAndPreview(params.setMmtBias, v)}
          />
        </View>
      );

    case "integerBin":
      return (
        <View>
          <SimpleSlider
            label={t("editor.paramBinFactor")}
            value={params.integerBinFactor}
            min={2}
            max={4}
            step={1}
            defaultValue={2}
            onValueChange={(v) => setAndPreview(params.setIntegerBinFactor, Math.round(v))}
          />
          <View className="flex-row gap-2 mt-1 flex-wrap">
            {(["average", "sum", "median"] as const).map((mode) => (
              <Button
                key={mode}
                size="sm"
                variant={params.integerBinMode === mode ? "primary" : "outline"}
                onPress={() => setAndPreview(params.setIntegerBinMode, mode)}
              >
                <Button.Label className="text-[9px]">{t(INTEGER_BIN_MODE_KEYS[mode])}</Button.Label>
              </Button>
            ))}
          </View>
        </View>
      );

    case "resample":
      return (
        <View>
          <SimpleSlider
            label={t("editor.paramScale")}
            value={params.resampleTargetScale}
            min={0.25}
            max={4}
            step={0.25}
            defaultValue={1}
            onValueChange={(v) => setAndPreview(params.setResampleTargetScale, v)}
          />
          <View className="flex-row gap-2 mt-1 flex-wrap">
            {(["bilinear", "bicubic", "lanczos3"] as const).map((method) => (
              <Button
                key={method}
                size="sm"
                variant={params.resampleMethod === method ? "primary" : "outline"}
                onPress={() => setAndPreview(params.setResampleMethod, method)}
              >
                <Button.Label className="text-[9px]">
                  {t(RESAMPLE_METHOD_KEYS[method])}
                </Button.Label>
              </Button>
            ))}
          </View>
        </View>
      );

    case "scnr":
      return (
        <View>
          <SimpleSlider
            label={t("editor.paramAmount")}
            value={params.scnrAmount}
            min={0}
            max={1}
            step={0.05}
            defaultValue={0.5}
            onValueChange={(v) => setAndPreview(params.setScnrAmount, v)}
          />
          <View className="flex-row gap-2 mt-1">
            <Button
              size="sm"
              variant={params.scnrMethod === "averageNeutral" ? "primary" : "outline"}
              onPress={() => setAndPreview(params.setScnrMethod, "averageNeutral")}
            >
              <Button.Label className="text-[9px]">{t("editor.paramAverage")}</Button.Label>
            </Button>
            <Button
              size="sm"
              variant={params.scnrMethod === "maximumNeutral" ? "primary" : "outline"}
              onPress={() => setAndPreview(params.setScnrMethod, "maximumNeutral")}
            >
              <Button.Label className="text-[9px]">{t("editor.paramMaximum")}</Button.Label>
            </Button>
          </View>
        </View>
      );

    case "colorCalibration":
      return (
        <SimpleSlider
          label={t("editor.paramRefPercentile")}
          value={params.colorCalibrationPercentile}
          min={0.5}
          max={0.99}
          step={0.01}
          defaultValue={0.92}
          onValueChange={(v) => setAndPreview(params.setColorCalibrationPercentile, v)}
        />
      );

    case "backgroundNeutralize":
      return (
        <View>
          <SimpleSlider
            label={t("editor.paramUpperLimit")}
            value={params.backgroundNeutralizeUpperLimit}
            min={0.05}
            max={0.5}
            step={0.01}
            defaultValue={0.2}
            onValueChange={(v) => setAndPreview(params.setBackgroundNeutralizeUpperLimit, v)}
          />
          <SimpleSlider
            label={t("editor.paramShadowsClip")}
            value={params.backgroundNeutralizeShadowsClip}
            min={0}
            max={0.1}
            step={0.005}
            defaultValue={0.01}
            onValueChange={(v) => setAndPreview(params.setBackgroundNeutralizeShadowsClip, v)}
          />
        </View>
      );

    case "photometricCC":
      return (
        <View>
          <SimpleSlider
            label={t("editor.paramMinStars")}
            value={params.photometricMinStars}
            min={5}
            max={100}
            step={5}
            defaultValue={20}
            onValueChange={(v) => setAndPreview(params.setPhotometricMinStars, Math.round(v))}
          />
          <SimpleSlider
            label={t("editor.paramLowPercentile")}
            value={params.photometricPercentileLow}
            min={0}
            max={0.5}
            step={0.05}
            defaultValue={0.25}
            onValueChange={(v) => setAndPreview(params.setPhotometricPercentileLow, v)}
          />
          <SimpleSlider
            label={t("editor.paramHighPercentile")}
            value={params.photometricPercentileHigh}
            min={0.5}
            max={1}
            step={0.05}
            defaultValue={0.75}
            onValueChange={(v) => setAndPreview(params.setPhotometricPercentileHigh, v)}
          />
        </View>
      );

    case "perHueSaturation":
      return (
        <SimpleSlider
          label={t("editor.paramAmount")}
          value={params.perHueSaturationAmount}
          min={0}
          max={3}
          step={0.05}
          defaultValue={1}
          onValueChange={(v) => setAndPreview(params.setPerHueSaturationAmount, v)}
        />
      );

    case "selectiveColor":
      return (
        <View>
          <SimpleSlider
            label={t("editor.paramTargetHue")}
            value={params.selectiveColorTargetHue}
            min={0}
            max={360}
            step={5}
            defaultValue={120}
            onValueChange={(v) => setAndPreview(params.setSelectiveColorTargetHue, v)}
          />
          <SimpleSlider
            label={t("editor.paramHueRange")}
            value={params.selectiveColorHueRange}
            min={10}
            max={180}
            step={5}
            defaultValue={60}
            onValueChange={(v) => setAndPreview(params.setSelectiveColorHueRange, v)}
          />
          <SimpleSlider
            label={t("editor.paramHueShift")}
            value={params.selectiveColorHueShift}
            min={-180}
            max={180}
            step={5}
            defaultValue={0}
            onValueChange={(v) => setAndPreview(params.setSelectiveColorHueShift, v)}
          />
          <SimpleSlider
            label={t("editor.paramSaturationShift")}
            value={params.selectiveColorSatShift}
            min={-1}
            max={1}
            step={0.05}
            defaultValue={0}
            onValueChange={(v) => setAndPreview(params.setSelectiveColorSatShift, v)}
          />
          <SimpleSlider
            label={t("editor.paramLuminanceShift")}
            value={params.selectiveColorLumShift}
            min={-1}
            max={1}
            step={0.05}
            defaultValue={0}
            onValueChange={(v) => setAndPreview(params.setSelectiveColorLumShift, v)}
          />
          <SimpleSlider
            label={t("editor.paramFeather")}
            value={params.selectiveColorFeather}
            min={0}
            max={1}
            step={0.05}
            defaultValue={0.3}
            onValueChange={(v) => setAndPreview(params.setSelectiveColorFeather, v)}
          />
        </View>
      );

    case "saturation":
      return (
        <SimpleSlider
          label={t("editor.paramAmount")}
          value={params.saturationAmount}
          min={-1}
          max={2}
          step={0.05}
          defaultValue={0}
          onValueChange={(v) => setAndPreview(params.setSaturationAmount, v)}
        />
      );

    case "colorBalance":
      return (
        <View>
          <SimpleSlider
            label={t("editor.paramRedGain")}
            value={params.colorBalanceRedGain}
            min={0}
            max={4}
            step={0.05}
            defaultValue={1}
            onValueChange={(v) => setAndPreview(params.setColorBalanceRedGain, v)}
          />
          <SimpleSlider
            label={t("editor.paramGreenGain")}
            value={params.colorBalanceGreenGain}
            min={0}
            max={4}
            step={0.05}
            defaultValue={1}
            onValueChange={(v) => setAndPreview(params.setColorBalanceGreenGain, v)}
          />
          <SimpleSlider
            label={t("editor.paramBlueGain")}
            value={params.colorBalanceBlueGain}
            min={0}
            max={4}
            step={0.05}
            defaultValue={1}
            onValueChange={(v) => setAndPreview(params.setColorBalanceBlueGain, v)}
          />
        </View>
      );

    case "pixelMath":
      return (
        <View>
          <Text className="text-[9px] text-muted mb-1">{t("editor.paramPixelMathVars")}</Text>
          <TextInput
            className="h-8 px-2 text-xs text-foreground bg-background rounded border border-separator"
            value={params.pixelMathExpr}
            onChangeText={(v) => setAndPreview(params.setPixelMathExpr, v)}
            placeholder="($T - $min) / ($max - $min)"
            placeholderTextColor={mutedColor}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      );

    case "waveletSharpen":
      return (
        <View>
          <SimpleSlider
            label={t("editor.paramLayers")}
            value={params.waveletSharpenLayers}
            min={1}
            max={6}
            step={1}
            defaultValue={3}
            onValueChange={(v) => setAndPreview(params.setWaveletSharpenLayers, Math.round(v))}
          />
          <SimpleSlider
            label={t("editor.paramAmount")}
            value={params.waveletSharpenAmount}
            min={0}
            max={3}
            step={0.1}
            defaultValue={1.5}
            onValueChange={(v) => setAndPreview(params.setWaveletSharpenAmount, v)}
          />
          <View className="flex-row gap-2 mt-1">
            <Button
              size="sm"
              variant={params.waveletSharpenProtectStars ? "primary" : "outline"}
              onPress={() =>
                setAndPreview(
                  params.setWaveletSharpenProtectStars,
                  !params.waveletSharpenProtectStars,
                )
              }
            >
              <Button.Label className="text-[9px]">{t("editor.paramProtectStars")}</Button.Label>
            </Button>
          </View>
        </View>
      );

    case "tgvDenoise":
      return (
        <View>
          <SimpleSlider
            label={t("editor.paramStrength")}
            value={params.tgvStrength}
            min={0.1}
            max={10}
            step={0.1}
            defaultValue={2}
            onValueChange={(v) => setAndPreview(params.setTgvStrength, v)}
          />
          <SimpleSlider
            label={t("editor.paramSmoothness")}
            value={params.tgvSmoothness}
            min={1}
            max={5}
            step={0.5}
            defaultValue={2}
            onValueChange={(v) => setAndPreview(params.setTgvSmoothness, v)}
          />
          <SimpleSlider
            label={t("editor.paramIterations")}
            value={params.tgvIterations}
            min={50}
            max={500}
            step={10}
            defaultValue={200}
            onValueChange={(v) => setAndPreview(params.setTgvIterations, Math.round(v))}
          />
          <SimpleSlider
            label={t("editor.paramEdgeProtection")}
            value={params.tgvEdgeProtection}
            min={0}
            max={1}
            step={0.05}
            defaultValue={0.5}
            onValueChange={(v) => setAndPreview(params.setTgvEdgeProtection, v)}
          />
        </View>
      );

    case "bilateralFilter":
      return (
        <View>
          <SimpleSlider
            label={t("editor.paramSpatialSigma")}
            value={params.bilateralSpatialSigma}
            min={0.5}
            max={10}
            step={0.5}
            defaultValue={2}
            onValueChange={(v) => setAndPreview(params.setBilateralSpatialSigma, v)}
          />
          <SimpleSlider
            label={t("editor.paramRangeSigmaLabel")}
            value={params.bilateralRangeSigma}
            min={0.01}
            max={0.5}
            step={0.01}
            defaultValue={0.1}
            onValueChange={(v) => setAndPreview(params.setBilateralRangeSigma, v)}
          />
        </View>
      );

    case "wienerDeconvolution":
      return (
        <View>
          <SimpleSlider
            label={t("editor.paramPsfSigma")}
            value={params.wienerPsfSigma}
            min={0.5}
            max={10}
            step={0.1}
            defaultValue={2}
            onValueChange={(v) => setAndPreview(params.setWienerPsfSigma, v)}
          />
          <SimpleSlider
            label={t("editor.paramNoiseRatio")}
            value={params.wienerNoiseRatio}
            min={0.001}
            max={0.5}
            step={0.001}
            defaultValue={0.01}
            onValueChange={(v) => setAndPreview(params.setWienerNoiseRatio, v)}
          />
        </View>
      );

    case "mlt":
      return (
        <View>
          <SimpleSlider
            label={t("editor.paramLayers")}
            value={params.mltLayers}
            min={1}
            max={8}
            step={1}
            defaultValue={4}
            onValueChange={(v) => setAndPreview(params.setMltLayers, Math.round(v))}
          />
          <SimpleSlider
            label={t("editor.paramNoiseThreshold")}
            value={params.mltNoiseThreshold}
            min={0.5}
            max={10}
            step={0.5}
            defaultValue={3}
            onValueChange={(v) => setAndPreview(params.setMltNoiseThreshold, v)}
          />
          <SimpleSlider
            label={t("editor.paramNoiseReduction")}
            value={params.mltNoiseReduction}
            min={0}
            max={1}
            step={0.05}
            defaultValue={0.5}
            onValueChange={(v) => setAndPreview(params.setMltNoiseReduction, v)}
          />
          <SimpleSlider
            label={t("editor.paramBias")}
            value={params.mltBias}
            min={-1}
            max={1}
            step={0.05}
            defaultValue={0}
            onValueChange={(v) => setAndPreview(params.setMltBias, v)}
          />
          <View className="flex-row gap-2 mt-1">
            <Button
              size="sm"
              variant={params.mltUseLinearMask ? "primary" : "outline"}
              onPress={() => setAndPreview(params.setMltUseLinearMask, !params.mltUseLinearMask)}
            >
              <Button.Label className="text-[9px]">{t("editor.paramLinearMask")}</Button.Label>
            </Button>
          </View>
          <SimpleSlider
            label={t("editor.paramMaskAmplification")}
            value={params.mltLinearMaskAmplification}
            min={10}
            max={1000}
            step={10}
            defaultValue={200}
            onValueChange={(v) =>
              setAndPreview(params.setMltLinearMaskAmplification, Math.round(v))
            }
          />
        </View>
      );

    default:
      return null;
  }
});
