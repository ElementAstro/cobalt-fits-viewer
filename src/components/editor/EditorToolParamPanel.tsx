import React from "react";
import { View, Text } from "react-native";
import { Button, Card } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../../i18n/useI18n";
import {
  ToolParamsGeometry,
  ToolParamsSlider,
  ToolParamsProcess,
  ToolParamsMask,
} from "./toolparams";
import type { EditorTool, EditorToolParams } from "../../hooks/useEditorToolState";
import type { ImageEditOperation } from "../../lib/utils/imageOperations";

interface EditorToolParamPanelProps {
  activeTool: EditorTool;
  params: EditorToolParams;
  successColor: string;
  onApply: () => void;
  onCancel: () => void;
  onQuickAction: (op: ImageEditOperation) => void;
  onReset?: () => void;
  onParamChange?: () => void;
}

export const EditorToolParamPanel = React.memo(function EditorToolParamPanel({
  activeTool,
  params,
  successColor,
  onApply,
  onCancel,
  onQuickAction,
  onReset,
  onParamChange,
}: EditorToolParamPanelProps) {
  const { t } = useI18n();

  if (!activeTool) return null;

  const toolLabel = t(`editor.${activeTool}`);

  return (
    <View className="absolute bottom-4 left-4 right-4">
      <Card variant="secondary">
        <Card.Body className="p-3">
          <View className="flex-row items-center justify-between mb-2">
            <View className="flex-row items-center gap-2">
              <Ionicons name="construct-outline" size={14} color={successColor} />
              <Text className="text-xs font-semibold text-success">{toolLabel}</Text>
            </View>
            <View className="flex-row gap-2">
              {onReset && (
                <Button size="sm" variant="ghost" onPress={onReset}>
                  <Button.Label className="text-[10px]">{t("common.reset")}</Button.Label>
                </Button>
              )}
              <Button size="sm" variant="outline" onPress={onCancel}>
                <Button.Label className="text-[10px]">{t("common.cancel")}</Button.Label>
              </Button>
              <Button size="sm" variant="primary" onPress={onApply}>
                <Button.Label className="text-[10px]">{t("editor.apply")}</Button.Label>
              </Button>
            </View>
          </View>

          <ToolParams
            activeTool={activeTool}
            params={params}
            onQuickAction={onQuickAction}
            onParamChange={onParamChange}
          />
          {PREVIEW_UNSUPPORTED_TOOLS.has(activeTool) ? (
            <Text className="mt-2 text-[10px] text-muted">{t("editor.previewNotSupported")}</Text>
          ) : null}
        </Card.Body>
      </Card>
    </View>
  );
});

const PARAM_GEOMETRY_TOOLS = new Set(["rotate", "flip", "rotateCustom", "background"]);
const PARAM_SLIDER_TOOLS = new Set([
  "blur",
  "sharpen",
  "denoise",
  "brightness",
  "contrast",
  "gamma",
  "levels",
  "mtf",
  "curves",
  "ghs",
]);
const PARAM_MASK_TOOLS = new Set(["starMask", "rangeMask", "binarize", "edgeMask"]);
const PREVIEW_UNSUPPORTED_TOOLS = new Set([
  "deconvolution",
  "deconvolutionAuto",
  "tgvDenoise",
  "wienerDeconvolution",
  "photometricCC",
]);

function ToolParams({
  activeTool,
  params,
  onQuickAction,
  onParamChange,
}: {
  activeTool: EditorTool & string;
  params: EditorToolParams;
  onQuickAction: (op: ImageEditOperation) => void;
  onParamChange?: () => void;
}) {
  if (PARAM_GEOMETRY_TOOLS.has(activeTool)) {
    return (
      <ToolParamsGeometry
        activeTool={activeTool}
        params={params}
        onQuickAction={onQuickAction}
        onParamChange={onParamChange}
      />
    );
  }
  if (PARAM_SLIDER_TOOLS.has(activeTool)) {
    return (
      <ToolParamsSlider activeTool={activeTool} params={params} onParamChange={onParamChange} />
    );
  }
  if (PARAM_MASK_TOOLS.has(activeTool)) {
    return <ToolParamsMask activeTool={activeTool} params={params} onParamChange={onParamChange} />;
  }
  return (
    <ToolParamsProcess activeTool={activeTool} params={params} onParamChange={onParamChange} />
  );
}
