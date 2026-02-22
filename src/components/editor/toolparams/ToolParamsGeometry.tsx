import { View } from "react-native";
import { Button } from "heroui-native";
import { useI18n } from "../../../i18n/useI18n";
import { SimpleSlider } from "../../common/SimpleSlider";
import type { EditorToolParams } from "../../../hooks/useEditorToolState";
import type { ImageEditOperation } from "../../../lib/utils/imageOperations";

interface ToolParamsGeometryProps {
  activeTool: string;
  params: EditorToolParams;
  onQuickAction: (op: ImageEditOperation) => void;
}

export function ToolParamsGeometry({ activeTool, params, onQuickAction }: ToolParamsGeometryProps) {
  const { t } = useI18n();

  switch (activeTool) {
    case "rotate":
      return (
        <View className="flex-row gap-2 mt-1">
          <Button
            testID="e2e-action-editor__param_id-rotate90cw"
            size="sm"
            variant="outline"
            onPress={() => onQuickAction({ type: "rotate90cw" })}
          >
            <Button.Label className="text-[9px]">{t("editor.paramRotate90CW")}</Button.Label>
          </Button>
          <Button
            testID="e2e-action-editor__param_id-rotate90ccw"
            size="sm"
            variant="outline"
            onPress={() => onQuickAction({ type: "rotate90ccw" })}
          >
            <Button.Label className="text-[9px]">{t("editor.paramRotate90CCW")}</Button.Label>
          </Button>
          <Button
            testID="e2e-action-editor__param_id-rotate180"
            size="sm"
            variant="outline"
            onPress={() => onQuickAction({ type: "rotate180" })}
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
            variant="outline"
            onPress={() => onQuickAction({ type: "flipH" })}
          >
            <Button.Label className="text-[9px]">{t("editor.paramHorizontal")}</Button.Label>
          </Button>
          <Button
            testID="e2e-action-editor__param_id-flip-v"
            size="sm"
            variant="outline"
            onPress={() => onQuickAction({ type: "flipV" })}
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
          onValueChange={params.setRotateAngle}
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
          onValueChange={(v) => params.setBgGridSize(Math.round(v))}
        />
      );

    default:
      return null;
  }
}
