/**
 * 地图标记点详情底部弹窗 - 展示某位置的文件列表与跨页面跳转入口
 */

import { useMemo } from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BottomSheet, Separator, Button, Chip, useThemeColor } from "heroui-native";
import { useI18n } from "../../i18n/useI18n";
import type { FitsMetadata } from "../../lib/fits/types";
import type { MapClusterNode } from "../../lib/map/types";
import {
  uniqueSorted,
  toTestIdValue,
  siteKey,
  computeObservationSummary,
} from "../../lib/map/utils";
import { formatExposureTime } from "../../lib/gallery/albumStatistics";
import { useFavoriteSitesStore } from "../../stores/app/useFavoriteSitesStore";
import { ThumbnailGrid } from "./ThumbnailGrid";

const NOOP = () => {};
const EMPTY_ARRAY: string[] = [];

interface FavoriteSiteButtonProps {
  location: {
    latitude: number;
    longitude: number;
    placeName?: string;
    city?: string;
    region?: string;
  };
  sites: { id: string; latitude: number; longitude: number }[];
  addSite: (site: { label: string; latitude: number; longitude: number }) => void;
  removeSite: (id: string) => void;
  warningColor: string;
  mutedColor: string;
}

function FavoriteSiteButton({
  location,
  sites,
  addSite,
  removeSite,
  warningColor,
  mutedColor,
}: FavoriteSiteButtonProps) {
  const key = siteKey(location.latitude, location.longitude);
  const favSite = sites.find((s) => siteKey(s.latitude, s.longitude) === key);
  return (
    <Button
      size="sm"
      isIconOnly
      variant="ghost"
      onPress={() => {
        if (favSite) {
          removeSite(favSite.id);
        } else {
          addSite({
            label: location.placeName ?? location.city ?? location.region ?? key,
            latitude: location.latitude,
            longitude: location.longitude,
          });
        }
      }}
    >
      <Ionicons
        name={favSite ? "star" : "star-outline"}
        size={18}
        color={favSite ? warningColor : mutedColor}
      />
    </Button>
  );
}

interface LocationMarkerSheetProps {
  cluster: MapClusterNode | null;
  onClose: () => void;
  onFilePress: (file: FitsMetadata) => void;
  onSessionPress: (sessionId: string) => void;
  onTargetPress: (targetId: string) => void;
}

