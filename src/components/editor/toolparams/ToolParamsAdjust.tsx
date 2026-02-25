import React from "react";
import { View } from "react-native";
import { Button } from "heroui-native";
import { useI18n } from "../../../i18n/useI18n";
import { SimpleSlider } from "../../common/SimpleSlider";
import type { EditorTool, EditorToolParams, CurvesPreset } from "../../../hooks/useEditorToolState";

interface ToolParamsAdjustProps {
  activeTool: EditorTool & string;
  params: EditorToolParams;
}

export const ToolParamsAdjust = React.memo(function ToolParamsAdjust({
  activeTool,
  params,
}: ToolParamsAdjustProps) {
  const { t } = useI18n();

  switch (activeTool) {
    case "blur":
      return (
        <SimpleSlider
          label={t("editor.paramSigma")}
          value={params.blurSigma}
          min={0.5}
          max={10}
          step={0.5}
          defaultValue={2}
          onValueChange={params.setBlurSigma}
        />
      );

    case "sharpen":
      return (
        <View>
          <SimpleSlider
            label={t("editor.paramAmount")}
            value={params.sharpenAmount}
            min={0.5}
            max={5}
            step={0.1}
            defaultValue={1.5}
            onValueChange={params.setSharpenAmount}
          />
          <SimpleSlider
            label={t("editor.paramSigma")}
            value={params.sharpenSigma}
            min={0.5}
            max={5}
            step={0.5}
            defaultValue={1.0}
            onValueChange={params.setSharpenSigma}
          />
        </View>
      );

    case "denoise":
      return (
        <SimpleSlider
          label={t("editor.paramRadius")}
          value={params.denoiseRadius}
          min={1}
          max={5}
          step={1}
          defaultValue={1}
          onValueChange={(v) => params.setDenoiseRadius(Math.round(v))}
        />
      );

    case "brightness":
      return (
        <SimpleSlider
          label={t("editor.paramAmount")}
          value={params.brightnessAmount}
          min={-0.5}
          max={0.5}
          step={0.01}
          defaultValue={0}
          onValueChange={params.setBrightnessAmount}
        />
      );

    case "contrast":
      return (
        <SimpleSlider
          label={t("editor.paramFactor")}
          value={params.contrastFactor}
          min={0.2}
          max={3.0}
          step={0.1}
          defaultValue={1.0}
          onValueChange={params.setContrastFactor}
        />
      );

    case "gamma":
      return (
        <SimpleSlider
          label={t("editor.paramGamma")}
          value={params.gammaValue}
          min={0.1}
          max={5.0}
          step={0.1}
          defaultValue={1.0}
          onValueChange={params.setGammaValue}
        />
      );

    case "levels":
      return (
        <View>
          <SimpleSlider
            label={t("editor.paramInputBlack")}
            value={params.levelsInputBlack}
            min={0}
            max={0.5}
            step={0.01}
            defaultValue={0}
            onValueChange={params.setLevelsInputBlack}
          />
          <SimpleSlider
            label={t("editor.paramInputWhite")}
            value={params.levelsInputWhite}
            min={0.5}
            max={1}
            step={0.01}
            defaultValue={1}
            onValueChange={params.setLevelsInputWhite}
          />
          <SimpleSlider
            label={t("editor.paramGamma")}
            value={params.levelsGamma}
            min={0.1}
            max={5.0}
            step={0.1}
            defaultValue={1.0}
            onValueChange={params.setLevelsGamma}
          />
        </View>
      );

    case "mtf":
      return (
        <View>
          <SimpleSlider
            label={t("editor.paramMidtone")}
            value={params.mtfMidtone}
            min={0.01}
            max={0.99}
            step={0.01}
            defaultValue={0.25}
            onValueChange={params.setMtfMidtone}
          />
          <SimpleSlider
            label={t("editor.paramShadowsClip")}
            value={params.mtfShadows}
            min={0}
            max={0.5}
            step={0.01}
            defaultValue={0}
            onValueChange={params.setMtfShadows}
          />
          <SimpleSlider
            label={t("editor.paramHighlightsClip")}
            value={params.mtfHighlights}
            min={0.5}
            max={1}
            step={0.01}
            defaultValue={1}
            onValueChange={params.setMtfHighlights}
          />
        </View>
      );

    case "curves":
      return (
        <View className="flex-row flex-wrap gap-1">
          {(
            [
              { key: "linear", labelKey: "editor.paramLinear" },
              { key: "sCurve", labelKey: "editor.paramSCurve" },
              { key: "brighten", labelKey: "editor.paramBrighten" },
              { key: "darken", labelKey: "editor.paramDarken" },
              { key: "highContrast", labelKey: "editor.paramHighContrast" },
            ] as { key: CurvesPreset; labelKey: string }[]
          ).map((p) => (
            <Button
              key={p.key}
              size="sm"
              variant={params.curvesPreset === p.key ? "primary" : "outline"}
              onPress={() => params.setCurvesPreset(p.key)}
            >
              <Button.Label className="text-[9px]">{t(p.labelKey)}</Button.Label>
            </Button>
          ))}
        </View>
      );

    default:
      return null;
  }
});
