import React from "react";
import { View } from "react-native";
import { Button } from "heroui-native";
import { useI18n } from "../../../i18n/useI18n";
import { SimpleSlider } from "../../common/SimpleSlider";
import type { EditorTool, EditorToolParams, CurvesPreset } from "../../../hooks/useEditorToolState";

interface ToolParamsSliderProps {
  activeTool: EditorTool & string;
  params: EditorToolParams;
  onParamChange?: () => void;
}

export const ToolParamsSlider = React.memo(function ToolParamsSlider({
  activeTool,
  params,
  onParamChange,
}: ToolParamsSliderProps) {
  const { t } = useI18n();

  switch (activeTool) {
    case "blur":
      return (
        <SimpleSlider
          label={t("editor.paramSigma")}
          value={params.blurSigma}
          min={0.5}
          max={10}
          step={0.1}
          defaultValue={2}
          onValueChange={(v) => {
            params.setBlurSigma(v);
            onParamChange?.();
          }}
        />
      );

    case "sharpen":
      return (
        <View>
          <SimpleSlider
            label={t("editor.paramAmount")}
            value={params.sharpenAmount}
            min={0.1}
            max={5}
            step={0.1}
            defaultValue={1.5}
            onValueChange={(v) => {
              params.setSharpenAmount(v);
              onParamChange?.();
            }}
          />
          <SimpleSlider
            label={t("editor.paramSigma")}
            value={params.sharpenSigma}
            min={0.5}
            max={5}
            step={0.1}
            defaultValue={1.0}
            onValueChange={(v) => {
              params.setSharpenSigma(v);
              onParamChange?.();
            }}
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
          onValueChange={(v) => {
            params.setDenoiseRadius(Math.round(v));
            onParamChange?.();
          }}
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
          onValueChange={(v) => {
            params.setBrightnessAmount(v);
            onParamChange?.();
          }}
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
          onValueChange={(v) => {
            params.setContrastFactor(v);
            onParamChange?.();
          }}
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
          onValueChange={(v) => {
            params.setGammaValue(v);
            onParamChange?.();
          }}
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
            onValueChange={(v) => {
              params.setLevelsInputBlack(v);
              onParamChange?.();
            }}
          />
          <SimpleSlider
            label={t("editor.paramInputWhite")}
            value={params.levelsInputWhite}
            min={0.5}
            max={1}
            step={0.01}
            defaultValue={1}
            onValueChange={(v) => {
              params.setLevelsInputWhite(v);
              onParamChange?.();
            }}
          />
          <SimpleSlider
            label={t("editor.paramGamma")}
            value={params.levelsGamma}
            min={0.1}
            max={5.0}
            step={0.1}
            defaultValue={1.0}
            onValueChange={(v) => {
              params.setLevelsGamma(v);
              onParamChange?.();
            }}
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
            onValueChange={(v) => {
              params.setMtfMidtone(v);
              onParamChange?.();
            }}
          />
          <SimpleSlider
            label={t("editor.paramShadowsClip")}
            value={params.mtfShadows}
            min={0}
            max={0.5}
            step={0.01}
            defaultValue={0}
            onValueChange={(v) => {
              params.setMtfShadows(v);
              onParamChange?.();
            }}
          />
          <SimpleSlider
            label={t("editor.paramHighlightsClip")}
            value={params.mtfHighlights}
            min={0.5}
            max={1}
            step={0.01}
            defaultValue={1}
            onValueChange={(v) => {
              params.setMtfHighlights(v);
              onParamChange?.();
            }}
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
              onPress={() => {
                params.setCurvesPreset(p.key);
                onParamChange?.();
              }}
            >
              <Button.Label className="text-[9px]">{t(p.labelKey)}</Button.Label>
            </Button>
          ))}
        </View>
      );

    case "ghs":
      return (
        <View>
          <SimpleSlider
            label={t("editor.paramD")}
            value={params.ghsD}
            min={0}
            max={10}
            step={0.1}
            defaultValue={1}
            onValueChange={(v) => {
              params.setGhsD(v);
              onParamChange?.();
            }}
          />
          <SimpleSlider
            label={t("editor.paramB")}
            value={params.ghsB}
            min={0}
            max={1}
            step={0.01}
            defaultValue={0.25}
            onValueChange={(v) => {
              params.setGhsB(v);
              onParamChange?.();
            }}
          />
          <SimpleSlider
            label={t("editor.paramSP")}
            value={params.ghsSP}
            min={0}
            max={1}
            step={0.01}
            defaultValue={0}
            onValueChange={(v) => {
              params.setGhsSP(v);
              onParamChange?.();
            }}
          />
          <SimpleSlider
            label={t("editor.paramHP")}
            value={params.ghsHP}
            min={0}
            max={1}
            step={0.01}
            defaultValue={0}
            onValueChange={(v) => {
              params.setGhsHP(v);
              onParamChange?.();
            }}
          />
          <SimpleSlider
            label={t("editor.paramLP")}
            value={params.ghsLP}
            min={0}
            max={1}
            step={0.01}
            defaultValue={0}
            onValueChange={(v) => {
              params.setGhsLP(v);
              onParamChange?.();
            }}
          />
        </View>
      );

    default:
      return null;
  }
});
