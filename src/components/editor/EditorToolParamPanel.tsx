import { View, Text, TextInput } from "react-native";
import { Button, Card } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../../i18n/useI18n";
import { SimpleSlider } from "../common/SimpleSlider";
import type { EditorTool, EditorToolParams, CurvesPreset } from "../../hooks/useEditorToolState";
import type { ImageEditOperation } from "../../lib/utils/imageOperations";

interface EditorToolParamPanelProps {
  activeTool: EditorTool;
  params: EditorToolParams;
  successColor: string;
  onApply: () => void;
  onCancel: () => void;
  onQuickAction: (op: ImageEditOperation) => void;
}

export function EditorToolParamPanel({
  activeTool,
  params,
  successColor,
  onApply,
  onCancel,
  onQuickAction,
}: EditorToolParamPanelProps) {
  const { t } = useI18n();

  if (!activeTool) return null;

  return (
    <View className="absolute bottom-4 left-4 right-4">
      <Card variant="secondary">
        <Card.Body className="p-3">
          <View className="flex-row items-center justify-between mb-2">
            <View className="flex-row items-center gap-2">
              <Ionicons name="construct-outline" size={14} color={successColor} />
              <Text className="text-xs font-semibold text-success capitalize">{activeTool}</Text>
            </View>
            <View className="flex-row gap-2">
              <Button size="sm" variant="outline" onPress={onCancel}>
                <Button.Label className="text-[10px]">{t("common.cancel")}</Button.Label>
              </Button>
              <Button size="sm" variant="primary" onPress={onApply}>
                <Button.Label className="text-[10px]">{t("editor.apply")}</Button.Label>
              </Button>
            </View>
          </View>

          <ToolParams activeTool={activeTool} params={params} onQuickAction={onQuickAction} />
        </Card.Body>
      </Card>
    </View>
  );
}

