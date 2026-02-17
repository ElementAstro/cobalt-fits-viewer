/**
 * 地图视图页面 - 展示所有带位置信息的 FITS 文件在地图上的分布
 */

import { useState, useMemo, useCallback, useEffect } from "react";
import { View, Text, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Button, Chip, useThemeColor } from "heroui-native";
import { useFitsStore } from "../../stores/useFitsStore";
import { useSettingsStore } from "../../stores/useSettingsStore";
import { useI18n } from "../../i18n/useI18n";
import { useResponsiveLayout } from "../../hooks/useResponsiveLayout";
import { LocationMapView } from "../../components/gallery/LocationMapView";
import { LocationMarkerSheet } from "../../components/gallery/LocationMarkerSheet";
import { MapFilterBar } from "../../components/map/MapFilterBar";
import type { MapDateFilterPreset } from "../../components/map/MapFilterBar";
import type { LocationCluster, MapPreset } from "../../components/gallery/LocationMapView";
import type { FitsMetadata } from "../../lib/fits/types";
import { MAP_PRESETS, MAP_PRESET_ORDER } from "../../lib/map/styles";
import { LocationService } from "../../hooks/useLocation";

const DATE_FILTER_DAYS: Record<Exclude<MapDateFilterPreset, "all">, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "365d": 365,
};

