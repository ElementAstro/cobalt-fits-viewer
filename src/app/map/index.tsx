/**
 * 地图视图页面 - 展示所有带位置信息的 FITS 文件在地图上的分布
 */

import { useState, useMemo, useCallback, useEffect } from "react";
import { View, Text, ScrollView, Platform } from "react-native";
import { useRouter } from "expo-router";
import Constants from "expo-constants";
import { Ionicons } from "@expo/vector-icons";
import { Button, Chip, useThemeColor } from "heroui-native";
import { useFitsStore } from "../../stores/useFitsStore";
import { useSettingsStore } from "../../stores/useSettingsStore";
import { useI18n } from "../../i18n/useI18n";
import { useResponsiveLayout } from "../../hooks/useResponsiveLayout";
import { LocationMapView } from "../../components/gallery/LocationMapView";
import { LocationMarkerSheet } from "../../components/gallery/LocationMarkerSheet";
import { MapFilterBar } from "../../components/map/MapFilterBar";
import type { MapDateFilterPreset, MapClusterAction, MapClusterNode } from "../../lib/map/types";
import type { MapPreset } from "../../lib/map/styles";
import type { FitsMetadata } from "../../lib/fits/types";
import { MAP_PRESETS, MAP_PRESET_ORDER } from "../../lib/map/styles";
import { LocationService } from "../../hooks/useLocation";
import { normalizeGeoLocation } from "../../lib/map/geo";

const DATE_FILTER_DAYS: Record<Exclude<MapDateFilterPreset, "all">, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "365d": 365,
};

function getFileTimestamp(file: FitsMetadata): number {
  if (file.dateObs) {
    const parsed = new Date(file.dateObs).getTime();
    if (Number.isFinite(parsed)) return parsed;
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

function hasGeoLocation(file: FitsMetadata): boolean {
  return Boolean(normalizeGeoLocation(file.location));
}

function uniqueSorted(values: Array<string | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value?.trim())))].sort();
}

function locationSiteKey(file: FitsMetadata): string {
  const location = normalizeGeoLocation(file.location);
  if (!location) return "invalid";
  return `${location.latitude.toFixed(4)}_${location.longitude.toFixed(4)}`;
}

function getAndroidGoogleMapsApiKey(): string | undefined {
  const expoConfig = Constants.expoConfig as
    | {
        android?: {
          config?: {
            googleMaps?: {
              apiKey?: string;
            };
          };
        };
      }
    | undefined;
  return expoConfig?.android?.config?.googleMaps?.apiKey;
}

