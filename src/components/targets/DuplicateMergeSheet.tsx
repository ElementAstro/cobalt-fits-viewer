/**
 * 重复目标合并 Sheet
 */

import { ScrollView, View, Text } from "react-native";
import { BottomSheet, Button, Card, Chip, Separator, useThemeColor } from "heroui-native";
import { Ionicons as Icons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useI18n } from "../../i18n/useI18n";
import type { Target } from "../../lib/fits/types";
import type { DuplicateGroup, DuplicateDetectionResult } from "../../lib/targets/duplicateDetector";

interface DuplicateMergeSheetProps {
  visible: boolean;
  detectionResult: DuplicateDetectionResult | null;
  isDetecting: boolean;
  onClose: () => void;
  onDetect: () => void;
  onMergeGroup: (group: DuplicateGroup) => void;
  getTargetStats?: (targetId: string) => { exposureStats: { totalExposure: number } } | null;
}

export function DuplicateMergeSheet({
  visible,
  detectionResult,
  isDetecting,
  onClose,
  onDetect,
  onMergeGroup,
  getTargetStats,
}: DuplicateMergeSheetProps) {
  const { t } = useI18n();
  const mutedColor = useThemeColor("muted");
  const insets = useSafeAreaInsets();

  const getConfidenceColor = (confidence: "high" | "medium" | "low") => {
    switch (confidence) {
      case "high":
        return "#22c55e";
      case "medium":
        return "#f59e0b";
      case "low":
        return "#ef4444";
    }
  };

  const getMatchReasonLabel = (reason: DuplicateGroup["matchReason"]) => {
    switch (reason) {
      case "name":
        return t("targets.search.duplicateTitle");
      case "alias":
        return "Alias";
      case "coordinates":
        return t("targets.coordinates");
      case "similar_name":
        return "Similar";
    }
  };

  const renderTargetItem = (target: Target, isPrimary: boolean) => {
    const stats = getTargetStats?.(target.id);
    const totalExposureMin = stats ? Math.round(stats.exposureStats.totalExposure / 60) : 0;

    return (
      <View
        key={target.id}
        className={`flex-row items-center justify-between p-2 rounded-lg ${
          isPrimary ? "bg-primary/10" : "bg-surface-secondary"
        }`}
      >
        <View className="flex-1">
          <View className="flex-row items-center gap-2">
            {isPrimary && <Icons name="checkmark-circle" size={14} color="#22c55e" />}
            <Text className={`text-sm ${isPrimary ? "font-semibold" : ""} text-foreground`}>
              {target.name}
            </Text>
          </View>
          <View className="flex-row items-center gap-3 mt-1">
            <Text className="text-[10px] text-muted">
              {target.imageIds.length} {t("targets.frameCount")}
            </Text>
            <Text className="text-[10px] text-muted">{totalExposureMin}m</Text>
          </View>
        </View>
        {target.aliases.length > 0 && (
          <View className="flex-row flex-wrap gap-1 max-w-[40%]">
            {target.aliases.slice(0, 2).map((alias) => (
              <Chip key={alias} size="sm" variant="secondary">
                <Chip.Label className="text-[9px]">{alias}</Chip.Label>
              </Chip>
            ))}
            {target.aliases.length > 2 && (
              <Chip size="sm" variant="secondary">
                <Chip.Label className="text-[9px]">+{target.aliases.length - 2}</Chip.Label>
              </Chip>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <BottomSheet isOpen={visible} onOpenChange={(open) => !open && onClose()}>
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content
          detached
          bottomInset={insets.bottom + 8}
          snapPoints={["88%"]}
          className="mx-4"
          backgroundClassName="rounded-[28px] bg-background"
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingTop: 12,
              paddingBottom: insets.bottom + 20,
            }}
          >
            <View className="flex-row items-center justify-between mb-4">
              <BottomSheet.Title>{t("targets.search.duplicates")}</BottomSheet.Title>
              <BottomSheet.Close />
            </View>

            {/* 还未检测 */}
            {!detectionResult && !isDetecting && (
              <View className="items-center py-8">
                <Icons name="copy-outline" size={48} color={mutedColor} />
                <Text className="mt-4 text-sm text-muted text-center">
                  {t("targets.search.noDuplicates")}
                </Text>
                <Button variant="primary" className="mt-4" onPress={onDetect}>
                  <Button.Label>{t("targets.search.duplicates")}</Button.Label>
                </Button>
              </View>
            )}

            {/* 检测中 */}
            {isDetecting && (
              <View className="items-center py-8">
                <Icons name="refresh" size={48} color={mutedColor} />
                <Text className="mt-4 text-sm text-muted">{t("common.loading")}</Text>
              </View>
            )}

            {/* 检测结果 */}
            {detectionResult && !isDetecting && (
              <>
                {/* 统计 */}
                <Card variant="secondary" className="mb-4">
                  <Card.Body className="p-3">
                    <View className="flex-row justify-between items-center">
                      <View>
                        <Text className="text-2xl font-bold text-foreground">
                          {detectionResult.groups.length}
                        </Text>
                        <Text className="text-xs text-muted">
                          {t("targets.search.duplicateTitle")}
                        </Text>
                      </View>
                      <View className="items-end">
                        <Text className="text-lg font-semibold text-warning">
                          {detectionResult.totalDuplicates}
                        </Text>
                        <Text className="text-xs text-muted">
                          {t("targets.search.mergeSelected")}
                        </Text>
                      </View>
                    </View>
                  </Card.Body>
                </Card>

                {detectionResult.groups.length === 0 ? (
                  <View className="items-center py-8">
                    <Icons name="checkmark-circle-outline" size={48} color="#22c55e" />
                    <Text className="mt-4 text-sm text-muted text-center">
                      {t("targets.search.noDuplicates")}
                    </Text>
                  </View>
                ) : (
                  <View className="gap-3">
                    {detectionResult.groups.map((group) => (
                      <Card key={group.id} variant="secondary">
                        <Card.Body className="p-3">
                          {/* 组头部 */}
                          <View className="flex-row items-center justify-between mb-2">
                            <View className="flex-row items-center gap-2">
                              <View
                                className="h-2 w-2 rounded-full"
                                style={{ backgroundColor: getConfidenceColor(group.confidence) }}
                              />
                              <Text className="text-xs text-muted">
                                {getMatchReasonLabel(group.matchReason)}
                              </Text>
                              <Chip size="sm" variant="secondary">
                                <Chip.Label className="text-[9px]">{group.confidence}</Chip.Label>
                              </Chip>
                            </View>
                            <Button size="sm" variant="primary" onPress={() => onMergeGroup(group)}>
                              <Button.Label>{t("targets.search.mergeSelected")}</Button.Label>
                            </Button>
                          </View>

                          <Separator className="mb-2" />

                          {/* 目标列表 */}
                          <View className="gap-2">
                            {group.targets.map((target, index) =>
                              renderTargetItem(target, index === 0),
                            )}
                          </View>
                        </Card.Body>
                      </Card>
                    ))}
                  </View>
                )}

                <Separator className="my-4" />

                <Button variant="outline" onPress={onDetect}>
                  <Icons name="refresh" size={14} color={mutedColor} />
                  <Button.Label>{t("common.retry")}</Button.Label>
                </Button>
              </>
            )}
          </ScrollView>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}
