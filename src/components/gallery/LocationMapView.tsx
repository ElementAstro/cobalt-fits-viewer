/**
 * 跨平台地图组件 - 展示观测点分布
 */

import { useMemo } from "react";
import { Platform, Text, View } from "react-native";
import type { GeoLocation, FitsMetadata } from "../../lib/fits/types";

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

export interface LocationCluster {
  id: string;
  location: GeoLocation;
  files: FitsMetadata[];
  label: string;
}

interface LocationMapViewProps {
  files: FitsMetadata[];
  onClusterPress?: (cluster: LocationCluster) => void;
  style?: object;
}

/**
 * 将文件按位置聚合为 clusters（同一城市/地名归为一组）
 */
function clusterByLocation(files: FitsMetadata[]): LocationCluster[] {
  const map = new Map<string, { files: FitsMetadata[]; location: GeoLocation }>();

  for (const file of files) {
    if (!file.location) continue;
    const key =
      file.location.city ??
      file.location.placeName ??
      `${file.location.latitude.toFixed(2)},${file.location.longitude.toFixed(2)}`;

    if (!map.has(key)) {
      map.set(key, { files: [], location: file.location });
    }
    map.get(key)!.files.push(file);
  }

  return Array.from(map.entries()).map(([key, value]) => ({
    id: key,
    location: value.location,
    files: value.files,
    label: `${key} (${value.files.length})`,
  }));
}

function computeCenter(
  clusters: LocationCluster[],
): { latitude: number; longitude: number } | null {
  if (clusters.length === 0) return null;
  const sumLat = clusters.reduce((s, c) => s + c.location.latitude, 0);
  const sumLng = clusters.reduce((s, c) => s + c.location.longitude, 0);
  return {
    latitude: sumLat / clusters.length,
    longitude: sumLng / clusters.length,
  };
}

export function LocationMapView({ files, onClusterPress, style }: LocationMapViewProps) {
  const clusters = useMemo(() => clusterByLocation(files), [files]);
  const center = useMemo(() => computeCenter(clusters), [clusters]);

  if (clusters.length === 0) {
    return (
      <View style={[{ flex: 1, alignItems: "center", justifyContent: "center" }, style]}>
        <Text style={{ color: "#888", fontSize: 14 }}>No location data available</Text>
      </View>
    );
  }

  const cameraPosition = center ? { coordinates: center, zoom: 5 } : undefined;

  if (!mapsAvailable) {
    return (
      <View style={[{ flex: 1, alignItems: "center", justifyContent: "center" }, style]}>
        <Text style={{ color: "#888", fontSize: 14 }}>
          Maps require a development build (not available in Expo Go)
        </Text>
      </View>
    );
  }

  if (Platform.OS === "ios" && AppleMaps) {
    const markers = clusters.map((c) => ({
      id: c.id,
      coordinates: {
        latitude: c.location.latitude,
        longitude: c.location.longitude,
      },
      title: c.label,
    }));

    return (
      <AppleMaps.View
        style={[{ flex: 1 }, style]}
        cameraPosition={cameraPosition}
        markers={markers}
        properties={{ isMyLocationEnabled: true }}
        uiSettings={{ compassEnabled: true, myLocationButtonEnabled: true }}
        onMarkerClick={(marker) => {
          const cluster = clusters.find((c) => c.id === marker.id);
          if (cluster && onClusterPress) onClusterPress(cluster);
        }}
      />
    );
  }

  if (Platform.OS === "android" && GoogleMaps) {
    const markers = clusters.map((c) => ({
      id: c.id,
      coordinates: {
        latitude: c.location.latitude,
        longitude: c.location.longitude,
      },
      title: c.label,
    }));

    return (
      <GoogleMaps.View
        style={[{ flex: 1 }, style]}
        cameraPosition={cameraPosition}
        markers={markers}
        properties={{ isMyLocationEnabled: true }}
        uiSettings={{
          myLocationButtonEnabled: true,
          compassEnabled: true,
          zoomControlsEnabled: true,
        }}
        onMarkerClick={(marker) => {
          const cluster = clusters.find((c) => c.id === marker.id);
          if (cluster && onClusterPress) onClusterPress(cluster);
        }}
      />
    );
  }

  return (
    <View style={[{ flex: 1, alignItems: "center", justifyContent: "center" }, style]}>
      <Text>Maps are only available on iOS and Android</Text>
    </View>
  );
}
