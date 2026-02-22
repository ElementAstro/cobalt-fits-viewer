/**
 * 地图筛选栏 - 按日期/目标/滤镜/Target/Session 筛选地图点位
 */

import { useMemo, useState } from "react";
import { View, ScrollView, Text, Pressable } from "react-native";
import { Chip, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../../i18n/useI18n";
import type { FitsMetadata } from "../../lib/fits/types";
import type { MapDateFilterPreset } from "../../lib/map/types";
import { toTestIdValue } from "../../lib/map/utils";

const COLLAPSED_LIMIT = 6;

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
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  const toggleRow = (key: string) => setExpandedRows((prev) => ({ ...prev, [key]: !prev[key] }));

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

  const objectCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const file of files) {
      if (file.object) counts[file.object] = (counts[file.object] ?? 0) + 1;
    }
    return counts;
  }, [files]);

  const filterCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const file of files) {
      if (file.filter) counts[file.filter] = (counts[file.filter] ?? 0) + 1;
    }
    return counts;
  }, [files]);

  const hasFilters =
    dateFilterPreset !== "all" ||
    Boolean(filterObject) ||
    Boolean(filterFilter) ||
    Boolean(filterTargetId) ||
    Boolean(filterSessionId);

  const activeCount = [
    dateFilterPreset !== "all",
    Boolean(filterObject),
    Boolean(filterFilter),
    Boolean(filterTargetId),
    Boolean(filterSessionId),
  ].filter(Boolean).length;

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

      {hasFilters ? (
        <View className="px-4">
          <Text className="text-[9px] text-muted">
            {t("location.activeFilters", { count: activeCount })}
          </Text>
        </View>
      ) : null}

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
            {(expandedRows.object ? objectOptions : objectOptions.slice(0, COLLAPSED_LIMIT)).map(
              (object) => (
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
                  <Chip.Label className="text-[9px]">
                    {object}
                    {objectCounts[object] ? ` (${objectCounts[object]})` : ""}
                  </Chip.Label>
                </Chip>
              ),
            )}
            {objectOptions.length > COLLAPSED_LIMIT ? (
              <Pressable onPress={() => toggleRow("object")} className="justify-center px-1">
                <Ionicons
                  name={expandedRows.object ? "chevron-back" : "chevron-forward"}
                  size={10}
                  color={mutedColor}
                />
              </Pressable>
            ) : null}
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
                <Chip.Label className="text-[9px]">
                  {filter}
                  {filterCounts[filter] ? ` (${filterCounts[filter]})` : ""}
                </Chip.Label>
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
            {(expandedRows.target ? targetOptions : targetOptions.slice(0, COLLAPSED_LIMIT)).map(
              (targetId) => (
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
              ),
            )}
            {targetOptions.length > COLLAPSED_LIMIT ? (
              <Pressable onPress={() => toggleRow("target")} className="justify-center px-1">
                <Ionicons
                  name={expandedRows.target ? "chevron-back" : "chevron-forward"}
                  size={10}
                  color={mutedColor}
                />
              </Pressable>
            ) : null}
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
            {(expandedRows.session ? sessionOptions : sessionOptions.slice(0, COLLAPSED_LIMIT)).map(
              (sessionId) => (
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
              ),
            )}
            {sessionOptions.length > COLLAPSED_LIMIT ? (
              <Pressable onPress={() => toggleRow("session")} className="justify-center px-1">
                <Ionicons
                  name={expandedRows.session ? "chevron-back" : "chevron-forward"}
                  size={10}
                  color={mutedColor}
                />
              </Pressable>
            ) : null}
          </View>
        </ScrollView>
      ) : null}
    </View>
  );
}

export type { MapDateFilterPreset };
