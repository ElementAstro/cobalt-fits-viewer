import { useMemo, useRef, useState, useCallback, useImperativeHandle } from "react";
import { Platform, Text, View } from "react-native";
import type { AppleMaps as ExpoAppleMaps, GoogleMaps as ExpoGoogleMaps } from "expo-maps";
import type { LayoutChangeEvent } from "react-native";
import { useI18n } from "../../i18n/useI18n";
import { buildSuperclusterIndex } from "../../lib/map/clusteringSuper";
import { buildClusterCircles, buildClusterPolylines } from "../../lib/map/overlays";
import { MAP_PRESETS, ASTRONOMY_POI_CATEGORIES } from "../../lib/map/styles";
import type { MapClusterNode, MapViewport } from "../../lib/map/types";
import { resolveNodeForOpen } from "../../lib/map/utils";
import { cameraToViewport, type CameraEvent } from "../../lib/map/coordinates";
import { buildGoogleMarkers, buildAppleAnnotations } from "../../lib/map/markers";
import type { LocationMapViewProps } from "./LocationMapView.types";

export type { LocationMapViewRef } from "./LocationMapView.types";
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

type MapRefLike = {
  setCameraPosition: (config?: {
    coordinates?: { latitude: number; longitude: number };
    zoom?: number;
    tilt?: number;
    bearing?: number;
    duration?: number;
  }) => void;
};

export function LocationMapView({
  ref,
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

  useImperativeHandle(
    ref,
    () => ({
      flyTo(latitude: number, longitude: number, zoom?: number) {
        mapRef.current?.setCameraPosition({
          coordinates: { latitude, longitude },
          zoom: zoom ?? 12,
          duration: 400,
        });
      },
    }),
    [],
  );
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

  const handleMapRef = useCallback((mapInstance: MapRefLike | null) => {
    mapRef.current = mapInstance;
  }, []);

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
          ref={handleMapRef as (ref: unknown) => void}
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
          ref={handleMapRef as (ref: unknown) => void}
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
