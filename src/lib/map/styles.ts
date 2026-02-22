/**
 * 地图样式预设系统
 * - Google Maps: JSON 自定义样式
 * - Apple Maps: 原生属性组合
 */

// ===== Google Maps 天文暗色主题 =====
// 基于 https://mapstyle.withgoogle.com/ 生成，优化天文观测场景：
// - 深色背景减少光污染干扰
// - 弱化道路和商业标签
// - 保留地形和水域轮廓
export const GOOGLE_DARK_ASTRONOMY_STYLE = JSON.stringify([
  { elementType: "geometry", stylers: [{ color: "#1d2c4d" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8ec3b9" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#1a3646" }] },
  {
    featureType: "administrative.country",
    elementType: "geometry.stroke",
    stylers: [{ color: "#4b6878" }],
  },
  {
    featureType: "administrative.land_parcel",
    elementType: "labels",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "administrative.province",
    elementType: "geometry.stroke",
    stylers: [{ color: "#4b6878" }],
  },
  {
    featureType: "landscape.man_made",
    elementType: "geometry.stroke",
    stylers: [{ color: "#334e87" }],
  },
  {
    featureType: "landscape.natural",
    elementType: "geometry",
    stylers: [{ color: "#023e58" }],
  },
  {
    featureType: "poi",
    elementType: "geometry",
    stylers: [{ color: "#283d6a" }],
  },
  {
    featureType: "poi",
    elementType: "labels.text.fill",
    stylers: [{ color: "#6f9ba5" }],
  },
  {
    featureType: "poi",
    elementType: "labels.text.stroke",
    stylers: [{ color: "#1d2c4d" }],
  },
  {
    featureType: "poi.business",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "poi.park",
    elementType: "geometry.fill",
    stylers: [{ color: "#023e58" }],
  },
  {
    featureType: "poi.park",
    elementType: "labels.text.fill",
    stylers: [{ color: "#3C7680" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#304a7d" }],
  },
  {
    featureType: "road",
    elementType: "labels.text.fill",
    stylers: [{ color: "#98a5be" }],
  },
  {
    featureType: "road",
    elementType: "labels.text.stroke",
    stylers: [{ color: "#1d2c4d" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#2c6675" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry.stroke",
    stylers: [{ color: "#255763" }],
  },
  {
    featureType: "road.highway",
    elementType: "labels.text.fill",
    stylers: [{ color: "#b0d5ce" }],
  },
  {
    featureType: "road.highway",
    elementType: "labels.text.stroke",
    stylers: [{ color: "#023e58" }],
  },
  {
    featureType: "transit",
    elementType: "labels.text.fill",
    stylers: [{ color: "#98a5be" }],
  },
  {
    featureType: "transit",
    elementType: "labels.text.stroke",
    stylers: [{ color: "#1d2c4d" }],
  },
  {
    featureType: "transit.line",
    elementType: "geometry.fill",
    stylers: [{ color: "#283d6a" }],
  },
  {
    featureType: "transit.station",
    elementType: "geometry",
    stylers: [{ color: "#3a4762" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#0e1626" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#4e6d70" }],
  },
]);

// ===== 地图样式预设 =====

export type MapPreset = "standard" | "dark" | "satellite" | "terrain3d";

export interface MapPresetConfig {
  // 通用
  label: string;
  icon: string;

  // Apple Maps
  appleMapType: string; // STANDARD | HYBRID | IMAGERY
  appleElevation: string; // AUTOMATIC | FLAT | REALISTIC
  appleEmphasis: string; // AUTOMATIC | MUTED

  // Google Maps
  googleMapType: string; // NORMAL | HYBRID | SATELLITE | TERRAIN
  googleColorScheme: string; // LIGHT | DARK | FOLLOW_SYSTEM
  googleStyleJson: string | null;

  // Web (Leaflet)
  webTileUrl: string;
  webTileAttribution: string;
}

export const MAP_PRESETS: Record<MapPreset, MapPresetConfig> = {
  standard: {
    label: "location.presetStandard",
    icon: "map-outline",
    appleMapType: "STANDARD",
    appleElevation: "FLAT",
    appleEmphasis: "AUTOMATIC",
    googleMapType: "NORMAL",
    googleColorScheme: "FOLLOW_SYSTEM",
    googleStyleJson: null,
    webTileUrl: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    webTileAttribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  },
  dark: {
    label: "location.presetDark",
    icon: "moon-outline",
    appleMapType: "STANDARD",
    appleElevation: "FLAT",
    appleEmphasis: "MUTED",
    googleMapType: "NORMAL",
    googleColorScheme: "DARK",
    googleStyleJson: GOOGLE_DARK_ASTRONOMY_STYLE,
    webTileUrl: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    webTileAttribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
  satellite: {
    label: "location.presetSatellite",
    icon: "earth-outline",
    appleMapType: "IMAGERY",
    appleElevation: "FLAT",
    appleEmphasis: "AUTOMATIC",
    googleMapType: "SATELLITE",
    googleColorScheme: "FOLLOW_SYSTEM",
    googleStyleJson: null,
    webTileUrl:
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    webTileAttribution:
      'Tiles &copy; <a href="https://www.esri.com/">Esri</a> &mdash; Source: Esri, Maxar, Earthstar Geographics',
  },
  terrain3d: {
    label: "location.preset3D",
    icon: "cube-outline",
    appleMapType: "STANDARD",
    appleElevation: "REALISTIC",
    appleEmphasis: "AUTOMATIC",
    googleMapType: "TERRAIN",
    googleColorScheme: "FOLLOW_SYSTEM",
    googleStyleJson: null,
    webTileUrl: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    webTileAttribution:
      'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a>',
  },
};

export const MAP_PRESET_ORDER: MapPreset[] = ["standard", "dark", "satellite", "terrain3d"];

// ===== Marker 配色常量 =====
export const MARKER_COLORS = {
  single: "#43A047",
  clusterSmall: "#1E88E5",
  clusterMedium: "#FB8C00",
  clusterLarge: "#E53935",
} as const;

export function getMarkerColor(count: number, isCluster: boolean): string {
  if (count >= 10) return MARKER_COLORS.clusterLarge;
  if (count >= 5) return MARKER_COLORS.clusterMedium;
  if (isCluster) return MARKER_COLORS.clusterSmall;
  return MARKER_COLORS.single;
}

// ===== Apple Maps POI 过滤 =====
// 天文相关 POI: PLANETARIUM, NATIONAL_PARK, PARK, CAMPGROUND
export const ASTRONOMY_POI_CATEGORIES = [
  "PLANETARIUM",
  "NATIONAL_PARK",
  "PARK",
  "CAMPGROUND",
  "UNIVERSITY",
  "MUSEUM",
] as const;