export default function MapScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const [mutedColor, bgColor, successColor, warningColor] = useThemeColor([
    "muted",
    "background",
    "success",
    "warning",
  ]);
  const { contentPaddingTop, horizontalPadding, isLandscapeTablet, sidePanelWidth } =
    useResponsiveLayout();

  const files = useFitsStore((state) => state.files);
  const setAutoTagLocation = useSettingsStore((state) => state.setAutoTagLocation);
  const mapPreset = useSettingsStore((state) => state.mapPreset);
  const setMapPreset = useSettingsStore((state) => state.setMapPreset);
  const mapShowOverlays = useSettingsStore((state) => state.mapShowOverlays);
  const setMapShowOverlays = useSettingsStore((state) => state.setMapShowOverlays);

  const [selectedCluster, setSelectedCluster] = useState<MapClusterNode | null>(null);
  const [filterObject, setFilterObject] = useState("");
  const [filterFilter, setFilterFilter] = useState("");
  const [filterTargetId, setFilterTargetId] = useState("");
  const [filterSessionId, setFilterSessionId] = useState("");
  const [dateFilterPreset, setDateFilterPreset] = useState<MapDateFilterPreset>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [showPresets, setShowPresets] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "web") {
      LocationService.ensurePermission();
    }
  }, []);

  const filesWithLocation = useMemo(() => files.filter(hasGeoLocation), [files]);
  const startTimestamp = useMemo(
    () => getDateFilterStartTimestamp(dateFilterPreset),
    [dateFilterPreset],
  );

  const dateScopedFiles = useMemo(() => {
    if (startTimestamp === null) return filesWithLocation;
    return filesWithLocation.filter((file) => getFileTimestamp(file) >= startTimestamp);
  }, [filesWithLocation, startTimestamp]);

  const objectOptions = useMemo(
    () => uniqueSorted(dateScopedFiles.map((file) => file.object)),
    [dateScopedFiles],
  );
  const objectScopedFiles = useMemo(
    () =>
      filterObject
        ? dateScopedFiles.filter((file) => file.object === filterObject)
        : dateScopedFiles,
    [dateScopedFiles, filterObject],
  );

  const filterOptions = useMemo(
    () => uniqueSorted(objectScopedFiles.map((file) => file.filter)),
    [objectScopedFiles],
  );
  const filterScopedFiles = useMemo(
    () =>
      filterFilter
        ? objectScopedFiles.filter((file) => file.filter === filterFilter)
        : objectScopedFiles,
    [filterFilter, objectScopedFiles],
  );

  const targetOptions = useMemo(
    () => uniqueSorted(filterScopedFiles.map((file) => file.targetId)),
    [filterScopedFiles],
  );
  const targetScopedFiles = useMemo(
    () =>
      filterTargetId
        ? filterScopedFiles.filter((file) => file.targetId === filterTargetId)
        : filterScopedFiles,
    [filterScopedFiles, filterTargetId],
  );

  const sessionOptions = useMemo(
    () => uniqueSorted(targetScopedFiles.map((file) => file.sessionId)),
    [targetScopedFiles],
  );
  const filteredFiles = useMemo(
    () =>
      filterSessionId
        ? targetScopedFiles.filter((file) => file.sessionId === filterSessionId)
        : targetScopedFiles,
    [filterSessionId, targetScopedFiles],
  );

  useEffect(() => {
    if (filterObject && !objectOptions.includes(filterObject)) setFilterObject("");
  }, [filterObject, objectOptions]);
  useEffect(() => {
    if (filterFilter && !filterOptions.includes(filterFilter)) setFilterFilter("");
  }, [filterFilter, filterOptions]);
  useEffect(() => {
    if (filterTargetId && !targetOptions.includes(filterTargetId)) setFilterTargetId("");
  }, [filterTargetId, targetOptions]);
  useEffect(() => {
    if (filterSessionId && !sessionOptions.includes(filterSessionId)) setFilterSessionId("");
  }, [filterSessionId, sessionOptions]);

  const siteCount = useMemo(() => {
    const set = new Set(filteredFiles.map((file) => locationSiteKey(file)));
    return set.has("invalid") ? set.size - 1 : set.size;
  }, [filteredFiles]);

  const totalWithLocation = filesWithLocation.length;
  const currentPresetConfig = MAP_PRESETS[mapPreset];
  const androidMapsKeyMissing = Platform.OS === "android" && !getAndroidGoogleMapsApiKey();

  const clearAllFilters = useCallback(() => {
    setDateFilterPreset("all");
    setFilterObject("");
    setFilterFilter("");
    setFilterTargetId("");
    setFilterSessionId("");
  }, []);

  const handleMapClusterAction = useCallback((action: MapClusterAction) => {
    if (action.type === "open-cluster") {
      setSelectedCluster(action.node);
    }
  }, []);

  const handleFilePress = useCallback(
    (file: FitsMetadata) => {
      setSelectedCluster(null);
      router.push(`/viewer/${file.id}`);
    },
    [router],
  );

  const handleOpenSession = useCallback(
    (sessionId: string) => {
      setSelectedCluster(null);
      router.push(`/session/${sessionId}`);
    },
    [router],
  );

  const handleOpenTarget = useCallback(
    (targetId: string) => {
      setSelectedCluster(null);
      router.push(`/target/${targetId}`);
    },
    [router],
  );

  const handleEnableAutoTag = useCallback(() => {
    setAutoTagLocation(true);
  }, [setAutoTagLocation]);

  const handlePresetChange = useCallback(
    (preset: MapPreset) => {
      setMapPreset(preset);
      setShowPresets(false);
    },
    [setMapPreset],
  );

  return (
    <View testID="e2e-screen-map__index" className="flex-1 bg-background">
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
            <Button
              testID="e2e-action-map__index-toggle-presets"
              size="sm"
              isIconOnly
              variant="ghost"
              onPress={() => setShowPresets((value) => !value)}
            >
              <Ionicons
                name={currentPresetConfig.icon as keyof typeof Ionicons.glyphMap}
                size={16}
                color={mapPreset !== "standard" ? successColor : mutedColor}
              />
            </Button>
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
            <Button
              testID="e2e-action-map__index-toggle-filters"
              size="sm"
              isIconOnly
              variant="ghost"
              onPress={() => setShowFilters((value) => !value)}
            >
              <Ionicons
                name="filter"
                size={16}
                color={
                  dateFilterPreset !== "all" ||
                  Boolean(filterObject) ||
                  Boolean(filterFilter) ||
                  Boolean(filterTargetId) ||
                  Boolean(filterSessionId)
                    ? successColor
                    : mutedColor
                }
              />
            </Button>
            <Text className="text-xs text-muted">
              {siteCount} {t("location.sites")} · {filteredFiles.length} {t("location.filesLabel")}
            </Text>
          </View>
        </View>

        {androidMapsKeyMissing ? (
          <View className="mt-1 px-1">
            <Text className="text-[11px]" style={{ color: warningColor }}>
              {t("location.androidMapsKeyMissing")}
            </Text>
          </View>
        ) : null}

        {showPresets ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-1">
            <View className="flex-row gap-1 px-1">
              {MAP_PRESET_ORDER.map((preset) => {
                const cfg = MAP_PRESETS[preset];
                return (
                  <Chip
                    key={preset}
                    size="sm"
                    variant={mapPreset === preset ? "primary" : "secondary"}
                    onPress={() => handlePresetChange(preset)}
                  >
                    <Ionicons
                      name={cfg.icon as keyof typeof Ionicons.glyphMap}
                      size={10}
                      color={mapPreset === preset ? successColor : mutedColor}
                    />
                    <Chip.Label className="text-[9px]">{t(cfg.label)}</Chip.Label>
                  </Chip>
                );
              })}
            </View>
          </ScrollView>
        ) : null}

        {showFilters ? (
          <MapFilterBar
            files={filteredFiles}
            objectOptions={objectOptions}
            filterOptions={filterOptions}
            targetOptions={targetOptions}
            sessionOptions={sessionOptions}
            filterObject={filterObject}
            filterFilter={filterFilter}
            filterTargetId={filterTargetId}
            filterSessionId={filterSessionId}
            dateFilterPreset={dateFilterPreset}
            onFilterObjectChange={setFilterObject}
            onFilterFilterChange={setFilterFilter}
            onFilterTargetChange={setFilterTargetId}
            onFilterSessionChange={setFilterSessionId}
            onDateFilterChange={setDateFilterPreset}
            onClearAll={clearAllFilters}
          />
        ) : null}
      </View>

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
          onClusterAction={handleMapClusterAction}
          style={{ flex: 1 }}
          preset={mapPreset}
          showOverlays={mapShowOverlays}
          contentPaddingTop={contentPaddingTop + 64}
        />
      )}

      <LocationMarkerSheet
        cluster={selectedCluster}
        onClose={() => setSelectedCluster(null)}
        onFilePress={handleFilePress}
        onSessionPress={handleOpenSession}
        onTargetPress={handleOpenTarget}
      />
    </View>
  );
}
