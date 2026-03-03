import React from "react";
import { View } from "react-native";
import { Button } from "heroui-native";
import { useI18n } from "../../../i18n/useI18n";
import { SimpleSlider } from "../../common/SimpleSlider";
import type { EditorTool, EditorToolParams } from "../../../hooks/useEditorToolState";

interface ToolParamsMaskProps {
  activeTool: EditorTool & string;
  params: EditorToolParams;
  onParamChange?: () => void;
}

export const ToolParamsMask = React.memo(function ToolParamsMask({
  activeTool,
  params,
  onParamChange,
}: ToolParamsMaskProps) {
  const { t } = useI18n();

  switch (activeTool) {
    case "starMask":
      return (
        <View>
          <SimpleSlider
            label={t("editor.paramScale")}
            value={params.starMaskScale}
            min={0.5}
            max={4.0}
            step={0.1}
            defaultValue={1.5}
            onValueChange={(v) => {
              params.setStarMaskScale(v);
              onParamChange?.();
            }}
          />
          <SimpleSlider
            label={t("editor.paramGrowth")}
            value={params.starMaskGrowth}
            min={0}
            max={5}
            step={1}
            defaultValue={0}
            onValueChange={(v) => {
              params.setStarMaskGrowth(Math.round(v));
              onParamChange?.();
            }}
          />
          <SimpleSlider
            label={t("editor.paramSoftness")}
            value={params.starMaskSoftness}
            min={0}
            max={5}
            step={0.5}
            defaultValue={0}
            onValueChange={(v) => {
              params.setStarMaskSoftness(v);
              onParamChange?.();
            }}
          />

          <View className="flex-row gap-2 mt-1">
            <Button
              size="sm"
              variant={!params.starMaskInvert ? "primary" : "outline"}
              onPress={() => {
                params.setStarMaskInvert(false);
                onParamChange?.();
              }}
            >
              <Button.Label className="text-[9px]">{t("editor.paramIsolateStars")}</Button.Label>
            </Button>
            <Button
              size="sm"
              variant={params.starMaskInvert ? "primary" : "outline"}
              onPress={() => {
                params.setStarMaskInvert(true);
                onParamChange?.();
              }}
            >
              <Button.Label className="text-[9px]">{t("editor.paramRemoveStars")}</Button.Label>
            </Button>
          </View>
        </View>
      );

    case "rangeMask":
      return (
        <View>
          <SimpleSlider
            label={t("editor.paramLow")}
            value={params.rangeMaskLow}
            min={0}
            max={1}
            step={0.01}
            defaultValue={0}
            onValueChange={(v) => {
              params.setRangeMaskLow(v);
              onParamChange?.();
            }}
          />
          <SimpleSlider
            label={t("editor.paramHigh")}
            value={params.rangeMaskHigh}
            min={0}
            max={1}
            step={0.01}
            defaultValue={1}
            onValueChange={(v) => {
              params.setRangeMaskHigh(v);
              onParamChange?.();
            }}
          />
          <SimpleSlider
            label={t("editor.paramFuzziness")}
            value={params.rangeMaskFuzz}
            min={0}
            max={0.5}
            step={0.01}
            defaultValue={0.1}
            onValueChange={(v) => {
              params.setRangeMaskFuzz(v);
              onParamChange?.();
            }}
          />
        </View>
      );

    case "binarize":
      return (
        <SimpleSlider
          label={t("editor.paramThreshold")}
          value={params.binarizeThreshold}
          min={0}
          max={1}
          step={0.01}
          defaultValue={0.5}
          onValueChange={(v) => {
            params.setBinarizeThreshold(v);
            onParamChange?.();
          }}
        />
      );

    case "edgeMask":
      return (
        <View>
          <SimpleSlider
            label={t("editor.paramPreBlurSigma")}
            value={params.edgeMaskPreBlur}
            min={0}
            max={5}
            step={0.5}
            defaultValue={1}
            onValueChange={(v) => {
              params.setEdgeMaskPreBlur(v);
              onParamChange?.();
            }}
          />
          <SimpleSlider
            label={t("editor.paramThreshold")}
            value={params.edgeMaskThreshold}
            min={0}
            max={1}
            step={0.01}
            defaultValue={0.1}
            onValueChange={(v) => {
              params.setEdgeMaskThreshold(v);
              onParamChange?.();
            }}
          />
          <SimpleSlider
            label={t("editor.paramPostBlurSigma")}
            value={params.edgeMaskPostBlur}
            min={0}
            max={5}
            step={0.5}
            defaultValue={1}
            onValueChange={(v) => {
              params.setEdgeMaskPostBlur(v);
              onParamChange?.();
            }}
          />
        </View>
      );

    default:
      return null;
  }
});
