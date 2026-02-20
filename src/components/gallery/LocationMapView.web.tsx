import { useMemo, useRef, useState, useCallback, useEffect } from "react";
import { Text, View } from "react-native";
import {
  MapContainer,
  Marker,
  TileLayer,
  Polyline,
  Circle,
  useMap,
  useMapEvents,
} from "react-leaflet";
import type { Map as LeafletMap } from "leaflet";
import L from "leaflet";
import { useI18n } from "../../i18n/useI18n";
import { MAP_PRESETS } from "../../lib/map/styles";
import { buildSuperclusterIndex } from "../../lib/map/clusteringSuper";
import { buildClusterPolylines, buildClusterCircles } from "../../lib/map/overlays";
import type { MapClusterNode, MapViewport } from "../../lib/map/types";
import type { LocationMapViewProps } from "./LocationMapView.types";

export type { MapClusterNode } from "../../lib/map/types";
export type { MapPreset } from "../../lib/map/styles";

const LEAFLET_STYLESHEET_ID = "cobalt-leaflet-stylesheet";
const LEAFLET_STYLESHEET_HREF = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";

function ensureLeafletStylesheet() {
  if (typeof document === "undefined") return;
  if (document.getElementById(LEAFLET_STYLESHEET_ID)) return;

  const link = document.createElement("link");
  link.id = LEAFLET_STYLESHEET_ID;
  link.rel = "stylesheet";
  link.href = LEAFLET_STYLESHEET_HREF;
  link.crossOrigin = "";
  document.head.appendChild(link);
}

function readViewport(map: LeafletMap): MapViewport {
  const bounds = map.getBounds();
  return {
    west: bounds.getWest(),
    south: bounds.getSouth(),
    east: bounds.getEast(),
    north: bounds.getNorth(),
    zoom: map.getZoom(),
  };
}

function buildMarkerIcon(node: MapClusterNode) {
  if (node.isCluster) {
    const size = Math.max(30, Math.min(44, 24 + Math.log2(node.count + 1) * 6));
    return L.divIcon({
      className: "map-cluster-icon",
      html: `<div style="width:${size}px;height:${size}px;border-radius:${size / 2}px;background:#1e88e5;color:#fff;font-weight:700;display:flex;align-items:center;justify-content:center;border:2px solid rgba(255,255,255,0.9);box-shadow:0 2px 8px rgba(0,0,0,0.25);">${node.count}</div>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    });
  }

  return L.divIcon({
    className: "map-point-icon",
    html: `<div style="width:14px;height:14px;border-radius:7px;background:#43a047;border:2px solid rgba(255,255,255,0.95);box-shadow:0 2px 6px rgba(0,0,0,0.25);"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
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

function ViewportBridge({ onChange }: { onChange: (viewport: MapViewport) => void }) {
  const map = useMap();

  useEffect(() => {
    onChange(readViewport(map));
  }, [map, onChange]);

  useMapEvents({
    moveend() {
      onChange(readViewport(map));
    },
    zoomend() {
      onChange(readViewport(map));
    },
  });

  return null;
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
  const mapRef = useRef<LeafletMap | null>(null);

  useEffect(() => {
    ensureLeafletStylesheet();
  }, []);

  const mapIndex = useMemo(() => buildSuperclusterIndex(files), [files]);
  const initialCamera = useMemo(() => mapIndex.getInitialCamera(), [mapIndex]);

  const [viewport, setViewport] = useState<MapViewport>({
    west: -180,
    south: -85,
    east: 180,
    north: 85,
    zoom: initialCamera?.zoom ?? 2,
  });
  const [currentZoom, setCurrentZoom] = useState(initialCamera?.zoom ?? 2);

  const nodes = useMemo(() => mapIndex.getClustersByViewport(viewport), [mapIndex, viewport]);
  const markerIcons = useMemo(() => {
    const iconMap = new Map<string, L.DivIcon>();
    for (const node of nodes) {
      iconMap.set(node.id, buildMarkerIcon(node));
    }
    return iconMap;
  }, [nodes]);

  const polylines = useMemo(
    () => (showOverlays ? buildClusterPolylines(nodes) : []),
    [nodes, showOverlays],
  );
  const circles = useMemo(
    () => (showOverlays ? buildClusterCircles(nodes) : []),
    [nodes, showOverlays],
  );
  const presetConfig = MAP_PRESETS[preset];

  const handleViewportChange = useCallback((nextViewport: MapViewport) => {
    setViewport(nextViewport);
    setCurrentZoom(nextViewport.zoom);
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

  const handleNodeClick = useCallback(
    (node: MapClusterNode) => {
      if (node.isCluster && node.clusterId !== undefined) {
        const expansionZoom = node.expansionZoom ?? mapIndex.getExpansionZoom(node.clusterId);
        onClusterAction?.({
          type: "press-cluster",
          node,
          zoom: currentZoom,
          expansionZoom,
        });
        if (currentZoom + 0.1 < expansionZoom) {
          mapRef.current?.setView(
            [node.location.latitude, node.location.longitude],
            expansionZoom,
            { animate: true },
          );
          onClusterAction?.({
            type: "expand-cluster",
            node,
            zoom: currentZoom,
            expansionZoom,
          });
          return;
        }
      }

      handleOpenNode(node);
    },
    [currentZoom, handleOpenNode, mapIndex, onClusterAction],
  );

  if (!initialCamera) {
    return (
      <View className="flex-1 items-center justify-center" style={style}>
        <Text className="text-sm text-muted">{t("location.noLocationData")}</Text>
      </View>
    );
  }

  return (
    <View style={[{ flex: 1, paddingTop: Math.max(0, contentPaddingTop) }, style]}>
      <MapContainer
        center={[initialCamera.coordinates.latitude, initialCamera.coordinates.longitude]}
        zoom={initialCamera.zoom}
        style={{ width: "100%", height: "100%" }}
        ref={(map) => {
          mapRef.current = map;
        }}
        zoomControl
      >
        <ViewportBridge onChange={handleViewportChange} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {nodes.map((node) => (
          <Marker
            key={node.id}
            position={[node.location.latitude, node.location.longitude]}
            icon={markerIcons.get(node.id)}
            eventHandlers={{
              click: () => handleNodeClick(node),
            }}
          />
        ))}

        {showOverlays &&
          polylines.map((line) => (
            <Polyline
              key={line.id}
              positions={line.coordinates.map((coordinate) => [
                coordinate.latitude,
                coordinate.longitude,
              ])}
              pathOptions={{ color: String(line.color ?? "#4FC3F7"), weight: line.width ?? 2 }}
            />
          ))}

        {showOverlays &&
          circles.map((circle) => (
            <Circle
              key={circle.id}
              center={[circle.center.latitude, circle.center.longitude]}
              radius={circle.radius}
              pathOptions={{
                color: String(circle.lineColor ?? "#4FC3F7"),
                fillColor: String(circle.color ?? "rgba(79,195,247,0.13)"),
                fillOpacity: 0.2,
                weight: circle.lineWidth ?? 1,
              }}
            />
          ))}
      </MapContainer>
      {presetConfig.label === "location.presetDark" ? (
        <View
          pointerEvents="none"
          style={{ position: "absolute", inset: 0, backgroundColor: "rgba(8,14,24,0.22)" }}
        />
      ) : null}
    </View>
  );
}
