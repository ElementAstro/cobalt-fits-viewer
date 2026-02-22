/**
 * 地图统计摘要面板 - 展示全局观测分布概况
 */

import { useMemo } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BottomSheet, Chip, Separator, useThemeColor } from "heroui-native";
import { useI18n } from "../../i18n/useI18n";
import type { FitsMetadata } from "../../lib/fits/types";
import { normalizeGeoLocation } from "../../lib/map/geo";
import { siteKey, computeObservationSummary } from "../../lib/map/utils";
import { formatExposureTime } from "../../lib/gallery/albumStatistics";

interface SiteEntry {
  key: string;
  label: string;
  latitude: number;
  longitude: number;
  fileCount: number;
  latestDate: string | null;
}

interface MapStatsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  files: FitsMetadata[];
  siteCount: number;
  onSitePress?: (latitude: number, longitude: number) => void;
}

export function MapStatsPanel({
  isOpen,
  onClose,
  files,
  siteCount,
  onSitePress,
}: MapStatsPanelProps) {
  const { t } = useI18n();
  const [mutedColor, successColor] = useThemeColor(["muted", "success"]);

  const summary = useMemo(() => computeObservationSummary(files), [files]);

  const sites = useMemo(() => {
    const siteBuckets = new Map<string, SiteEntry>();

    for (const file of files) {
      const loc = normalizeGeoLocation(file.location);
      if (!loc) continue;
      const key = siteKey(loc.latitude, loc.longitude);
      const existing = siteBuckets.get(key);
      const dateStr = file.dateObs ?? null;

      if (existing) {
        existing.fileCount += 1;
        if (dateStr && (!existing.latestDate || dateStr > existing.latestDate)) {
          existing.latestDate = dateStr;
        }
      } else {
        siteBuckets.set(key, {
          key,
          label: loc.placeName ?? loc.city ?? loc.region ?? key,
          latitude: loc.latitude,
          longitude: loc.longitude,
          fileCount: 1,
          latestDate: dateStr,
        });
      }
    }

    return [...siteBuckets.values()].sort((a, b) => b.fileCount - a.fileCount);
  }, [files]);

  return (
    <BottomSheet
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content>
          <View className="px-4 pt-1 pb-2">
            <Text className="text-base font-bold text-foreground">{t("location.statsTitle")}</Text>
          </View>

          <View className="flex-row px-4 gap-4">
            <View className="flex-1 items-center rounded-lg bg-surface-secondary py-2">
              <Text className="text-lg font-bold text-foreground">{siteCount}</Text>
              <Text className="text-[10px] text-muted">{t("location.sites")}</Text>
            </View>
            <View className="flex-1 items-center rounded-lg bg-surface-secondary py-2">
              <Text className="text-lg font-bold text-foreground">{files.length}</Text>
              <Text className="text-[10px] text-muted">{t("location.filesLabel")}</Text>
            </View>
            <View className="flex-1 items-center rounded-lg bg-surface-secondary py-2">
              <Text className="text-lg font-bold text-foreground">
                {summary?.totalExposure ? formatExposureTime(summary.totalExposure) : "—"}
              </Text>
              <Text className="text-[10px] text-muted">{t("location.statsTotalExposure")}</Text>
            </View>
          </View>

          {summary && Object.keys(summary.filterCounts).length > 0 ? (
            <View className="px-4 mt-2">
              <Text className="text-[10px] text-muted mb-1">{t("location.statsFilters")}</Text>
              <View className="flex-row flex-wrap gap-1">
                {Object.entries(summary.filterCounts)
                  .sort(([, a], [, b]) => b - a)
                  .map(([filter, count]) => (
                    <Chip key={filter} size="sm" variant="secondary">
                      <Chip.Label className="text-[9px]">
                        {filter}: {count}
                      </Chip.Label>
                    </Chip>
                  ))}
              </View>
            </View>
          ) : null}

          <Separator className="mx-4 my-2" />

          <View className="px-4">
            <Text className="text-[10px] text-muted mb-1">{t("location.statsSiteRanking")}</Text>
          </View>

          <ScrollView style={{ maxHeight: 200, paddingHorizontal: 16 }}>
            {sites.map((site) => (
              <Pressable
                key={site.key}
                className="flex-row items-center justify-between py-1.5"
                onPress={() => onSitePress?.(site.latitude, site.longitude)}
              >
                <View className="flex-row items-center gap-2 flex-1">
                  <Ionicons name="location-outline" size={12} color={successColor} />
                  <Text className="text-xs text-foreground flex-1" numberOfLines={1}>
                    {site.label}
                  </Text>
                </View>
                <View className="flex-row items-center gap-3">
                  <Text className="text-[10px] text-muted">{site.fileCount}</Text>
                  {site.latestDate ? (
                    <Text className="text-[10px] text-muted">
                      {new Date(site.latestDate).toLocaleDateString()}
                    </Text>
                  ) : null}
                  <Ionicons name="chevron-forward" size={10} color={mutedColor} />
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}
