/**
 * 相簿统计信息面板
 */

import { View, Text, ScrollView } from "react-native";
import { BottomSheet, Button, Chip, Separator, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../../i18n/useI18n";
import { useSettingsStore } from "../../stores/useSettingsStore";
import type { AlbumStatistics } from "../../lib/fits/types";
import { getFrameTypeDefinitions } from "../../lib/gallery/frameClassifier";
import { formatExposureTime, formatFileSize } from "../../lib/gallery/albumStatistics";

interface AlbumStatisticsSheetProps {
  visible: boolean;
  statistics: AlbumStatistics | null;
  albumName: string;
  imageCount: number;
  onClose: () => void;
}

export function AlbumStatisticsSheet({
  visible,
  statistics,
  albumName,
  imageCount,
  onClose,
}: AlbumStatisticsSheetProps) {
  const { t } = useI18n();
  const [mutedColor, successColor] = useThemeColor(["muted", "success"]);
  const frameClassificationConfig = useSettingsStore((s) => s.frameClassificationConfig);

  if (!statistics) return null;

  const hasFrames = Object.values(statistics.frameBreakdown).some((v) => v > 0);
  const hasFilters = Object.keys(statistics.filterBreakdown).length > 0;
  const frameTypeLabelMap = new Map<string, string>();
  for (const definition of getFrameTypeDefinitions(frameClassificationConfig)) {
    frameTypeLabelMap.set(
      definition.key,
      definition.builtin
        ? (t(`gallery.frameTypes.${definition.key}`) ?? definition.label)
        : definition.label || definition.key,
    );
  }
  const frameEntries = Object.entries(statistics.frameBreakdown).sort(([a], [b]) =>
    a.localeCompare(b),
  );

  return (
    <BottomSheet isOpen={visible} onOpenChange={(open) => !open && onClose()}>
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content snapPoints={["60%"]}>
          <View className="flex-1 bg-background px-4 pt-2">
            {/* Header */}
            <View className="flex-row items-center justify-between mb-4">
              <View className="flex-row items-center gap-2">
                <Ionicons name="stats-chart" size={20} color={successColor} />
                <BottomSheet.Title>{t("album.statistics")}</BottomSheet.Title>
              </View>
              <Button size="sm" variant="ghost" isIconOnly onPress={onClose}>
                <Ionicons name="close" size={20} color={mutedColor} />
              </Button>
            </View>

            <Separator className="my-2" />

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Album Name */}
              <View className="mb-4">
                <Text className="text-sm text-muted mb-1">{t("gallery.albumName")}</Text>
                <Text className="text-base font-semibold text-foreground">{albumName}</Text>
              </View>

              {/* Overview Stats */}
              <View className="flex-row gap-4 mb-4">
                <View className="flex-1 rounded-xl bg-surface-secondary p-3">
                  <Text className="text-xs text-muted mb-1">{t("album.images")}</Text>
                  <Text className="text-xl font-bold text-foreground">{imageCount}</Text>
                </View>
                <View className="flex-1 rounded-xl bg-surface-secondary p-3">
                  <Text className="text-xs text-muted mb-1">{t("album.totalExposure")}</Text>
                  <Text className="text-xl font-bold text-foreground">
                    {formatExposureTime(statistics.totalExposure)}
                  </Text>
                </View>
                <View className="flex-1 rounded-xl bg-surface-secondary p-3">
                  <Text className="text-xs text-muted mb-1">{t("album.totalSize")}</Text>
                  <Text className="text-lg font-bold text-foreground">
                    {formatFileSize(statistics.totalFileSize)}
                  </Text>
                </View>
              </View>

              {/* Date Range */}
              {statistics.dateRange && (
                <View className="mb-4">
                  <Text className="text-sm font-semibold text-foreground mb-2">
                    {t("album.dateRange")}
                  </Text>
                  <View className="flex-row items-center gap-2">
                    <Ionicons name="calendar-outline" size={16} color={mutedColor} />
                    <Text className="text-sm text-muted">
                      {statistics.dateRange[0]} - {statistics.dateRange[1]}
                    </Text>
                  </View>
                </View>
              )}

              <Separator className="my-4" />

              {/* Frame Breakdown */}
              {hasFrames && (
                <View className="mb-4">
                  <Text className="text-sm font-semibold text-foreground mb-2">
                    {t("album.frameBreakdown")}
                  </Text>
                  <View className="flex-row flex-wrap gap-2">
                    {frameEntries.map(([type, count]) => (
                      <Chip key={type} size="sm" variant={count > 0 ? "primary" : "secondary"}>
                        <Chip.Label className="text-xs">
                          {frameTypeLabelMap.get(type) ?? type}: {count}
                        </Chip.Label>
                      </Chip>
                    ))}
                  </View>
                </View>
              )}

              {/* Filter Breakdown */}
              {hasFilters && (
                <View className="mb-4">
                  <Text className="text-sm font-semibold text-foreground mb-2">
                    {t("gallery.filter")}
                  </Text>
                  <View className="flex-row flex-wrap gap-2">
                    {Object.entries(statistics.filterBreakdown).map(([filter, count]) => (
                      <Chip key={filter} size="sm" variant="secondary">
                        <Chip.Label className="text-xs">
                          {filter}: {count}
                        </Chip.Label>
                      </Chip>
                    ))}
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}
