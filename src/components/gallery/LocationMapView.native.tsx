import { useMemo, useRef, useState, useCallback } from "react";
import { Platform, Text, View } from "react-native";
import type { AppleMaps as ExpoAppleMaps, GoogleMaps as ExpoGoogleMaps } from "expo-maps";
import type { LayoutChangeEvent } from "react-native";
import { useI18n } from "../../i18n/useI18n";
import { buildSuperclusterIndex } from "../../lib/map/clusteringSuper";
import { buildClusterCircles, buildClusterPolylines } from "../../lib/map/overlays";
import { MAP_PRESETS, ASTRONOMY_POI_CATEGORIES } from "../../lib/map/styles";
import type { MapClusterNode, MapViewport } from "../../lib/map/types";
import type { LocationMapViewProps } from "./LocationMapView.types";

export type { MapClusterNode } from "../../lib/map/types";
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
  // expo-maps native module unavailable (Expo Go / unsupported target)
}

const MAX_LATITUDE = 85.05112878;

type CameraEvent = {
  coordinates: { latitude?: number; longitude?: number };
  zoom: number;
};

type MapRefLike = {
  setCameraPosition: (config?: {
    coordinates?: { latitude: number; longitude: number };
    zoom?: number;
    tilt?: number;
    bearing?: number;
    duration?: number;
  }) => void;
};

function longitudeToWorldX(longitude: number, worldSize: number): number {
  return ((longitude + 180) / 360) * worldSize;
}