function ToolParams({
  activeTool,
  params,
  onQuickAction,
}: {
  activeTool: EditorTool & string;
  params: EditorToolParams;
  onQuickAction: (op: ImageEditOperation) => void;
}) {
  switch (activeTool) {
    case "blur":
      return (
        <SimpleSlider
          label="Sigma"
          value={params.blurSigma}
          min={0.5}
          max={10}
          step={0.5}
          onValueChange={params.setBlurSigma}
        />
      );

    case "sharpen":
      return (
        <View>
          <SimpleSlider
            label="Amount"
            value={params.sharpenAmount}
            min={0.5}
            max={5}
            step={0.1}
            onValueChange={params.setSharpenAmount}
          />
          <SimpleSlider
            label="Sigma"
            value={params.sharpenSigma}
            min={0.5}
            max={5}
            step={0.5}
            onValueChange={params.setSharpenSigma}
          />
        </View>
      );

    case "denoise":
      return (
        <SimpleSlider
          label="Radius"
          value={params.denoiseRadius}
          min={1}
          max={5}
          step={1}
          onValueChange={(v) => params.setDenoiseRadius(Math.round(v))}
        />
      );

    case "brightness":
      return (
        <SimpleSlider
          label="Amount"
          value={params.brightnessAmount}
          min={-0.5}
          max={0.5}
          step={0.01}
          onValueChange={params.setBrightnessAmount}
        />
      );

    case "contrast":
      return (
        <SimpleSlider
          label="Factor"
          value={params.contrastFactor}
          min={0.2}
          max={3.0}
          step={0.1}
          onValueChange={params.setContrastFactor}
        />
      );

    case "gamma":
      return (
        <SimpleSlider
          label="Gamma"
          value={params.gammaValue}
          min={0.1}
          max={5.0}
          step={0.1}
          onValueChange={params.setGammaValue}
        />
      );

    case "levels":
      return (
        <View>
          <SimpleSlider
            label="Input Black"
            value={params.levelsInputBlack}
            min={0}
            max={0.5}
            step={0.01}
            onValueChange={params.setLevelsInputBlack}
          />
          <SimpleSlider
            label="Input White"
            value={params.levelsInputWhite}
            min={0.5}
            max={1}
            step={0.01}
            onValueChange={params.setLevelsInputWhite}
          />
          <SimpleSlider
            label="Gamma"
            value={params.levelsGamma}
            min={0.1}
            max={5.0}
            step={0.1}
            onValueChange={params.setLevelsGamma}
          />
        </View>
      );

    case "background":
      return (
        <SimpleSlider
          label="Grid Size"
          value={params.bgGridSize}
          min={4}
          max={16}
          step={1}
          onValueChange={(v) => params.setBgGridSize(Math.round(v))}
        />
      );

    case "rotateCustom":
      return (
        <SimpleSlider
          label="Angle (°)"
          value={params.rotateAngle}
          min={-180}
          max={180}
          step={0.5}
          onValueChange={params.setRotateAngle}
        />
      );

    case "curves":
      return (
        <View className="flex-row flex-wrap gap-1">
          {(
            [
              { key: "linear", label: "Linear" },
              { key: "sCurve", label: "S-Curve" },
              { key: "brighten", label: "Brighten" },
              { key: "darken", label: "Darken" },
              { key: "highContrast", label: "High Contrast" },
            ] as { key: CurvesPreset; label: string }[]
          ).map((p) => (
            <Button
              key={p.key}
              size="sm"
              variant={params.curvesPreset === p.key ? "primary" : "outline"}
              onPress={() => params.setCurvesPreset(p.key)}
            >
              <Button.Label className="text-[9px]">{p.label}</Button.Label>
            </Button>
          ))}
        </View>
      );

    case "mtf":
      return (
        <View>
          <SimpleSlider
            label="Midtone"
            value={params.mtfMidtone}
            min={0.01}
            max={0.99}
            step={0.01}
            onValueChange={params.setMtfMidtone}
          />
          <SimpleSlider
            label="Shadows Clip"
            value={params.mtfShadows}
            min={0}
            max={0.5}
            step={0.01}
            onValueChange={params.setMtfShadows}
          />
          <SimpleSlider
            label="Highlights Clip"
            value={params.mtfHighlights}
            min={0.5}
            max={1}
            step={0.01}
            onValueChange={params.setMtfHighlights}
          />
        </View>
      );

    case "clahe":
      return (
        <View>
          <SimpleSlider
            label="Tile Size"
            value={params.claheTileSize}
            min={4}
            max={16}
            step={1}
            onValueChange={(v) => params.setClaheTileSize(Math.round(v))}
          />
          <SimpleSlider
            label="Clip Limit"
            value={params.claheClipLimit}
            min={1.0}
            max={10.0}
            step={0.5}
            onValueChange={params.setClaheClipLimit}
          />
        </View>
      );

    case "hdr":
      return (
        <View>
          <SimpleSlider
            label="Layers"
            value={params.hdrLayers}
            min={3}
            max={8}
            step={1}
            onValueChange={(v) => params.setHdrLayers(Math.round(v))}
          />
          <SimpleSlider
            label="Amount"
            value={params.hdrAmount}
            min={0}
            max={1}
            step={0.05}
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
            label="Radius"
            value={params.morphRadius}
            min={1}
            max={5}
            step={1}
            onValueChange={(v) => params.setMorphRadius(Math.round(v))}
          />
        </View>
      );

    case "starMask":
      return (
        <View>
          <SimpleSlider
            label="Scale"
            value={params.starMaskScale}
            min={0.5}
            max={4.0}
            step={0.1}
            onValueChange={params.setStarMaskScale}
          />
          <View className="flex-row gap-2 mt-1">
            <Button
              size="sm"
              variant={!params.starMaskInvert ? "primary" : "outline"}
              onPress={() => params.setStarMaskInvert(false)}
            >
              <Button.Label className="text-[9px]">Isolate Stars</Button.Label>
            </Button>
            <Button
              size="sm"
              variant={params.starMaskInvert ? "primary" : "outline"}
              onPress={() => params.setStarMaskInvert(true)}
            >
              <Button.Label className="text-[9px]">Remove Stars</Button.Label>
            </Button>
          </View>
        </View>
      );

    case "rangeMask":
      return (
        <View>
          <SimpleSlider
            label="Low"
            value={params.rangeMaskLow}
            min={0}
            max={1}
            step={0.01}
            onValueChange={params.setRangeMaskLow}
          />
          <SimpleSlider
            label="High"
            value={params.rangeMaskHigh}
            min={0}
            max={1}
            step={0.01}
            onValueChange={params.setRangeMaskHigh}
          />
          <SimpleSlider
            label="Fuzziness"
            value={params.rangeMaskFuzz}
            min={0}
            max={0.5}
            step={0.01}
            onValueChange={params.setRangeMaskFuzz}
          />
        </View>
      );

    case "binarize":
      return (
        <SimpleSlider
          label="Threshold"
          value={params.binarizeThreshold}
          min={0}
          max={1}
          step={0.01}
          onValueChange={params.setBinarizeThreshold}
        />
      );

    case "deconvolution":
      return (
        <View>
          <SimpleSlider
            label="PSF Sigma"
            value={params.deconvPsfSigma}
            min={0.5}
            max={5}
            step={0.1}
            onValueChange={params.setDeconvPsfSigma}
          />
          <SimpleSlider
            label="Iterations"
            value={params.deconvIterations}
            min={5}
            max={80}
            step={1}
            onValueChange={(v) => params.setDeconvIterations(Math.round(v))}
          />
          <SimpleSlider
            label="Regularization"
            value={params.deconvRegularization}
            min={0}
            max={1}
            step={0.05}
            onValueChange={params.setDeconvRegularization}
          />
        </View>
      );

    case "dbe":
      return (
        <View>
          <SimpleSlider
            label="Samples X"
            value={params.dbeSamplesX}
            min={4}
            max={24}
            step={1}
            onValueChange={(v) => params.setDbeSamplesX(Math.round(v))}
          />
          <SimpleSlider
            label="Samples Y"
            value={params.dbeSamplesY}
            min={4}
            max={16}
            step={1}
            onValueChange={(v) => params.setDbeSamplesY(Math.round(v))}
          />
          <SimpleSlider
            label="Sigma"
            value={params.dbeSigma}
            min={1}
            max={5}
            step={0.1}
            onValueChange={params.setDbeSigma}
          />
        </View>
      );

    case "multiscaleDenoise":
      return (
        <View>
          <SimpleSlider
            label="Layers"
            value={params.multiscaleLayers}
            min={1}
            max={8}
            step={1}
            onValueChange={(v) => params.setMultiscaleLayers(Math.round(v))}
          />
          <SimpleSlider
            label="Threshold"
            value={params.multiscaleThreshold}
            min={0.5}
            max={6}
            step={0.1}
            onValueChange={params.setMultiscaleThreshold}
          />
        </View>
      );

    case "localContrast":
      return (
        <View>
          <SimpleSlider
            label="Sigma"
            value={params.localContrastSigma}
            min={1}
            max={20}
            step={0.5}
            onValueChange={params.setLocalContrastSigma}
          />
          <SimpleSlider
            label="Amount"
            value={params.localContrastAmount}
            min={0}
            max={1}
            step={0.05}
            onValueChange={params.setLocalContrastAmount}
          />
        </View>
      );

    case "starReduction":
      return (
        <View>
          <SimpleSlider
            label="Scale"
            value={params.starReductionScale}
            min={0.5}
            max={4}
            step={0.1}
            onValueChange={params.setStarReductionScale}
          />
          <SimpleSlider
            label="Strength"
            value={params.starReductionStrength}
            min={0}
            max={1}
            step={0.05}
            onValueChange={params.setStarReductionStrength}
          />
        </View>
      );

    case "deconvolutionAuto":
      return (
        <View>
          <SimpleSlider
            label="Iterations"
            value={params.deconvAutoIterations}
            min={5}
            max={80}
            step={1}
            onValueChange={(v) => params.setDeconvAutoIterations(Math.round(v))}
          />
          <SimpleSlider
            label="Regularization"
            value={params.deconvAutoRegularization}
            min={0}
            max={1}
            step={0.05}
            onValueChange={params.setDeconvAutoRegularization}
          />
        </View>
      );

    case "scnr":
      return (
        <View>
          <SimpleSlider
            label="Amount"
            value={params.scnrAmount}
            min={0}
            max={1}
            step={0.05}
            onValueChange={params.setScnrAmount}
          />
          <View className="flex-row gap-2 mt-1">
            <Button
              size="sm"
              variant={params.scnrMethod === "averageNeutral" ? "primary" : "outline"}
              onPress={() => params.setScnrMethod("averageNeutral")}
            >
              <Button.Label className="text-[9px]">Average</Button.Label>
            </Button>
            <Button
              size="sm"
              variant={params.scnrMethod === "maximumNeutral" ? "primary" : "outline"}
              onPress={() => params.setScnrMethod("maximumNeutral")}
            >
              <Button.Label className="text-[9px]">Maximum</Button.Label>
            </Button>
          </View>
        </View>
      );

    case "colorCalibration":
      return (
        <SimpleSlider
          label="Reference Percentile"
          value={params.colorCalibrationPercentile}
          min={0.5}
          max={0.99}
          step={0.01}
          onValueChange={params.setColorCalibrationPercentile}
        />
      );

    case "saturation":
      return (
        <SimpleSlider
          label="Amount"
          value={params.saturationAmount}
          min={-1}
          max={2}
          step={0.05}
          onValueChange={params.setSaturationAmount}
        />
      );

    case "colorBalance":
      return (
        <View>
          <SimpleSlider
            label="Red Gain"
            value={params.colorBalanceRedGain}
            min={0}
            max={4}
            step={0.05}
            onValueChange={params.setColorBalanceRedGain}
          />
          <SimpleSlider
            label="Green Gain"
            value={params.colorBalanceGreenGain}
            min={0}
            max={4}
            step={0.05}
            onValueChange={params.setColorBalanceGreenGain}
          />
          <SimpleSlider
            label="Blue Gain"
            value={params.colorBalanceBlueGain}
            min={0}
            max={4}
            step={0.05}
            onValueChange={params.setColorBalanceBlueGain}
          />
        </View>
      );

    case "pixelMath":
      return (
        <View>
          <Text className="text-[9px] text-muted mb-1">
            Variables: $T, $mean, $median, $min, $max
          </Text>
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

    case "rotate":
      return (
        <View className="flex-row gap-2 mt-1">
          <Button
            testID="e2e-action-editor__param_id-rotate90cw"
            size="sm"
            variant="outline"
            onPress={() => onQuickAction({ type: "rotate90cw" })}
          >
            <Button.Label className="text-[9px]">90° CW</Button.Label>
          </Button>
          <Button
            testID="e2e-action-editor__param_id-rotate90ccw"
            size="sm"
            variant="outline"
            onPress={() => onQuickAction({ type: "rotate90ccw" })}
          >
            <Button.Label className="text-[9px]">90° CCW</Button.Label>
          </Button>
          <Button
            testID="e2e-action-editor__param_id-rotate180"
            size="sm"
            variant="outline"
            onPress={() => onQuickAction({ type: "rotate180" })}
          >
            <Button.Label className="text-[9px]">180°</Button.Label>
          </Button>
        </View>
      );

    case "flip":
      return (
        <View className="flex-row gap-2 mt-1">
          <Button
            testID="e2e-action-editor__param_id-flip-h"
            size="sm"
            variant="outline"
            onPress={() => onQuickAction({ type: "flipH" })}
          >
            <Button.Label className="text-[9px]">Horizontal</Button.Label>
          </Button>
          <Button
            testID="e2e-action-editor__param_id-flip-v"
            size="sm"
            variant="outline"
            onPress={() => onQuickAction({ type: "flipV" })}
          >
            <Button.Label className="text-[9px]">Vertical</Button.Label>
          </Button>
        </View>
      );

    default:
      return null;
  }
}
