import { View, Text, TextInput } from "react-native";
import { Button } from "heroui-native";
import { useI18n } from "../../../i18n/useI18n";
import { SimpleSlider } from "../../common/SimpleSlider";
import type { EditorToolParams } from "../../../hooks/useEditorToolState";

interface ToolParamsProcessProps {
  activeTool: string;
  params: EditorToolParams;
}

export function ToolParamsProcess({ activeTool, params }: ToolParamsProcessProps) {
  const { t } = useI18n();

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
            onValueChange={(v) => params.setClaheTileSize(Math.round(v))}
          />
          <SimpleSlider
            label={t("editor.paramClipLimit")}
            value={params.claheClipLimit}
            min={1.0}
            max={10.0}
            step={0.5}
            defaultValue={3.0}
            onValueChange={params.setClaheClipLimit}
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
            onValueChange={(v) => params.setHdrLayers(Math.round(v))}
          />
          <SimpleSlider
            label={t("editor.paramAmount")}
            value={params.hdrAmount}
            min={0}
            max={1}
            step={0.05}
            defaultValue={0.7}
            onValueChange={params.setHdrAmount}
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
                onPress={() => params.setMorphOp(op)}
              >
                <Button.Label className="text-[9px] capitalize">{op}</Button.Label>
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
            onValueChange={(v) => params.setMorphRadius(Math.round(v))}
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
            onValueChange={params.setDeconvPsfSigma}
          />
          <SimpleSlider
            label={t("editor.paramIterations")}
            value={params.deconvIterations}
            min={5}
            max={80}
            step={1}
            defaultValue={20}
            onValueChange={(v) => params.setDeconvIterations(Math.round(v))}
          />
          <SimpleSlider
            label={t("editor.paramRegularization")}
            value={params.deconvRegularization}
            min={0}
            max={1}
            step={0.05}
            defaultValue={0.1}
            onValueChange={params.setDeconvRegularization}
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
            onValueChange={(v) => params.setDbeSamplesX(Math.round(v))}
          />
          <SimpleSlider
            label={t("editor.paramSamplesY")}
            value={params.dbeSamplesY}
            min={4}
            max={16}
            step={1}
            defaultValue={8}
            onValueChange={(v) => params.setDbeSamplesY(Math.round(v))}
          />
          <SimpleSlider
            label={t("editor.paramSigma")}
            value={params.dbeSigma}
            min={1}
            max={5}
            step={0.1}
            defaultValue={2.5}
            onValueChange={params.setDbeSigma}
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
            onValueChange={(v) => params.setMultiscaleLayers(Math.round(v))}
          />
          <SimpleSlider
            label={t("editor.paramThreshold")}
            value={params.multiscaleThreshold}
            min={0.5}
            max={6}
            step={0.1}
            defaultValue={2.5}
            onValueChange={params.setMultiscaleThreshold}
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
            onValueChange={params.setLocalContrastSigma}
          />
          <SimpleSlider
            label={t("editor.paramAmount")}
            value={params.localContrastAmount}
            min={0}
            max={1}
            step={0.05}
            defaultValue={0.35}
            onValueChange={params.setLocalContrastAmount}
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
            onValueChange={params.setStarReductionScale}
          />
          <SimpleSlider
            label={t("editor.paramStrength")}
            value={params.starReductionStrength}
            min={0}
            max={1}
            step={0.05}
            defaultValue={0.6}
            onValueChange={params.setStarReductionStrength}
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
            onValueChange={(v) => params.setDeconvAutoIterations(Math.round(v))}
          />
          <SimpleSlider
            label={t("editor.paramRegularization")}
            value={params.deconvAutoRegularization}
            min={0}
            max={1}
            step={0.05}
            defaultValue={0.1}
            onValueChange={params.setDeconvAutoRegularization}
          />
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
            onValueChange={params.setScnrAmount}
          />
          <View className="flex-row gap-2 mt-1">
            <Button
              size="sm"
              variant={params.scnrMethod === "averageNeutral" ? "primary" : "outline"}
              onPress={() => params.setScnrMethod("averageNeutral")}
            >
              <Button.Label className="text-[9px]">{t("editor.paramAverage")}</Button.Label>
            </Button>
            <Button
              size="sm"
              variant={params.scnrMethod === "maximumNeutral" ? "primary" : "outline"}
              onPress={() => params.setScnrMethod("maximumNeutral")}
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
          onValueChange={params.setColorCalibrationPercentile}
        />
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
          onValueChange={params.setSaturationAmount}
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
            onValueChange={params.setColorBalanceRedGain}
          />
          <SimpleSlider
            label={t("editor.paramGreenGain")}
            value={params.colorBalanceGreenGain}
            min={0}
            max={4}
            step={0.05}
            defaultValue={1}
            onValueChange={params.setColorBalanceGreenGain}
          />
          <SimpleSlider
            label={t("editor.paramBlueGain")}
            value={params.colorBalanceBlueGain}
            min={0}
            max={4}
            step={0.05}
            defaultValue={1}
            onValueChange={params.setColorBalanceBlueGain}
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
            onChangeText={params.setPixelMathExpr}
            placeholder="($T - $min) / ($max - $min)"
            placeholderTextColor="#666"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      );

    default:
      return null;
  }
}
