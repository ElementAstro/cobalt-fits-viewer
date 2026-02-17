/**
 * 地图筛选栏 - 按目标/滤镜筛选地图上的观测点
 */

import { useMemo } from "react";
import { View, ScrollView } from "react-native";
import { Chip, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../../i18n/useI18n";
import type { FitsMetadata } from "../../lib/fits/types";
import { buildMetadataIndex } from "../../lib/gallery/metadataIndex";

export type MapDateFilterPreset = "all" | "7d" | "30d" | "90d" | "365d";

interface MapFilterBarProps {
  files: FitsMetadata[];
  filterObject: string;
  filterFilter: string;
  dateFilterPreset: MapDateFilterPreset;
  onFilterObjectChange: (value: string) => void;
  onFilterFilterChange: (value: string) => void;
  onDateFilterChange: (value: MapDateFilterPreset) => void;
}

export function MapFilterBar({
  files,
  filterObject,
  filterFilter,
  dateFilterPreset,
  onFilterObjectChange,
  onFilterFilterChange,
  onDateFilterChange,
}: MapFilterBarProps) {
  const { t } = useI18n();
  const [mutedColor, successColor] = useThemeColor(["muted", "success"]);

  const metadataIndex = useMemo(() => buildMetadataIndex(files), [files]);
  const dateOptions: Array<{ key: MapDateFilterPreset; label: string }> = useMemo(
    () => [
      { key: "all", label: t("location.allDates") },
      { key: "7d", label: t("location.last7Days") },
      { key: "30d", label: t("location.last30Days") },
      { key: "90d", label: t("location.last90Days") },
      { key: "365d", label: t("location.last1Year") },
    ],
    [t],
  );

  const hasFilters =
    files.length > 0 || metadataIndex.objects.length > 0 || metadataIndex.filters.length > 0;
  if (!hasFilters) return null;

  return (
    <View className="gap-1 py-1">
      {/* Date filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-4">
        <View className="flex-row gap-1">
          {dateOptions.map((option) => (
            <Chip
              key={option.key}
              size="sm"
              variant={dateFilterPreset === option.key ? "primary" : "secondary"}
              onPress={() => onDateFilterChange(option.key)}
            >
              <Chip.Label className="text-[9px]">{option.label}</Chip.Label>
            </Chip>
          ))}
        </View>
      </ScrollView>

      {/* Object filter */}
      {metadataIndex.objects.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-4">
          <View className="flex-row gap-1">
            <Chip
              size="sm"
              variant={!filterObject ? "primary" : "secondary"}
              onPress={() => onFilterObjectChange("")}
            >
              <Chip.Label className="text-[9px]">{t("location.allObjects")}</Chip.Label>
            </Chip>
            {metadataIndex.objects.map((obj) => (
              <Chip
                key={obj}
                size="sm"
                variant={filterObject === obj ? "primary" : "secondary"}
                onPress={() => onFilterObjectChange(obj)}
              >
                <Ionicons
                  name="star-outline"
                  size={8}
                  color={filterObject === obj ? successColor : mutedColor}
                />
                <Chip.Label className="text-[9px]">{obj}</Chip.Label>
              </Chip>
            ))}
          </View>
        </ScrollView>
      )}

      {/* Filter filter */}
      {metadataIndex.filters.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-4">
          <View className="flex-row gap-1">
            <Chip
              size="sm"
              variant={!filterFilter ? "primary" : "secondary"}
              onPress={() => onFilterFilterChange("")}
            >
              <Chip.Label className="text-[9px]">{t("location.allFilters")}</Chip.Label>
            </Chip>
            {metadataIndex.filters.map((f) => (
              <Chip
                key={f}
                size="sm"
                variant={filterFilter === f ? "primary" : "secondary"}
                onPress={() => onFilterFilterChange(f)}
              >
                <Ionicons
                  name="color-filter-outline"
                  size={8}
                  color={filterFilter === f ? successColor : mutedColor}
                />
                <Chip.Label className="text-[9px]">{f}</Chip.Label>
              </Chip>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}
