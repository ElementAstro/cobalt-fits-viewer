import React from "react";
import { View } from "react-native";
import { Button } from "heroui-native";
import { useI18n } from "../../../i18n/useI18n";
import { SimpleSlider } from "../../common/SimpleSlider";
import type { EditorTool, EditorToolParams } from "../../../hooks/useEditorToolState";
import type { ImageEditOperation } from "../../../lib/utils/imageOperations";

interface ToolParamsGeometryProps {
  activeTool: EditorTool & string;
  params: EditorToolParams;
  onQuickAction: (op: ImageEditOperation) => void;
  onParamChange?: () => void;
}

export const ToolParamsGeometry = React.memo(function ToolParamsGeometry({
  activeTool,
  params,
  onQuickAction,
  onParamChange,
}: ToolParamsGeometryProps) {
  const { t } = useI18n();
  void onQuickAction;

  switch (activeTool) {
    case "rotate":
      return (
        <View className="flex-row gap-2 mt-1">
          <Button
            testID="e2e-action-editor__param_id-rotate90cw"
            size="sm"
            variant={params.rotateMode === "rotate90cw" ? "primary" : "outline"}
            onPress={() => {
              params.setRotateMode("rotate90cw");
              onParamChange?.();
            }}
          >
            <Button.Label className="text-[9px]">{t("editor.paramRotate90CW")}</Button.Label>
          </Button>
          <Button
            testID="e2e-action-editor__param_id-rotate90ccw"
            size="sm"
            variant={params.rotateMode === "rotate90ccw" ? "primary" : "outline"}
            onPress={() => {
              params.setRotateMode("rotate90ccw");
              onParamChange?.();
            }}
          >
            <Button.Label className="text-[9px]">{t("editor.paramRotate90CCW")}</Button.Label>
          </Button>
          <Button
            testID="e2e-action-editor__param_id-rotate180"
            size="sm"
            variant={params.rotateMode === "rotate180" ? "primary" : "outline"}
            onPress={() => {
              params.setRotateMode("rotate180");
              onParamChange?.();
            }}
          >
            <Button.Label className="text-[9px]">{t("editor.paramRotate180")}</Button.Label>
          </Button>
        </View>
      );

    case "flip":
      return (
        <View className="flex-row gap-2 mt-1">
          <Button
            testID="e2e-action-editor__param_id-flip-h"
            size="sm"
            variant={params.flipMode === "flipH" ? "primary" : "outline"}
            onPress={() => {
              params.setFlipMode("flipH");
              onParamChange?.();
            }}
          >
            <Button.Label className="text-[9px]">{t("editor.paramHorizontal")}</Button.Label>
          </Button>
          <Button
            testID="e2e-action-editor__param_id-flip-v"
            size="sm"
            variant={params.flipMode === "flipV" ? "primary" : "outline"}
            onPress={() => {
              params.setFlipMode("flipV");
              onParamChange?.();
            }}
          >
            <Button.Label className="text-[9px]">{t("editor.paramVertical")}</Button.Label>
          </Button>
        </View>
      );

    case "rotateCustom":
      return (
        <SimpleSlider
          label={t("editor.paramAngle")}
          value={params.rotateAngle}
          min={-180}
          max={180}
          step={0.5}
          defaultValue={0}
          onValueChange={(v) => {
            params.setRotateAngle(v);
            onParamChange?.();
          }}
        />
      );

    case "background":
      return (
        <SimpleSlider
          label={t("editor.paramGridSize")}
          value={params.bgGridSize}
          min={4}
          max={16}
          step={1}
          defaultValue={8}
          onValueChange={(v) => {
            params.setBgGridSize(Math.round(v));
            onParamChange?.();
          }}
        />
      );

    default:
      return null;
  }
});
