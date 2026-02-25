import React from "react";
import { View } from "react-native";
import { Button } from "heroui-native";
import { useI18n } from "../../../i18n/useI18n";
import { SimpleSlider } from "../../common/SimpleSlider";
import type { EditorTool, EditorToolParams } from "../../../hooks/useEditorToolState";

interface ToolParamsMaskProps {
  activeTool: EditorTool & string;
  params: EditorToolParams;
}

export const ToolParamsMask = React.memo(function ToolParamsMask({
  activeTool,
  params,
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
            onValueChange={params.setStarMaskScale}
          />

          <View className="flex-row gap-2 mt-1">
            <Button
              size="sm"
              variant={!params.starMaskInvert ? "primary" : "outline"}
              onPress={() => params.setStarMaskInvert(false)}
            >
              <Button.Label className="text-[9px]">{t("editor.paramIsolateStars")}</Button.Label>
            </Button>
            <Button
              size="sm"
              variant={params.starMaskInvert ? "primary" : "outline"}
              onPress={() => params.setStarMaskInvert(true)}
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
            onValueChange={params.setRangeMaskLow}
          />
          <SimpleSlider
            label={t("editor.paramHigh")}
            value={params.rangeMaskHigh}
            min={0}
            max={1}
            step={0.01}
            defaultValue={1}
            onValueChange={params.setRangeMaskHigh}
          />
          <SimpleSlider
            label={t("editor.paramFuzziness")}
            value={params.rangeMaskFuzz}
            min={0}
            max={0.5}
            step={0.01}
            defaultValue={0.1}
            onValueChange={params.setRangeMaskFuzz}
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
          onValueChange={params.setBinarizeThreshold}
        />
      );

    default:
      return null;
  }
});