function latitudeToWorldY(latitude: number, worldSize: number): number {
  const lat = Math.max(-MAX_LATITUDE, Math.min(MAX_LATITUDE, latitude));
  const sin = Math.sin((lat * Math.PI) / 180);
  return (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * worldSize;
}

function worldXToLongitude(x: number, worldSize: number): number {
  return (x / worldSize) * 360 - 180;
}

function worldYToLatitude(y: number, worldSize: number): number {
  const n = Math.PI - (2 * Math.PI * y) / worldSize;
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

function cameraToViewport(
  camera: CameraEvent,
  size: { width: number; height: number },
): MapViewport {
  if (camera.coordinates.latitude === undefined || camera.coordinates.longitude === undefined) {
    return {
      west: -180,
      south: -85,
      east: 180,
      north: 85,
      zoom: Math.max(0, Math.min(20, camera.zoom)),
    };
  }

  const zoom = Math.max(0, Math.min(20, camera.zoom));
  const worldSize = 256 * 2 ** zoom;
  const centerX = longitudeToWorldX(camera.coordinates.longitude, worldSize);
  const centerY = latitudeToWorldY(camera.coordinates.latitude, worldSize);

  const halfWidth = size.width / 2;
  const halfHeight = size.height / 2;

  const west = worldXToLongitude(centerX - halfWidth, worldSize);
  const east = worldXToLongitude(centerX + halfWidth, worldSize);
  const north = worldYToLatitude(centerY - halfHeight, worldSize);
  const south = worldYToLatitude(centerY + halfHeight, worldSize);

  return {
    west,
    east,
    north: Math.max(-MAX_LATITUDE, Math.min(MAX_LATITUDE, north)),
    south: Math.max(-MAX_LATITUDE, Math.min(MAX_LATITUDE, south)),
    zoom,
  };
}

function buildGoogleMarkers(nodes: MapClusterNode[]) {
  return nodes.map((node) => ({
    id: node.id,
    coordinates: {
      latitude: node.location.latitude,
      longitude: node.location.longitude,
    },
    title: node.label,
  }));
}

function buildAppleAnnotations(nodes: MapClusterNode[]) {
  return nodes.map((node) => {
    const count = node.count;
    const backgroundColor =
      count >= 10 ? "#E53935" : count >= 5 ? "#FB8C00" : node.isCluster ? "#1E88E5" : "#43A047";
    return {
      id: node.id,
      coordinates: {
        latitude: node.location.latitude,
        longitude: node.location.longitude,
      },
      title: node.label,
      text: String(count),
      backgroundColor,
      textColor: "#FFFFFF",
    };
  });
}

function resolveNodeForOpen(
  node: MapClusterNode,
  getLeaves: (clusterId: number) => MapClusterNode["files"],
) {
  if (!node.isCluster || node.clusterId === undefined) return node;
  const files = getLeaves(node.clusterId);
  return {
    ...node,
    files,
    count: files.length,
  };
}

export function LocationMapView({
  files,
  style,
  preset = "standard",
  showOverlays = false,
  contentPaddingTop = 0,
  onClusterAction,
  onClusterPress,
}: LocationMapViewProps) {
  const { t } = useI18n();
  const mapRef = useRef<MapRefLike | null>(null);
  const mapIndex = useMemo(() => buildSuperclusterIndex(files), [files]);
  const initialCamera = useMemo(() => mapIndex.getInitialCamera(), [mapIndex]);

  const [viewport, setViewport] = useState<MapViewport>({
    west: -180,
    south: -85,
    east: 180,
    north: 85,
    zoom: initialCamera?.zoom ?? 2,
  });
  const [mapSize, setMapSize] = useState({ width: 1, height: 1 });
  const [currentZoom, setCurrentZoom] = useState(initialCamera?.zoom ?? 2);

  const nodes = useMemo(() => mapIndex.getClustersByViewport(viewport), [mapIndex, viewport]);
  const nodeById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const presetConfig = MAP_PRESETS[preset];

  const polylines = useMemo(
    () => (showOverlays ? buildClusterPolylines(nodes) : []),
    [nodes, showOverlays],
  );
  const circles = useMemo(
    () => (showOverlays ? buildClusterCircles(nodes) : []),
    [nodes, showOverlays],
  );

  const googleMarkers = useMemo(() => buildGoogleMarkers(nodes), [nodes]);
  const appleAnnotations = useMemo(() => buildAppleAnnotations(nodes), [nodes]);

  const updateViewportFromCamera = useCallback(
    (camera: CameraEvent) => {
      setCurrentZoom(camera.zoom);
      if (camera.coordinates.latitude === undefined || camera.coordinates.longitude === undefined) {
        return;
      }
      if (mapSize.width <= 1 || mapSize.height <= 1) return;
      setViewport(cameraToViewport(camera, mapSize));
    },
    [mapSize],
  );

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const width = Math.max(1, event.nativeEvent.layout.width);
    const height = Math.max(1, event.nativeEvent.layout.height);
    setMapSize({ width, height });
  }, []);

  const handleOpenNode = useCallback(
    (node: MapClusterNode) => {
      const resolved = resolveNodeForOpen(node, (clusterId) => mapIndex.getLeaves(clusterId));
      onClusterAction?.({
        type: "open-cluster",
        node: resolved,
        zoom: currentZoom,
        expansionZoom: resolved.expansionZoom,
      });
      onClusterPress?.(resolved);
    },
    [currentZoom, mapIndex, onClusterAction, onClusterPress],
  );

  const handleMarkerClick = useCallback(
    (marker: { id?: string }) => {
      if (!marker.id) return;
      const node = nodeById.get(marker.id);
      if (!node) return;

      if (node.isCluster && node.clusterId !== undefined) {
        const expansionZoom = node.expansionZoom ?? mapIndex.getExpansionZoom(node.clusterId);
        onClusterAction?.({
          type: "press-cluster",
          node,
          zoom: currentZoom,
          expansionZoom,
        });

        if (currentZoom + 0.1 < expansionZoom) {
          onClusterAction?.({
            type: "expand-cluster",
            node,
            zoom: currentZoom,
            expansionZoom,
          });
          mapRef.current?.setCameraPosition({
            coordinates: {
              latitude: node.location.latitude,
              longitude: node.location.longitude,
            },
            zoom: expansionZoom,
            duration: 260,
          });
          return;
        }
      }

      handleOpenNode(node);
    },
    [currentZoom, handleOpenNode, mapIndex, nodeById, onClusterAction],
  );

  if (!initialCamera) {
    return (
      <View className="flex-1 items-center justify-center" style={style}>
        <Text className="text-sm text-muted">{t("location.noLocationData")}</Text>
      </View>
    );
  }

  if (!mapsAvailable) {
    return (
      <View className="flex-1 items-center justify-center" style={style}>
        <Text className="text-sm text-muted">{t("location.mapsRequireDevBuild")}</Text>
      </View>
    );
  }

  if (Platform.OS === "ios" && AppleMaps) {
    return (
      <View style={[{ flex: 1 }, style]} onLayout={handleLayout}>
        <AppleMaps.View
          ref={(ref) => {
            mapRef.current = ref as MapRefLike | null;
          }}
          style={{ flex: 1 }}
          cameraPosition={initialCamera}
          annotations={appleAnnotations}
          polylines={polylines as unknown as ExpoAppleMaps.MapProps["polylines"]}
          circles={circles as unknown as ExpoAppleMaps.MapProps["circles"]}
          properties={{
            isMyLocationEnabled: true,
            mapType: presetConfig.appleMapType as ExpoAppleMaps.MapProperties["mapType"],
            elevation: presetConfig.appleElevation as ExpoAppleMaps.MapProperties["elevation"],
            emphasis: presetConfig.appleEmphasis as ExpoAppleMaps.MapProperties["emphasis"],
            pointsOfInterest: {
              including: [...ASTRONOMY_POI_CATEGORIES],
            } as ExpoAppleMaps.MapProperties["pointsOfInterest"],
          }}
          uiSettings={{
            compassEnabled: true,
            myLocationButtonEnabled: true,
            scaleBarEnabled: true,
            togglePitchEnabled: true,
          }}
          onCameraMove={updateViewportFromCamera}
          onMarkerClick={handleMarkerClick}
        />
      </View>
    );
  }

  if (Platform.OS === "android" && GoogleMaps) {
    const googleProps: ExpoGoogleMaps.MapProperties = {
      isMyLocationEnabled: true,
      mapType: presetConfig.googleMapType as ExpoGoogleMaps.MapType,
    };
    if (presetConfig.googleStyleJson) {
      googleProps.mapStyleOptions = { json: presetConfig.googleStyleJson };
    }

    return (
      <View style={[{ flex: 1 }, style]} onLayout={handleLayout}>
        <GoogleMaps.View
          ref={(ref) => {
            mapRef.current = ref as MapRefLike | null;
          }}
          style={{ flex: 1 }}
          cameraPosition={initialCamera}
          markers={googleMarkers}
          polylines={polylines as unknown as ExpoGoogleMaps.MapProps["polylines"]}
          circles={circles as unknown as ExpoGoogleMaps.MapProps["circles"]}
          properties={googleProps}
          colorScheme={presetConfig.googleColorScheme as ExpoGoogleMaps.MapColorScheme}
          contentPadding={{ top: Math.max(0, contentPaddingTop), start: 0, end: 0, bottom: 0 }}
          uiSettings={{
            myLocationButtonEnabled: true,
            compassEnabled: true,
            zoomControlsEnabled: true,
            scaleBarEnabled: true,
            rotationGesturesEnabled: true,
            tiltGesturesEnabled: true,
            togglePitchEnabled: true,
          }}
          onCameraMove={updateViewportFromCamera}
          onMarkerClick={handleMarkerClick}
        />
      </View>
    );
  }

  return (
    <View className="flex-1 items-center justify-center" style={style}>
      <Text className="text-sm text-muted">{t("location.mapsOnlyMobile")}</Text>
    </View>
  );
}
