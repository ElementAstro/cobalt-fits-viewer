/**
 * 跨平台地图组件 - 展示观测点分布
 * 支持预设样式、覆盖层、POI 过滤、高级 UI 控件
 */

import { useMemo } from "react";
import { Platform, Text, View } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";
import { useI18n } from "../../i18n/useI18n";
import type { FitsMetadata } from "../../lib/fits/types";
import { clusterByDistance, computeBounds, type LocationCluster } from "../../lib/map/clustering";
import { MAP_PRESETS, ASTRONOMY_POI_CATEGORIES, type MapPreset } from "../../lib/map/styles";
import { buildClusterPolylines, buildClusterCircles } from "../../lib/map/overlays";

export type { LocationCluster } from "../../lib/map/clustering";
export type { MapPreset } from "../../lib/map/styles";

let AppleMaps: typeof import("expo-maps").AppleMaps | null = null;
let GoogleMaps: typeof import("expo-maps").GoogleMaps | null = null;
let mapsAvailable = false;

try {
  const maps = require("expo-maps");
  AppleMaps = maps.AppleMaps;
  GoogleMaps = maps.GoogleMaps;
  mapsAvailable = true;
} catch {
  // expo-maps native module not available (e.g. Expo Go)
}

interface LocationMapViewProps {
  files: FitsMetadata[];
  onClusterPress?: (cluster: LocationCluster) => void;
  style?: StyleProp<ViewStyle>;
  preset?: MapPreset;
  showOverlays?: boolean;
}

/**
 * 构建标记点数据（Google Maps / 通用）
 */
function buildMarkers(clusters: LocationCluster[]) {
  return clusters.map((c) => ({
    id: c.id,
    coordinates: {
      latitude: c.location.latitude,
      longitude: c.location.longitude,
    },
    title: c.label,
  }));
}

/**
 * 构建 Apple Maps 注解（带数量气泡样式）
 */
function buildAnnotations(clusters: LocationCluster[]) {
  return clusters.map((c) => {
    const count = c.files.length;
    const backgroundColor = count >= 10 ? "#E53935" : count >= 5 ? "#FB8C00" : "#1E88E5";
    return {
      id: c.id,
      coordinates: {
        latitude: c.location.latitude,
        longitude: c.location.longitude,
      },
      title: c.label,
      text: String(count),
      backgroundColor,
      textColor: "#FFFFFF",
    };
  });
}

export function LocationMapView({
  files,
  onClusterPress,
  style,
  preset = "standard",
  showOverlays = false,
}: LocationMapViewProps) {
  const { t } = useI18n();
  const presetConfig = MAP_PRESETS[preset];

  const clusters = useMemo(() => clusterByDistance(files), [files]);
  const bounds = useMemo(() => computeBounds(clusters), [clusters]);
  const markers = useMemo(() => buildMarkers(clusters), [clusters]);
  const annotations = useMemo(() => buildAnnotations(clusters), [clusters]);

  // 覆盖层数据
  const polylines = useMemo(
    () => (showOverlays ? buildClusterPolylines(clusters) : []),
    [clusters, showOverlays],
  );
  const circles = useMemo(
    () => (showOverlays ? buildClusterCircles(clusters) : []),
    [clusters, showOverlays],
  );

  const handleMarkerClick = useMemo(
    () => (marker: { id?: string }) => {
      if (!marker.id) return;
      const cluster = clusters.find((c) => c.id === marker.id);
      if (cluster && onClusterPress) onClusterPress(cluster);
    },
    [clusters, onClusterPress],
  );

  if (clusters.length === 0) {
    return (
      <View className="flex-1 items-center justify-center" style={style}>
        <Text className="text-sm text-muted">{t("location.noLocationData")}</Text>
      </View>
    );
  }

  const cameraPosition = bounds ? { coordinates: bounds.center, zoom: bounds.zoom } : undefined;

  if (!mapsAvailable) {
    return (
      <View className="flex-1 items-center justify-center" style={style}>
        <Text className="text-sm text-muted">{t("location.mapsRequireDevBuild")}</Text>
      </View>
    );
  }

  // ===== iOS: Apple Maps =====
  if (Platform.OS === "ios" && AppleMaps) {
    return (
      <AppleMaps.View
        style={[{ flex: 1 }, style]}
        cameraPosition={cameraPosition}
        annotations={annotations}
        polylines={polylines as any}
        circles={circles as any}
        properties={{
          isMyLocationEnabled: true,
          mapType: presetConfig.appleMapType as any,
          elevation: presetConfig.appleElevation as any,
          emphasis: presetConfig.appleEmphasis as any,
          pointsOfInterest: { including: [...ASTRONOMY_POI_CATEGORIES] as any },
        }}
        uiSettings={{
          compassEnabled: true,
          myLocationButtonEnabled: true,
          scaleBarEnabled: true,
          togglePitchEnabled: true,
        }}
        onMarkerClick={handleMarkerClick}
      />
    );
  }

  // ===== Android: Google Maps =====
  if (Platform.OS === "android" && GoogleMaps) {
    const googleProps: Record<string, unknown> = {
      isMyLocationEnabled: true,
      mapType: presetConfig.googleMapType as any,
    };
    if (presetConfig.googleStyleJson) {
      googleProps.mapStyleOptions = { json: presetConfig.googleStyleJson };
    }

    return (
      <GoogleMaps.View
        style={[{ flex: 1 }, style]}
        cameraPosition={cameraPosition}
        markers={markers}
        polylines={polylines as any}
        circles={circles as any}
        properties={googleProps as any}
        colorScheme={presetConfig.googleColorScheme as any}
        uiSettings={{
          myLocationButtonEnabled: true,
          compassEnabled: true,
          zoomControlsEnabled: true,
          scaleBarEnabled: true,
          rotationGesturesEnabled: true,
          tiltGesturesEnabled: true,
          togglePitchEnabled: true,
        }}
        onMarkerClick={handleMarkerClick}
      />
    );
  }

  return (
    <View className="flex-1 items-center justify-center" style={style}>
      <Text className="text-sm text-muted">{t("location.mapsOnlyMobile")}</Text>
    </View>
  );
}
