import React from "react";
import { View, Text, ScrollView } from "react-native";
import { Button, Card, Switch } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../../i18n/useI18n";
import { getProcessingOperation } from "../../lib/processing/registry";
import type { ProcessingPipelineSnapshot } from "../../lib/fits/types";

interface RecipePipelinePanelProps {
  recipe: ProcessingPipelineSnapshot | null;
  successColor: string;
  onToggleNode: (nodeId: string) => void;
  onRemoveNode: (nodeId: string) => void;
  onClose: () => void;
}

export const RecipePipelinePanel = React.memo(function RecipePipelinePanel({
  recipe,
  successColor,
  onToggleNode,
  onRemoveNode,
  onClose,
}: RecipePipelinePanelProps) {
  const { t } = useI18n();

  const allNodes = [
    ...(recipe?.scientificNodes ?? []).map((n) => ({ ...n, stage: "scientific" as const })),
    ...(recipe?.colorNodes ?? []).map((n) => ({ ...n, stage: "color" as const })),
  ];

  return (
    <View className="absolute top-4 left-4 right-4 max-h-[60%]">
      <Card variant="secondary">
        <Card.Body className="p-3">
          <View className="flex-row items-center justify-between mb-2">
            <View className="flex-row items-center gap-2">
              <Ionicons name="git-network-outline" size={14} color={successColor} />
              <Text className="text-xs font-semibold text-success">{t("editor.pipeline")}</Text>
            </View>
            <Button size="sm" variant="outline" onPress={onClose}>
              <Button.Label className="text-[10px]">{t("common.close")}</Button.Label>
            </Button>
          </View>

          {allNodes.length === 0 ? (
            <Text className="text-[10px] text-muted py-2">{t("editor.emptyPipeline")}</Text>
          ) : (
            <ScrollView style={{ maxHeight: 200 }} showsVerticalScrollIndicator={false}>
              {allNodes.map((node, idx) => {
                const schema = getProcessingOperation(node.operationId);
                const label = schema?.label ?? node.operationId;
                const isEnabled = node.enabled !== false;

                return (
                  <View
                    key={node.id}
                    className="flex-row items-center justify-between py-1.5 border-b border-separator/30"
                  >
                    <View className="flex-row items-center gap-2 flex-1">
                      <Text className="text-[9px] text-muted w-4 text-right">{idx + 1}</Text>
                      <View className="flex-1">
                        <Text
                          className={`text-[10px] font-medium ${isEnabled ? "text-foreground" : "text-muted line-through"}`}
                          numberOfLines={1}
                        >
                          {label}
                        </Text>
                        <Text className="text-[8px] text-muted" numberOfLines={1}>
                          {node.stage === "color" ? "Color" : "Scientific"}
                        </Text>
                      </View>
                    </View>
                    <View className="flex-row items-center gap-1.5">
                      <Switch isSelected={isEnabled} onSelectedChange={() => onToggleNode(node.id)}>
                        <Switch.Thumb />
                      </Switch>
                      <Button
                        size="sm"
                        variant="ghost"
                        isIconOnly
                        onPress={() => onRemoveNode(node.id)}
                      >
                        <Ionicons name="trash-outline" size={12} color="#ef4444" />
                      </Button>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          )}
        </Card.Body>
      </Card>
    </View>
  );
});
