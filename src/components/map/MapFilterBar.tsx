/**
 * 地图筛选栏 - 按日期/目标/滤镜/Target/Session 筛选地图点位
 */

import { useMemo } from "react";
import { View, ScrollView } from "react-native";
import { Chip, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../../i18n/useI18n";
import type { FitsMetadata } from "../../lib/fits/types";
import type { MapDateFilterPreset } from "../../lib/map/types";

interface MapFilterBarProps {
  files: FitsMetadata[];
  objectOptions: string[];
  filterOptions: string[];
  targetOptions: string[];
  sessionOptions: string[];
  filterObject: string;
  filterFilter: string;
  filterTargetId: string;
  filterSessionId: string;
  dateFilterPreset: MapDateFilterPreset;
  onFilterObjectChange: (value: string) => void;
  onFilterFilterChange: (value: string) => void;
  onFilterTargetChange: (value: string) => void;
  onFilterSessionChange: (value: string) => void;
  onDateFilterChange: (value: MapDateFilterPreset) => void;
  onClearAll: () => void;
}

function uniqueSorted(values: Array<string | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value?.trim())))].sort();
}

function toTestIdValue(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

export function MapFilterBar({
  files,
  objectOptions,
  filterOptions,
  targetOptions,
  sessionOptions,
  filterObject,
  filterFilter,
  filterTargetId,
  filterSessionId,
  dateFilterPreset,
  onFilterObjectChange,
  onFilterFilterChange,
  onFilterTargetChange,
  onFilterSessionChange,
  onDateFilterChange,
  onClearAll,
}: MapFilterBarProps) {
  const { t } = useI18n();
  const [mutedColor, successColor] = useThemeColor(["muted", "success"]);

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
    dateFilterPreset !== "all" ||
    Boolean(filterObject) ||
    Boolean(filterFilter) ||
    Boolean(filterTargetId) ||
    Boolean(filterSessionId);

  if (files.length === 0 && !hasFilters) return null;

  return (
    <View className="gap-1 py-1">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-4">
        <View className="flex-row gap-1">
          {dateOptions.map((option) => (
            <Chip
              key={option.key}
              testID={`e2e-action-map__index-filter-date-${option.key}`}
              size="sm"
              variant={dateFilterPreset === option.key ? "primary" : "secondary"}
              onPress={() => onDateFilterChange(option.key)}
            >
              <Chip.Label className="text-[9px]">{option.label}</Chip.Label>
            </Chip>
          ))}
          {hasFilters ? (
            <Chip
              testID="e2e-action-map__index-filter-clear-all"
              size="sm"
              variant="secondary"
              onPress={onClearAll}
            >
              <Ionicons name="close-circle-outline" size={10} color={mutedColor} />
              <Chip.Label className="text-[9px]">{t("location.clearAllFilters")}</Chip.Label>
            </Chip>
          ) : null}
        </View>
      </ScrollView>

      {objectOptions.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-4">
          <View className="flex-row gap-1">
            <Chip
              testID="e2e-action-map__index-filter-object-all"
              size="sm"
              variant={!filterObject ? "primary" : "secondary"}
              onPress={() => onFilterObjectChange("")}
            >
              <Chip.Label className="text-[9px]">{t("location.allObjects")}</Chip.Label>
            </Chip>
            {objectOptions.map((object) => (
              <Chip
                key={object}
                testID={`e2e-action-map__index-filter-object-${toTestIdValue(object)}`}
                size="sm"
                variant={filterObject === object ? "primary" : "secondary"}
                onPress={() => onFilterObjectChange(object)}
              >
                <Ionicons
                  name="star-outline"
                  size={8}
                  color={filterObject === object ? successColor : mutedColor}
                />
                <Chip.Label className="text-[9px]">{object}</Chip.Label>
              </Chip>
            ))}
          </View>
        </ScrollView>
      ) : null}

      {filterOptions.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-4">
          <View className="flex-row gap-1">
            <Chip
              testID="e2e-action-map__index-filter-band-all"
              size="sm"
              variant={!filterFilter ? "primary" : "secondary"}
              onPress={() => onFilterFilterChange("")}
            >
              <Chip.Label className="text-[9px]">{t("location.allFilters")}</Chip.Label>
            </Chip>
            {filterOptions.map((filter) => (
              <Chip
                key={filter}
                testID={`e2e-action-map__index-filter-band-${toTestIdValue(filter)}`}
                size="sm"
                variant={filterFilter === filter ? "primary" : "secondary"}
                onPress={() => onFilterFilterChange(filter)}
              >
                <Ionicons
                  name="color-filter-outline"
                  size={8}
                  color={filterFilter === filter ? successColor : mutedColor}
                />
                <Chip.Label className="text-[9px]">{filter}</Chip.Label>
              </Chip>
            ))}
          </View>
        </ScrollView>
      ) : null}

      {targetOptions.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-4">
          <View className="flex-row gap-1">
            <Chip
              testID="e2e-action-map__index-filter-target-all"
              size="sm"
              variant={!filterTargetId ? "primary" : "secondary"}
              onPress={() => onFilterTargetChange("")}
            >
              <Chip.Label className="text-[9px]">{t("location.allTargets")}</Chip.Label>
            </Chip>
            {targetOptions.map((targetId) => (
              <Chip
                key={targetId}
                testID={`e2e-action-map__index-filter-target-${toTestIdValue(targetId)}`}
                size="sm"
                variant={filterTargetId === targetId ? "primary" : "secondary"}
                onPress={() => onFilterTargetChange(targetId)}
              >
                <Ionicons
                  name="locate-outline"
                  size={8}
                  color={filterTargetId === targetId ? successColor : mutedColor}
                />
                <Chip.Label className="text-[9px]">{targetId}</Chip.Label>
              </Chip>
            ))}
          </View>
        </ScrollView>
      ) : null}

      {sessionOptions.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-4">
          <View className="flex-row gap-1">
            <Chip
              testID="e2e-action-map__index-filter-session-all"
              size="sm"
              variant={!filterSessionId ? "primary" : "secondary"}
              onPress={() => onFilterSessionChange("")}
            >
              <Chip.Label className="text-[9px]">{t("location.allSessions")}</Chip.Label>
            </Chip>
            {sessionOptions.map((sessionId) => (
              <Chip
                key={sessionId}
                testID={`e2e-action-map__index-filter-session-${toTestIdValue(sessionId)}`}
                size="sm"
                variant={filterSessionId === sessionId ? "primary" : "secondary"}
                onPress={() => onFilterSessionChange(sessionId)}
              >
                <Ionicons
                  name="moon-outline"
                  size={8}
                  color={filterSessionId === sessionId ? successColor : mutedColor}
                />
                <Chip.Label className="text-[9px]">{sessionId}</Chip.Label>
              </Chip>
            ))}
          </View>
        </ScrollView>
      ) : null}
    </View>
  );
}

export type { MapDateFilterPreset };
export { uniqueSorted };
