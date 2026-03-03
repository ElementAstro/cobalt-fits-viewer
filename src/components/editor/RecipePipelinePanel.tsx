import React from "react";
import { View, Text, ScrollView } from "react-native";
import { Button, Card, Switch } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../../i18n/useI18n";
import { getProcessingOperation } from "../../lib/processing/registry";
import type { ProcessingMaskConfig, ProcessingPipelineSnapshot } from "../../lib/fits/types";
import { SimpleSlider } from "../common/SimpleSlider";

interface RecipePipelinePanelProps {
  recipe: ProcessingPipelineSnapshot | null;
  successColor: string;
  onToggleNode: (nodeId: string) => void;
  onRemoveNode: (nodeId: string) => void;
  onSetNodeMaskConfig: (nodeId: string, maskConfig: ProcessingMaskConfig | null) => void;
  onClose: () => void;
}

export const RecipePipelinePanel = React.memo(function RecipePipelinePanel({
  recipe,
  successColor,
  onToggleNode,
  onRemoveNode,
  onSetNodeMaskConfig,
  onClose,
}: RecipePipelinePanelProps) {
  const { t } = useI18n();
  const scientificNodes = recipe?.scientificNodes ?? [];

  const allNodes = [
    ...scientificNodes.map((n, scientificIndex) => ({
      ...n,
      stage: "scientific" as const,
      scientificIndex,
    })),
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
                const scientificIndex =
                  node.stage === "scientific" ? (node.scientificIndex ?? -1) : -1;
                const sourceCandidates =
                  scientificIndex > 0 ? scientificNodes.slice(0, scientificIndex) : [];
                const selectedSourceId = node.maskConfig?.sourceNodeId;
                const selectedSourceNode = selectedSourceId
                  ? sourceCandidates.find((candidate) => candidate.id === selectedSourceId)
                  : null;
                const selectedSourceLabel = selectedSourceNode
                  ? (getProcessingOperation(selectedSourceNode.operationId)?.label ??
                    selectedSourceNode.operationId)
                  : null;
                const nextMaskConfig = (
                  sourceNodeId: string,
                  previousMaskConfig: ProcessingMaskConfig | undefined,
                ): ProcessingMaskConfig => ({
                  sourceNodeId,
                  invert: previousMaskConfig?.invert ?? false,
                  blendStrength: previousMaskConfig?.blendStrength ?? 1,
                });

                return (
                  <View key={node.id} className="py-1.5 border-b border-separator/30">
                    <View className="flex-row items-center justify-between">
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
                        <Switch
                          isSelected={isEnabled}
                          onSelectedChange={() => onToggleNode(node.id)}
                        >
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

                    {node.stage === "scientific" && sourceCandidates.length > 0 && (
                      <View className="mt-1.5 ml-6">
                        <Text className="text-[8px] text-muted mb-1">
                          {t("editor.paramMaskSource")}
                          {selectedSourceLabel ? `: ${selectedSourceLabel}` : ""}
                        </Text>
                        <View className="flex-row flex-wrap gap-1 mb-1">
                          {sourceCandidates.map((candidate, candidateIndex) => {
                            const candidateLabel =
                              getProcessingOperation(candidate.operationId)?.label ??
                              candidate.operationId;
                            const isSelected = selectedSourceId === candidate.id;
                            return (
                              <Button
                                key={candidate.id}
                                size="sm"
                                variant={isSelected ? "primary" : "outline"}
                                onPress={() =>
                                  onSetNodeMaskConfig(
                                    node.id,
                                    nextMaskConfig(candidate.id, node.maskConfig),
                                  )
                                }
                              >
                                <Button.Label className="text-[8px]">
                                  {`#${candidateIndex + 1} ${candidateLabel}`}
                                </Button.Label>
                              </Button>
                            );
                          })}
                        </View>
                        {node.maskConfig && (
                          <View>
                            <View className="flex-row items-center gap-1.5 mb-1">
                              <Switch
                                isSelected={node.maskConfig.invert}
                                onSelectedChange={(invert) =>
                                  onSetNodeMaskConfig(node.id, {
                                    ...node.maskConfig!,
                                    invert,
                                  })
                                }
                              >
                                <Switch.Thumb />
                              </Switch>
                              <Text className="text-[8px] text-muted flex-1">
                                {t("editor.paramInvertMask")}
                              </Text>
                              <Button
                                size="sm"
                                variant="ghost"
                                onPress={() => onSetNodeMaskConfig(node.id, null)}
                              >
                                <Button.Label className="text-[8px]">
                                  {t("editor.paramClearMask")}
                                </Button.Label>
                              </Button>
                            </View>
                            <SimpleSlider
                              label={t("editor.paramMaskBlendStrength")}
                              value={node.maskConfig.blendStrength}
                              min={0}
                              max={1}
                              step={0.05}
                              defaultValue={1}
                              onValueChange={(blendStrength) =>
                                onSetNodeMaskConfig(node.id, {
                                  ...node.maskConfig!,
                                  blendStrength,
                                })
                              }
                            />
                          </View>
                        )}
                      </View>
                    )}
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