export function LocationMarkerSheet({
  cluster,
  onClose,
  onFilePress,
  onSessionPress,
  onTargetPress,
}: LocationMarkerSheetProps) {
  const { t } = useI18n();
  const [successColor, mutedColor, warningColor] = useThemeColor(["success", "muted", "warning"]);
  const { addSite, removeSite, sites } = useFavoriteSitesStore();

  const location = cluster?.location;
  const subtitle = location
    ? [location.city, location.region, location.country].filter(Boolean).join(", ")
    : "";

  const targetIds = useMemo(
    () => uniqueSorted(cluster?.files.map((file) => file.targetId) ?? []),
    [cluster],
  );
  const sessionIds = useMemo(
    () => uniqueSorted(cluster?.files.map((file) => file.sessionId) ?? []),
    [cluster],
  );

  const summary = useMemo(
    () => (cluster?.files.length ? computeObservationSummary(cluster.files) : null),
    [cluster],
  );

  return (
    <BottomSheet
      isOpen={!!cluster}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content>
          {cluster && location ? (
            <>
              <View className="flex-row items-center gap-2 px-4 pt-1 pb-1">
                <Ionicons name="location" size={16} color={successColor} />
                <View className="flex-1">
                  <Text className="text-base font-bold text-foreground" numberOfLines={1}>
                    {location.placeName ?? location.city ?? cluster.id}
                  </Text>
                  {subtitle ? (
                    <Text className="mt-0.5 text-xs text-muted" numberOfLines={1}>
                      {subtitle}
                    </Text>
                  ) : null}
                  <Text className="mt-0.5 text-[10px] text-muted">
                    {location.latitude.toFixed(4)}°, {location.longitude.toFixed(4)}°
                    {location.altitude ? ` · ${Math.round(location.altitude)}m` : ""}
                  </Text>
                </View>
                <FavoriteSiteButton
                  location={location}
                  sites={sites}
                  addSite={addSite}
                  removeSite={removeSite}
                  warningColor={warningColor}
                  mutedColor={mutedColor}
                />
              </View>

              <Separator className="mx-4 my-1" />

              <View className="px-4 py-1 gap-2">
                <Text className="text-xs text-muted">
                  {cluster.files.length} {t("sessions.imageCount")}
                </Text>

                {summary ? (
                  <View className="gap-1.5">
                    <View className="flex-row flex-wrap gap-3">
                      {summary.totalExposure > 0 ? (
                        <View className="flex-row items-center gap-1">
                          <Ionicons name="time-outline" size={10} color={mutedColor} />
                          <Text className="text-[10px] text-muted">
                            {formatExposureTime(summary.totalExposure)}
                          </Text>
                        </View>
                      ) : null}
                      {summary.dateRange ? (
                        <View className="flex-row items-center gap-1">
                          <Ionicons name="calendar-outline" size={10} color={mutedColor} />
                          <Text className="text-[10px] text-muted">
                            {summary.dateRange.from === summary.dateRange.to
                              ? summary.dateRange.from
                              : `${summary.dateRange.from} ~ ${summary.dateRange.to}`}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    {Object.keys(summary.filterCounts).length > 0 ? (
                      <View className="flex-row flex-wrap gap-1">
                        {Object.entries(summary.filterCounts).map(([filter, count]) => (
                          <Chip key={filter} size="sm" variant="secondary">
                            <Chip.Label className="text-[9px]">
                              {filter}: {count}
                            </Chip.Label>
                          </Chip>
                        ))}
                      </View>
                    ) : null}
                    {summary.objects.length > 1 ? (
                      <View className="flex-row items-center gap-1">
                        <Ionicons name="telescope-outline" size={10} color={mutedColor} />
                        <Text className="text-[10px] text-muted" numberOfLines={1}>
                          {summary.objects.join(", ")}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}

                <View className="flex-row flex-wrap gap-2">
                  {sessionIds.length === 1 ? (
                    <Button
                      testID="e2e-action-map__index-open-session"
                      size="sm"
                      variant="outline"
                      onPress={() => onSessionPress(sessionIds[0])}
                    >
                      <Ionicons name="moon-outline" size={12} color={mutedColor} />
                      <Button.Label>{t("location.openSession")}</Button.Label>
                    </Button>
                  ) : null}
                  {targetIds.length === 1 ? (
                    <Button
                      testID="e2e-action-map__index-open-target"
                      size="sm"
                      variant="outline"
                      onPress={() => onTargetPress(targetIds[0])}
                    >
                      <Ionicons name="locate-outline" size={12} color={mutedColor} />
                      <Button.Label>{t("location.openTarget")}</Button.Label>
                    </Button>
                  ) : null}
                </View>

                {targetIds.length > 1 ? (
                  <View className="gap-1">
                    <Text className="text-[10px] text-muted">{t("location.targets")}</Text>
                    <View className="flex-row flex-wrap gap-1">
                      {targetIds.map((targetId) => (
                        <Chip
                          key={targetId}
                          testID={`e2e-action-map__index-open-target-${toTestIdValue(targetId)}`}
                          size="sm"
                          variant="secondary"
                          onPress={() => onTargetPress(targetId)}
                        >
                          <Chip.Label className="text-[9px]">{targetId}</Chip.Label>
                        </Chip>
                      ))}
                    </View>
                  </View>
                ) : null}

                {sessionIds.length > 1 ? (
                  <View className="gap-1">
                    <Text className="text-[10px] text-muted">{t("location.sessions")}</Text>
                    <View className="flex-row flex-wrap gap-1">
                      {sessionIds.map((sessionId) => (
                        <Chip
                          key={sessionId}
                          testID={`e2e-action-map__index-open-session-${toTestIdValue(sessionId)}`}
                          size="sm"
                          variant="secondary"
                          onPress={() => onSessionPress(sessionId)}
                        >
                          <Chip.Label className="text-[9px]">{sessionId}</Chip.Label>
                        </Chip>
                      ))}
                    </View>
                  </View>
                ) : null}
              </View>

              <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
                <ThumbnailGrid
                  files={cluster.files}
                  columns={3}
                  selectionMode={false}
                  selectedIds={EMPTY_ARRAY}
                  onPress={onFilePress}
                  onLongPress={NOOP}
                  onSelect={NOOP}
                  scrollEnabled={false}
                />
              </View>
            </>
          ) : null}
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}