function getFileTimestamp(file: FitsMetadata): number {
  if (file.dateObs) {
    const parsed = new Date(file.dateObs).getTime();
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return file.importDate;
}

function getDateFilterStartTimestamp(preset: MapDateFilterPreset): number | null {
  if (preset === "all") return null;
  const days = DATE_FILTER_DAYS[preset];
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  return start.getTime();
}

export default function MapScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const [mutedColor, bgColor, successColor] = useThemeColor(["muted", "background", "success"]);
  const { contentPaddingTop, horizontalPadding, isLandscapeTablet, sidePanelWidth } =
    useResponsiveLayout();

  const files = useFitsStore((s) => s.files);
  const setAutoTagLocation = useSettingsStore((s) => s.setAutoTagLocation);
  const mapPreset = useSettingsStore((s) => s.mapPreset);
  const setMapPreset = useSettingsStore((s) => s.setMapPreset);
  const mapShowOverlays = useSettingsStore((s) => s.mapShowOverlays);
  const setMapShowOverlays = useSettingsStore((s) => s.setMapShowOverlays);

  const [selectedCluster, setSelectedCluster] = useState<LocationCluster | null>(null);
  const [filterObject, setFilterObject] = useState("");
  const [filterFilter, setFilterFilter] = useState("");
  const [dateFilterPreset, setDateFilterPreset] = useState<MapDateFilterPreset>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [showPresets, setShowPresets] = useState(false);

  // 进入地图页面时确保定位权限（用于 isMyLocationEnabled）
  useEffect(() => {
    LocationService.ensurePermission();
  }, []);

  // Apply filters
  const filteredFiles = useMemo(() => {
    let result = files;
    if (filterObject) result = result.filter((f) => f.object === filterObject);
    if (filterFilter) result = result.filter((f) => f.filter === filterFilter);
    const startTimestamp = getDateFilterStartTimestamp(dateFilterPreset);
    if (startTimestamp !== null) {
      result = result.filter((f) => getFileTimestamp(f) >= startTimestamp);
    }
    return result;
  }, [files, filterObject, filterFilter, dateFilterPreset]);

  const filesWithLocation = useMemo(() => filteredFiles.filter((f) => f.location), [filteredFiles]);

  const handleClusterPress = useCallback((cluster: LocationCluster) => {
    setSelectedCluster(cluster);
  }, []);

  const handleFilePress = useCallback(
    (file: FitsMetadata) => {
      setSelectedCluster(null);
      router.push(`/viewer/${file.id}`);
    },
    [router],
  );

  const handleEnableAutoTag = useCallback(() => {
    setAutoTagLocation(true);
  }, [setAutoTagLocation]);

  const handlePresetChange = useCallback(
    (p: MapPreset) => {
      setMapPreset(p);
      setShowPresets(false);
    },
    [setMapPreset],
  );

  // Empty state when no files have location data at all
  const totalWithLocation = useMemo(() => files.filter((f) => f.location).length, [files]);

  const currentPresetConfig = MAP_PRESETS[mapPreset];

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <View
        className="absolute top-0 z-10 pb-2"
        style={{
          backgroundColor: `${bgColor}CC`,
          paddingHorizontal: horizontalPadding,
          paddingTop: contentPaddingTop,
          left: 0,
          right: isLandscapeTablet ? undefined : 0,
          width: isLandscapeTablet ? sidePanelWidth : undefined,
        }}
      >
        <View className="flex-row items-center justify-between">
          <Button variant="ghost" size="sm" onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={20} color={mutedColor} />
            <Button.Label className="text-sm text-muted">{t("common.goHome")}</Button.Label>
          </Button>
          <View className="flex-row items-center gap-2">
            <Ionicons name="map" size={16} color={mutedColor} />
            <Text className="text-base font-bold text-foreground">{t("location.mapView")}</Text>
          </View>
          <View className="flex-row items-center gap-1">
            {/* Preset toggle */}
            <Button size="sm" isIconOnly variant="ghost" onPress={() => setShowPresets((v) => !v)}>
              <Ionicons
                name={currentPresetConfig.icon as keyof typeof Ionicons.glyphMap}
                size={16}
                color={mapPreset !== "standard" ? successColor : mutedColor}
              />
            </Button>
            {/* Overlay toggle */}
            <Button
              size="sm"
              isIconOnly
              variant="ghost"
              onPress={() => setMapShowOverlays(!mapShowOverlays)}
            >
              <Ionicons
                name="git-network-outline"
                size={16}
                color={mapShowOverlays ? successColor : mutedColor}
              />
            </Button>
            {/* Filter toggle */}
            <Button size="sm" isIconOnly variant="ghost" onPress={() => setShowFilters((v) => !v)}>
              <Ionicons
                name="filter"
                size={16}
                color={
                  filterObject || filterFilter || dateFilterPreset !== "all"
                    ? successColor
                    : mutedColor
                }
              />
            </Button>
            <Text className="text-xs text-muted">
              {filesWithLocation.length} {t("location.sites")}
            </Text>
          </View>
        </View>

        {/* Preset selector */}
        {showPresets && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-1">
            <View className="flex-row gap-1 px-1">
              {MAP_PRESET_ORDER.map((p) => {
                const cfg = MAP_PRESETS[p];
                return (
                  <Chip
                    key={p}
                    size="sm"
                    variant={mapPreset === p ? "primary" : "secondary"}
                    onPress={() => handlePresetChange(p)}
                  >
                    <Ionicons
                      name={cfg.icon as keyof typeof Ionicons.glyphMap}
                      size={10}
                      color={mapPreset === p ? successColor : mutedColor}
                    />
                    <Chip.Label className="text-[9px]">{t(cfg.label)}</Chip.Label>
                  </Chip>
                );
              })}
            </View>
          </ScrollView>
        )}

        {/* Filter bar */}
        {showFilters && (
          <MapFilterBar
            files={files.filter((f) => f.location)}
            filterObject={filterObject}
            filterFilter={filterFilter}
            dateFilterPreset={dateFilterPreset}
            onFilterObjectChange={setFilterObject}
            onFilterFilterChange={setFilterFilter}
            onDateFilterChange={setDateFilterPreset}
          />
        )}
      </View>

      {/* Map or Empty State */}
      {totalWithLocation === 0 ? (
        <View className="flex-1 items-center justify-center px-8 gap-4">
          <Ionicons name="map-outline" size={64} color={mutedColor} />
          <Text className="text-base font-semibold text-foreground text-center">
            {t("location.noLocationData")}
          </Text>
          <Text className="text-sm text-muted text-center">{t("location.emptyStateHint")}</Text>
          <View className="flex-row gap-3 mt-2">
            <Button size="sm" variant="outline" onPress={handleEnableAutoTag}>
              <Ionicons name="location" size={14} color={successColor} />
              <Button.Label>{t("location.enableAutoTag")}</Button.Label>
            </Button>
            <Button size="sm" variant="outline" onPress={() => router.push("/(tabs)")}>
              <Ionicons name="add-circle-outline" size={14} color={mutedColor} />
              <Button.Label>{t("location.goImport")}</Button.Label>
            </Button>
          </View>
        </View>
      ) : (
        <LocationMapView
          files={filteredFiles}
          onClusterPress={handleClusterPress}
          style={{ flex: 1 }}
          preset={mapPreset}
          showOverlays={mapShowOverlays}
        />
      )}

      {/* Marker Detail Sheet */}
      <LocationMarkerSheet
        cluster={selectedCluster}
        onClose={() => setSelectedCluster(null)}
        onFilePress={handleFilePress}
      />
    </View>
  );
}
